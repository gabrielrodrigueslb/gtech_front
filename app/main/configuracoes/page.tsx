'use client';

import { getMe } from '@/lib/auth';
import LogoutConfirmDialog from '@/components/logout-confirm-dialog';
import {
  connectWhatsApp,
  createWhatsAppAiKnowledgeFileItem,
  createWhatsAppAiKnowledgeManualItem,
  createContactTag,
  createCloseReason,
  DEFAULT_WHATSAPP_AI_AGENT_CONFIG,
  DEFAULT_WHATSAPP_DISTRIBUTION_CONFIG,
  DEFAULT_WHATSAPP_CLOSE_REASONS,
  DEFAULT_WHATSAPP_CONTACT_TAGS,
  deleteWhatsAppAiKnowledgeItem,
  deleteContactTag,
  deleteCloseReason,
  getContactTags,
  getCloseReasons,
  getWhatsAppAiAgentConfig,
  getWhatsAppAiKnowledgeItems,
  getWhatsAppDistributionConfig,
  getWhatsAppSession,
  logoutWhatsApp,
  updateWhatsAppAiKnowledgeItem,
  updateWhatsAppAiAgentConfig,
  updateWhatsAppDistributionConfig,
  WHATSAPP_AI_MODEL_PRESETS,
} from '@/lib/whatsapp-client';
import { DEFAULT_SOCKET_TRANSPORTS, resolveSocketUrl } from '@/lib/socket';
import type {
  WhatsAppAiAgentConfig,
  WhatsAppAiKnowledgeItem,
  WhatsAppDistributionConfig,
  WhatsAppSession,
} from '@/types/Whatsapp.types';
import { io, type Socket } from 'socket.io-client';
import {
  LoaderCircle,
  LogOut,
  QrCode,
  RefreshCcw,
  Settings2,
  Smartphone,
  UserRound,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'USER';
};

const EMPTY_SESSION: WhatsAppSession = {
  id: 'default',
  status: 'DISCONNECTED',
  qrCodeDataUrl: null,
  phoneNumber: null,
  displayName: null,
  lastError: null,
};

function mergeAiAgentConfig(
  config?: Partial<WhatsAppAiAgentConfig> | null
): WhatsAppAiAgentConfig {
  return {
    ...DEFAULT_WHATSAPP_AI_AGENT_CONFIG,
    ...(config ?? {}),
    openai: {
      ...DEFAULT_WHATSAPP_AI_AGENT_CONFIG.openai,
      ...(config?.openai ?? {}),
    },
    gemini: {
      ...DEFAULT_WHATSAPP_AI_AGENT_CONFIG.gemini,
      ...(config?.gemini ?? {}),
    },
  };
}

function mergeDistributionConfig(
  config?: Partial<WhatsAppDistributionConfig> | null
): WhatsAppDistributionConfig {
  return {
    ...DEFAULT_WHATSAPP_DISTRIBUTION_CONFIG,
    ...(config ?? {}),
    newConversations: {
      ...DEFAULT_WHATSAPP_DISTRIBUTION_CONFIG.newConversations,
      ...(config?.newConversations ?? {}),
    },
    queueTransfers: {
      ...DEFAULT_WHATSAPP_DISTRIBUTION_CONFIG.queueTransfers,
      ...(config?.queueTransfers ?? {}),
    },
    aiHandoff: {
      ...DEFAULT_WHATSAPP_DISTRIBUTION_CONFIG.aiHandoff,
      ...(config?.aiHandoff ?? {}),
    },
  };
}

const CUSTOM_MODEL_OPTION = '__custom__';
const AI_DELAY_PRESETS = [0, 500, 1500, 3000, 5000];

function formatAiResponseDelay(delayMs: number) {
  const safeDelayMs = Math.max(0, Math.round(Number(delayMs) || 0));
  if (safeDelayMs < 1000) {
    return `${safeDelayMs} ms`;
  }

  const seconds = safeDelayMs / 1000;
  return Number.isInteger(seconds) ? `${seconds} s` : `${seconds.toFixed(1)} s`;
}

function extractRequestErrorMessage(error: unknown, fallback: string) {
  const typedError = error as {
    response?: { data?: { error?: string; message?: string } };
    message?: string;
  } | null;

  const responseMessage =
    typedError?.response?.data?.error ?? typedError?.response?.data?.message ?? typedError?.message;

  if (!responseMessage) return fallback;
  return `${fallback} ${responseMessage}`;
}

const STATUS_META: Record<
  WhatsAppSession['status'],
  { label: string; badgeClass: string; description: string }
> = {
  DISCONNECTED: {
    label: 'Desconectado',
    badgeClass: 'bg-white/8 text-white/80 border border-white/10',
    description: 'Nenhum numero conectado. Gere um QR Code para vincular um aparelho.',
  },
  CONNECTING: {
    label: 'Conectando',
    badgeClass: 'bg-amber-500/15 text-amber-200 border border-amber-500/25',
    description: 'Aguardando a sessao iniciar ou renovando a conexao com o WhatsApp.',
  },
  QR_READY: {
    label: 'QR pronto',
    badgeClass: 'bg-sky-500/15 text-sky-200 border border-sky-500/25',
    description: 'Escaneie o QR Code abaixo no WhatsApp do aparelho que sera conectado.',
  },
  CONNECTED: {
    label: 'Conectado',
    badgeClass: 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/25',
    description: 'Numero conectado e pronto para receber e enviar mensagens.',
  },
  BANNED: {
    label: 'Bloqueado',
    badgeClass: 'bg-rose-500/15 text-rose-200 border border-rose-500/25',
    description: 'A sessao foi bloqueada. Verifique o numero e gere uma nova conexao.',
  },
  ERROR: {
    label: 'Erro',
    badgeClass: 'bg-rose-500/15 text-rose-200 border border-rose-500/25',
    description: 'Houve uma falha ao iniciar a sessao. Consulte a mensagem de erro abaixo.',
  },
};

export default function ConfiguracoesPage() {
  const router = useRouter();
  const socketRef = useRef<Socket | null>(null);
  const knowledgeFileInputRef = useRef<HTMLInputElement | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<WhatsAppSession>(EMPTY_SESSION);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [closeReasons, setCloseReasons] = useState<string[]>(DEFAULT_WHATSAPP_CLOSE_REASONS);
  const [newCloseReason, setNewCloseReason] = useState('');
  const [isSavingCloseReason, setIsSavingCloseReason] = useState(false);
  const [isRemovingCloseReason, setIsRemovingCloseReason] = useState<string | null>(null);
  const [contactTags, setContactTags] = useState<string[]>(DEFAULT_WHATSAPP_CONTACT_TAGS);
  const [newContactTag, setNewContactTag] = useState('');
  const [isSavingContactTag, setIsSavingContactTag] = useState(false);
  const [isRemovingContactTag, setIsRemovingContactTag] = useState<string | null>(null);
  const [aiAgentConfig, setAiAgentConfig] = useState<WhatsAppAiAgentConfig>(
    mergeAiAgentConfig(DEFAULT_WHATSAPP_AI_AGENT_CONFIG)
  );
  const [distributionConfig, setDistributionConfig] = useState<WhatsAppDistributionConfig>(
    mergeDistributionConfig(DEFAULT_WHATSAPP_DISTRIBUTION_CONFIG)
  );
  const [isLoadingAiAgentConfig, setIsLoadingAiAgentConfig] = useState(false);
  const [isSavingAiAgentConfig, setIsSavingAiAgentConfig] = useState(false);
  const [knowledgeItems, setKnowledgeItems] = useState<WhatsAppAiKnowledgeItem[]>([]);
  const [newKnowledgeTitle, setNewKnowledgeTitle] = useState('');
  const [newKnowledgeContent, setNewKnowledgeContent] = useState('');
  const [newKnowledgeAlwaysInclude, setNewKnowledgeAlwaysInclude] = useState(false);
  const [newKnowledgeUploadTitle, setNewKnowledgeUploadTitle] = useState('');
  const [newKnowledgeUploadAlwaysInclude, setNewKnowledgeUploadAlwaysInclude] = useState(false);
  const [isLoadingKnowledgeItems, setIsLoadingKnowledgeItems] = useState(false);
  const [isCreatingKnowledgeItem, setIsCreatingKnowledgeItem] = useState(false);
  const [isUploadingKnowledgeItem, setIsUploadingKnowledgeItem] = useState(false);
  const [isSavingKnowledgeItemId, setIsSavingKnowledgeItemId] = useState<string | null>(null);
  const [isRemovingKnowledgeItemId, setIsRemovingKnowledgeItemId] = useState<string | null>(null);
  const [isLoadingDistributionConfig, setIsLoadingDistributionConfig] = useState(false);
  const [isSavingDistributionConfig, setIsSavingDistributionConfig] = useState(false);

  const statusMeta = STATUS_META[session.status];
  const isAwaitingConnection = session.status === 'CONNECTING' || session.status === 'QR_READY';
  const isAdmin = user?.role === 'ADMIN';

  const refreshSession = useCallback(async (silent = false) => {
    if (!silent) setIsLoadingSession(true);

    try {
      const nextSession = await getWhatsAppSession();
      setSession({ ...EMPTY_SESSION, ...nextSession });
    } catch (error) {
      console.error('[Configuracoes] Erro ao carregar sessao WhatsApp:', error);
      setFeedback('Nao foi possivel carregar o status atual do WhatsApp.');
    } finally {
      if (!silent) setIsLoadingSession(false);
    }
  }, []);

  useEffect(() => {
    async function loadUser() {
      try {
        const me = await getMe();
        if (!me) {
          router.replace('/');
          return;
        }
        setUser(me);
      } catch {
        router.replace('/');
      } finally {
        setIsLoadingUser(false);
      }
    }

    loadUser();
  }, [router]);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    let isMounted = true;

    async function loadSettingsLists() {
      try {
        const [reasons, tags] = await Promise.all([getCloseReasons(), getContactTags()]);
        if (isMounted && reasons.length > 0) {
          setCloseReasons(reasons);
        }
        if (isMounted && tags.length > 0) {
          setContactTags(tags);
        }
      } catch (error) {
        console.error('[Configuracoes] Erro ao carregar listas do WhatsApp:', error);
      }
    }

    loadSettingsLists();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (isLoadingUser) return;

    if (!user || user.role !== 'ADMIN') {
      setAiAgentConfig(mergeAiAgentConfig(DEFAULT_WHATSAPP_AI_AGENT_CONFIG));
      setIsLoadingAiAgentConfig(false);
      return;
    }

    let isMounted = true;

    async function loadAiAgentConfig() {
      setIsLoadingAiAgentConfig(true);

      try {
        const config = await getWhatsAppAiAgentConfig();
        if (isMounted) {
          setAiAgentConfig(mergeAiAgentConfig(config));
        }
      } catch (error) {
        console.error('[Configuracoes] Erro ao carregar agente IA:', error);
        if (isMounted) {
          setFeedback('Nao foi possivel carregar a configuracao do agente IA.');
        }
      } finally {
        if (isMounted) {
          setIsLoadingAiAgentConfig(false);
        }
      }
    }

    loadAiAgentConfig();

    return () => {
      isMounted = false;
    };
  }, [isLoadingUser, user]);

  useEffect(() => {
    if (isLoadingUser) return;

    if (!user || user.role !== 'ADMIN') {
      setKnowledgeItems([]);
      setIsLoadingKnowledgeItems(false);
      return;
    }

    let isMounted = true;

    async function loadKnowledgeItems() {
      setIsLoadingKnowledgeItems(true);

      try {
        const items = await getWhatsAppAiKnowledgeItems();
        if (isMounted) {
          setKnowledgeItems(items);
        }
      } catch (error) {
        console.error('[Configuracoes] Erro ao carregar base de conhecimento da IA:', error);
        if (isMounted) {
          setFeedback('Nao foi possivel carregar a base de conhecimento da IA.');
        }
      } finally {
        if (isMounted) {
          setIsLoadingKnowledgeItems(false);
        }
      }
    }

    loadKnowledgeItems();

    return () => {
      isMounted = false;
    };
  }, [isLoadingUser, user]);

  useEffect(() => {
    if (isLoadingUser) return;

    if (!user || user.role !== 'ADMIN') {
      setDistributionConfig(mergeDistributionConfig(DEFAULT_WHATSAPP_DISTRIBUTION_CONFIG));
      setIsLoadingDistributionConfig(false);
      return;
    }

    let isMounted = true;

    async function loadDistributionSettings() {
      setIsLoadingDistributionConfig(true);

      try {
        const config = await getWhatsAppDistributionConfig();

        if (isMounted) {
          setDistributionConfig(mergeDistributionConfig(config));
        }
      } catch (error) {
        console.error('[Configuracoes] Erro ao carregar distribuicao dos atendimentos:', error);
        if (isMounted) {
          setFeedback('Nao foi possivel carregar a distribuicao dos atendimentos.');
        }
      } finally {
        if (isMounted) {
          setIsLoadingDistributionConfig(false);
        }
      }
    }

    loadDistributionSettings();

    return () => {
      isMounted = false;
    };
  }, [isLoadingUser, user]);

  useEffect(() => {
    const socketUrl = resolveSocketUrl();
    if (!socketUrl) return;

    const socket = io(socketUrl, {
      withCredentials: true,
      transports: [...DEFAULT_SOCKET_TRANSPORTS],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 5_000,
    });

    socketRef.current = socket;

    socket.on('connect_error', (error) => {
      console.error('[Socket][WhatsApp Config] Falha na conexao:', error?.message ?? error);
    });

    socket.on('whatsapp:qr', ({ qr }: { qr: string }) => {
      setSession((current) => ({
        ...current,
        status: 'QR_READY',
        qrCodeDataUrl: qr,
        lastError: null,
      }));
      setFeedback('QR Code atualizado. Escaneie com o WhatsApp do numero desejado.');
      setIsConnecting(false);
    });

    socket.on('whatsapp:connected', ({ phone, displayName }: { phone?: string; displayName?: string }) => {
      setSession((current) => ({
        ...current,
        status: 'CONNECTED',
        qrCodeDataUrl: null,
        phoneNumber: phone ?? current.phoneNumber ?? null,
        displayName: displayName ?? current.displayName ?? null,
        lastError: null,
      }));
      setFeedback('Numero conectado com sucesso.');
      setIsConnecting(false);
      setIsDisconnecting(false);
    });

    socket.on(
      'whatsapp:disconnected',
      ({ reason, willReconnect }: { reason?: string; willReconnect?: boolean }) => {
        const normalizedReason = String(reason ?? '').toLowerCase();
        const isConnectionConflict = normalizedReason.includes('conflict');
        setSession((current) => ({
          ...EMPTY_SESSION,
          id: current.id ?? EMPTY_SESSION.id,
          status: willReconnect && !isConnectionConflict ? 'CONNECTING' : 'DISCONNECTED',
          lastError: reason ?? null,
        }));
        setFeedback(
          isConnectionConflict
            ? 'Outra conexao assumiu a sessao do WhatsApp. Verifique se ha outro backend ou outra instancia usando a mesma conta.'
            : willReconnect
              ? 'Conexao perdida. Tentando reconectar...'
              : 'WhatsApp desconectado.'
        );
        setIsConnecting(false);
        setIsDisconnecting(false);
      }
    );

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!isAwaitingConnection) return;

    const interval = window.setInterval(() => {
      refreshSession(true);
    }, 3000);

    return () => {
      window.clearInterval(interval);
    };
  }, [isAwaitingConnection, refreshSession]);

  const connectionSteps = useMemo(() => {
    if (session.status === 'CONNECTED') {
      return [
        'Numero vinculado e autenticado.',
        'Mensagens ja podem ser enviadas pelo modulo de chat.',
        'Se trocar de aparelho, desconecte e gere um novo QR Code.',
      ];
    }

    if (session.status === 'QR_READY') {
      return [
        'Abra o WhatsApp no celular.',
        'Entre em Dispositivos conectados.',
        'Escaneie o QR Code exibido nesta tela.',
      ];
    }

    return [
      'Clique em Conectar numero para iniciar a sessao.',
      'Aguarde o backend gerar o QR Code.',
      'Escaneie o codigo e confirme a vinculacao no aparelho.',
    ];
  }, [session.status]);

  async function handleConnect() {
    setIsConnecting(true);
    setFeedback('Iniciando a conexao e solicitando um novo QR Code...');

    try {
      await connectWhatsApp();
      await refreshSession(true);
    } catch (error) {
      console.error('[Configuracoes] Erro ao conectar WhatsApp:', error);
      setFeedback('Falha ao iniciar a conexao com o WhatsApp.');
      setIsConnecting(false);
    }
  }

  async function handleDisconnect() {
    setIsDisconnecting(true);
    setFeedback('Encerrando a sessao atual...');

    try {
      await logoutWhatsApp();
      setSession(EMPTY_SESSION);
      setFeedback('Sessao encerrada. Gere um novo QR Code para conectar outro numero.');
    } catch (error) {
      console.error('[Configuracoes] Erro ao desconectar WhatsApp:', error);
      setFeedback('Falha ao encerrar a sessao do WhatsApp.');
    } finally {
      setIsDisconnecting(false);
    }
  }

  async function handleLogout() {
    setIsLoggingOut(true);

    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
      setIsLogoutDialogOpen(false);
      router.replace('/');
    } finally {
      setIsLoggingOut(false);
    }
  }

  async function handleAddCloseReason() {
    const reason = newCloseReason.trim();
    if (!reason) return;

    setIsSavingCloseReason(true);

    try {
      const updatedReasons = await createCloseReason(reason);
      setCloseReasons(updatedReasons);
      setNewCloseReason('');
      setFeedback('Motivo de encerramento cadastrado com sucesso.');
    } catch (error) {
      console.error('[Configuracoes] Erro ao salvar motivo de encerramento:', error);
      setFeedback('Nao foi possivel salvar o motivo de encerramento.');
    } finally {
      setIsSavingCloseReason(false);
    }
  }

  async function handleRemoveCloseReason(reason: string) {
    setIsRemovingCloseReason(reason);

    try {
      const updatedReasons = await deleteCloseReason(reason);
      setCloseReasons(updatedReasons);
      setFeedback('Motivo removido com sucesso.');
    } catch (error) {
      console.error('[Configuracoes] Erro ao remover motivo de encerramento:', error);
      setFeedback('Nao foi possivel remover o motivo de encerramento.');
    } finally {
      setIsRemovingCloseReason(null);
    }
  }

  async function handleAddContactTag() {
    const tag = newContactTag.trim();
    if (!tag) return;

    setIsSavingContactTag(true);

    try {
      const updatedTags = await createContactTag(tag);
      setContactTags(updatedTags);
      setNewContactTag('');
      setFeedback('Tag de cliente cadastrada com sucesso.');
    } catch (error) {
      console.error('[Configuracoes] Erro ao salvar tag de cliente:', error);
      setFeedback('Nao foi possivel salvar a tag de cliente.');
    } finally {
      setIsSavingContactTag(false);
    }
  }

  async function handleRemoveContactTag(tag: string) {
    setIsRemovingContactTag(tag);

    try {
      const updatedTags = await deleteContactTag(tag);
      setContactTags(updatedTags);
      setFeedback('Tag removida com sucesso.');
    } catch (error) {
      console.error('[Configuracoes] Erro ao remover tag de cliente:', error);
      setFeedback('Nao foi possivel remover a tag de cliente.');
    } finally {
      setIsRemovingContactTag(null);
    }
  }

  function handleAiAgentConfigChange(
    patch:
      | Partial<WhatsAppAiAgentConfig>
      | ((current: WhatsAppAiAgentConfig) => Partial<WhatsAppAiAgentConfig>)
  ) {
    setAiAgentConfig((current) => {
      const nextPatch = typeof patch === 'function' ? patch(current) : patch;
      return mergeAiAgentConfig({
        ...current,
        ...nextPatch,
        openai: {
          ...current.openai,
          ...(nextPatch.openai ?? {}),
        },
        gemini: {
          ...current.gemini,
          ...(nextPatch.gemini ?? {}),
        },
      });
    });
  }

  async function handleSaveAiAgentConfig() {
    if (!isAdmin) return;

    setIsSavingAiAgentConfig(true);

    try {
      const savedConfig = await updateWhatsAppAiAgentConfig(aiAgentConfig);
      setAiAgentConfig(mergeAiAgentConfig(savedConfig));
      setFeedback('Configuracao do agente IA salva com sucesso.');
    } catch (error) {
      console.error('[Configuracoes] Erro ao salvar agente IA:', error);
      setFeedback(
        extractRequestErrorMessage(error, 'Nao foi possivel salvar a configuracao do agente IA.')
      );
    } finally {
      setIsSavingAiAgentConfig(false);
    }
  }

  function upsertKnowledgeItem(nextItem: WhatsAppAiKnowledgeItem) {
    setKnowledgeItems((current) => {
      const existingIndex = current.findIndex((item) => item.id === nextItem.id);
      if (existingIndex === -1) {
        return [nextItem, ...current];
      }

      const updated = [...current];
      updated[existingIndex] = nextItem;
      return updated;
    });
  }

  async function fileToDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Falha ao ler o arquivo selecionado'));
      reader.readAsDataURL(file);
    });
  }

  function handleKnowledgeItemChange(
    itemId: string,
    patch:
      | Partial<WhatsAppAiKnowledgeItem>
      | ((current: WhatsAppAiKnowledgeItem) => Partial<WhatsAppAiKnowledgeItem>)
  ) {
    setKnowledgeItems((current) =>
      current.map((item) => {
        if (item.id !== itemId) return item;
        const nextPatch = typeof patch === 'function' ? patch(item) : patch;
        return {
          ...item,
          ...nextPatch,
        };
      })
    );
  }

  async function handleCreateKnowledgeManualItem() {
    if (!isAdmin) return;

    const title = newKnowledgeTitle.trim();
    const content = newKnowledgeContent.trim();
    if (!title || !content) return;

    setIsCreatingKnowledgeItem(true);

    try {
      const item = await createWhatsAppAiKnowledgeManualItem({
        title,
        content,
        alwaysInclude: newKnowledgeAlwaysInclude,
      });
      upsertKnowledgeItem(item);
      setNewKnowledgeTitle('');
      setNewKnowledgeContent('');
      setNewKnowledgeAlwaysInclude(false);
      setFeedback('Item manual adicionado na base de conhecimento da IA.');
    } catch (error) {
      console.error('[Configuracoes] Erro ao criar item manual da base de conhecimento:', error);
      setFeedback(
        extractRequestErrorMessage(
          error,
          'Nao foi possivel adicionar o item manual na base de conhecimento.'
        )
      );
    } finally {
      setIsCreatingKnowledgeItem(false);
    }
  }

  async function handleKnowledgeFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !isAdmin) return;

    setIsUploadingKnowledgeItem(true);

    try {
      const dataUrl = await fileToDataUrl(file);
      const item = await createWhatsAppAiKnowledgeFileItem({
        title: newKnowledgeUploadTitle.trim() || undefined,
        fileName: file.name,
        dataUrl,
        alwaysInclude: newKnowledgeUploadAlwaysInclude,
      });

      upsertKnowledgeItem(item);
      setNewKnowledgeUploadTitle('');
      setNewKnowledgeUploadAlwaysInclude(false);
      setFeedback('Documento adicionado na base de conhecimento da IA.');
    } catch (error) {
      console.error('[Configuracoes] Erro ao anexar documento na base de conhecimento:', error);
      setFeedback(
        extractRequestErrorMessage(
          error,
          'Nao foi possivel anexar o documento na base de conhecimento.'
        )
      );
    } finally {
      setIsUploadingKnowledgeItem(false);
    }
  }

  async function handleSaveKnowledgeItem(itemId: string) {
    if (!isAdmin) return;

    const currentItem = knowledgeItems.find((item) => item.id === itemId);
    if (!currentItem) return;

    setIsSavingKnowledgeItemId(itemId);

    try {
      const savedItem = await updateWhatsAppAiKnowledgeItem(itemId, {
        title: currentItem.title,
        content: currentItem.content,
        enabled: currentItem.enabled,
        alwaysInclude: currentItem.alwaysInclude,
      });
      upsertKnowledgeItem(savedItem);
      setFeedback('Item da base de conhecimento atualizado.');
    } catch (error) {
      console.error('[Configuracoes] Erro ao salvar item da base de conhecimento:', error);
      setFeedback(
        extractRequestErrorMessage(
          error,
          'Nao foi possivel atualizar o item da base de conhecimento.'
        )
      );
    } finally {
      setIsSavingKnowledgeItemId(null);
    }
  }

  async function handleDeleteKnowledgeItem(itemId: string) {
    if (!isAdmin) return;

    setIsRemovingKnowledgeItemId(itemId);

    try {
      const items = await deleteWhatsAppAiKnowledgeItem(itemId);
      setKnowledgeItems(items);
      setFeedback('Item removido da base de conhecimento da IA.');
    } catch (error) {
      console.error('[Configuracoes] Erro ao remover item da base de conhecimento:', error);
      setFeedback(
        extractRequestErrorMessage(
          error,
          'Nao foi possivel remover o item da base de conhecimento.'
        )
      );
    } finally {
      setIsRemovingKnowledgeItemId(null);
    }
  }

  function handleDistributionConfigChange(
    patch:
      | Partial<WhatsAppDistributionConfig>
      | ((current: WhatsAppDistributionConfig) => Partial<WhatsAppDistributionConfig>)
  ) {
    setDistributionConfig((current) => {
      const nextPatch = typeof patch === 'function' ? patch(current) : patch;
      return mergeDistributionConfig({
        ...current,
        ...nextPatch,
        newConversations: {
          ...current.newConversations,
          ...(nextPatch.newConversations ?? {}),
        },
        queueTransfers: {
          ...current.queueTransfers,
          ...(nextPatch.queueTransfers ?? {}),
        },
        aiHandoff: {
          ...current.aiHandoff,
          ...(nextPatch.aiHandoff ?? {}),
        },
      });
    });
  }

  async function handleSaveDistributionConfig() {
    if (!isAdmin) return;

    setIsSavingDistributionConfig(true);

    try {
      const savedConfig = await updateWhatsAppDistributionConfig(distributionConfig);
      setDistributionConfig(mergeDistributionConfig(savedConfig));
      setFeedback('Distribuicao dos atendimentos salva com sucesso.');
    } catch (error) {
      console.error('[Configuracoes] Erro ao salvar distribuicao dos atendimentos:', error);
      setFeedback(
        extractRequestErrorMessage(
          error,
          'Nao foi possivel salvar a distribuicao dos atendimentos.'
        )
      );
    } finally {
      setIsSavingDistributionConfig(false);
    }
  }

  return (
    <div className="min-h-full text-white ">
      <div className="mx-auto flex w-full  flex-col gap-6">
        <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(10,25,54,0.98),rgba(16,34,69,0.92))] p-8 shadow-[0_18px_80px_rgba(0,0,0,0.24)]">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl space-y-4">
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-white/70">
                <Settings2 size={14} />
                Configuracoes
              </span>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight">Central de configuracoes</h1>
                <p className="max-w-xl text-sm leading-6 text-white/65">
                  Organize a operacao por area: dados do usuario, conexao do WhatsApp e padroes do
                  sistema. Cada sessao fica separada para reduzir ruido e facilitar a configuracao.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => refreshSession()}
                disabled={isLoadingSession}
                className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCcw size={16} className={isLoadingSession ? 'animate-spin' : ''} />
                Atualizar status
              </button>
            </div>
          </div>
        </section>

        <SettingsTabbedSections
          user={user}
          isLoadingUser={isLoadingUser}
          session={session}
          statusMeta={statusMeta}
          isLoadingSession={isLoadingSession}
          isAwaitingConnection={isAwaitingConnection}
          isConnecting={isConnecting}
          isDisconnecting={isDisconnecting}
          isLoggingOut={isLoggingOut}
          feedback={feedback}
          connectionSteps={connectionSteps}
          closeReasons={closeReasons}
          newCloseReason={newCloseReason}
          setNewCloseReason={setNewCloseReason}
          isSavingCloseReason={isSavingCloseReason}
          isRemovingCloseReason={isRemovingCloseReason}
          handleAddCloseReason={handleAddCloseReason}
          handleRemoveCloseReason={handleRemoveCloseReason}
          contactTags={contactTags}
          newContactTag={newContactTag}
          setNewContactTag={setNewContactTag}
          isSavingContactTag={isSavingContactTag}
          isRemovingContactTag={isRemovingContactTag}
          handleAddContactTag={handleAddContactTag}
          handleRemoveContactTag={handleRemoveContactTag}
          isAdmin={isAdmin}
          aiAgentConfig={aiAgentConfig}
          knowledgeItems={knowledgeItems}
          distributionConfig={distributionConfig}
          isLoadingAiAgentConfig={isLoadingAiAgentConfig}
          isSavingAiAgentConfig={isSavingAiAgentConfig}
          isLoadingKnowledgeItems={isLoadingKnowledgeItems}
          isCreatingKnowledgeItem={isCreatingKnowledgeItem}
          isUploadingKnowledgeItem={isUploadingKnowledgeItem}
          isSavingKnowledgeItemId={isSavingKnowledgeItemId}
          isRemovingKnowledgeItemId={isRemovingKnowledgeItemId}
          isLoadingDistributionConfig={isLoadingDistributionConfig}
          isSavingDistributionConfig={isSavingDistributionConfig}
          handleAiAgentConfigChange={handleAiAgentConfigChange}
          newKnowledgeTitle={newKnowledgeTitle}
          setNewKnowledgeTitle={setNewKnowledgeTitle}
          newKnowledgeContent={newKnowledgeContent}
          setNewKnowledgeContent={setNewKnowledgeContent}
          newKnowledgeAlwaysInclude={newKnowledgeAlwaysInclude}
          setNewKnowledgeAlwaysInclude={setNewKnowledgeAlwaysInclude}
          newKnowledgeUploadTitle={newKnowledgeUploadTitle}
          setNewKnowledgeUploadTitle={setNewKnowledgeUploadTitle}
          newKnowledgeUploadAlwaysInclude={newKnowledgeUploadAlwaysInclude}
          setNewKnowledgeUploadAlwaysInclude={setNewKnowledgeUploadAlwaysInclude}
          knowledgeFileInputRef={knowledgeFileInputRef}
          handleKnowledgeItemChange={handleKnowledgeItemChange}
          handleCreateKnowledgeManualItem={handleCreateKnowledgeManualItem}
          handleKnowledgeFileSelected={handleKnowledgeFileSelected}
          handleSaveKnowledgeItem={handleSaveKnowledgeItem}
          handleDeleteKnowledgeItem={handleDeleteKnowledgeItem}
          handleDistributionConfigChange={handleDistributionConfigChange}
          handleSaveAiAgentConfig={handleSaveAiAgentConfig}
          handleSaveDistributionConfig={handleSaveDistributionConfig}
          handleConnect={handleConnect}
          handleDisconnect={handleDisconnect}
          openLogoutDialog={() => setIsLogoutDialogOpen(true)}
        />

        <LogoutConfirmDialog
          open={isLogoutDialogOpen}
          onOpenChange={setIsLogoutDialogOpen}
          onConfirm={handleLogout}
          isLoading={isLoggingOut}
        />

        {false && (
        <section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-6">
            <article className="rounded-3xl border border-white/10 bg-card p-6 shadow-[0_12px_50px_rgba(0,0,0,0.14)]">
              <div className="mb-6 flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-amber-400 text-xl font-bold text-black">
                  {user?.name?.slice(0, 2).toUpperCase() ?? 'US'}
                </div>

                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/45">
                    Usuario logado
                  </p>
                  {isLoadingUser ? (
                    <div className="mt-2 h-5 w-32 animate-pulse rounded bg-white/10" />
                  ) : (
                    <>
                      <h2 className="truncate text-xl font-semibold">{user?.name ?? 'Sem nome'}</h2>
                      <p className="truncate text-sm text-white/55">{user?.email ?? 'Sem e-mail'}</p>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-white/8 bg-white/3 p-4 text-sm text-white/70">
                <p>Acesso rapido para configuracoes da conta e da sessao do WhatsApp.</p>
                <p>Use o botao do usuario no rodape do menu lateral para voltar sempre a esta tela.</p>
              </div>
            </article>

            <article className="rounded-3xl border border-white/10 bg-card p-6 shadow-[0_12px_50px_rgba(0,0,0,0.14)]">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-white/5 p-3">
                  {session.status === 'CONNECTED' ? <Wifi size={20} /> : <WifiOff size={20} />}
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Etapas da conexao</h3>
                  <p className="text-sm text-white/55">{statusMeta.description}</p>
                </div>
              </div>

              <ul className="mt-5 space-y-3 text-sm text-white/70">
                {connectionSteps.map((step) => (
                  <li
                    key={step}
                    className="rounded-2xl border border-white/8 bg-white/3 px-4 py-3 leading-6"
                  >
                    {step}
                  </li>
                ))}
              </ul>
            </article>
          </div>

          <article className="rounded-3xl border border-white/10 bg-card p-6 shadow-[0_12px_50px_rgba(0,0,0,0.14)]">
            <div className="flex flex-col gap-5 border-b border-white/8 pb-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-semibold">Sessao do WhatsApp</h2>
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusMeta.badgeClass}`}
                  >
                    {statusMeta.label}
                  </span>
                </div>
                <p className="max-w-2xl text-sm leading-6 text-white/65">{statusMeta.description}</p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleConnect}
                  disabled={isConnecting || isDisconnecting}
                  className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isConnecting ? <LoaderCircle size={16} className="animate-spin" /> : <Smartphone size={16} />}
                  {session.status === 'CONNECTED' ? 'Gerar novo pareamento' : 'Conectar numero'}
                </button>

                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={session.status === 'DISCONNECTED' || isDisconnecting}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isDisconnecting ? <LoaderCircle size={16} className="animate-spin" /> : <WifiOff size={16} />}
                  Desconectar
                </button>
              </div>
            </div>

            {feedback && (
              <div className="mt-5 rounded-2xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
                {feedback}
              </div>
            )}

            {session.lastError && (
              <div className="mt-5 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                Ultimo erro: {session.lastError}
              </div>
            )}

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <InfoCard label="Instancia" value={session.id ?? 'default'} />
              <InfoCard label="Numero" value={session.phoneNumber ?? 'Nao conectado'} />
              <InfoCard label="Nome exibido" value={session.displayName ?? 'Nao disponivel'} />
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
              <div className="rounded-3xl border border-dashed border-white/12 bg-background/40 p-5">
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-2xl bg-white/5 p-3">
                    <QrCode size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold">QR Code</h3>
                    <p className="text-sm text-white/55">
                      O codigo aparece aqui assim que o backend gerar a sessao.
                    </p>
                  </div>
                </div>

                <div className="flex min-h-80 items-center justify-center rounded-[22px] border border-white/8 bg-white p-4">
                  {isLoadingSession ? (
                    <LoaderCircle className="animate-spin text-slate-700" size={28} />
                  ) : session.qrCodeDataUrl ? (
                    <img
                      src={session.qrCodeDataUrl ?? undefined}
                      alt="QR Code para conectar o WhatsApp"
                      className="h-auto w-full max-w-[260px]"
                    />
                  ) : (
                    <div className="space-y-3 px-5 text-center text-slate-600">
                      <p className="font-semibold">Nenhum QR Code disponivel.</p>
                      <p className="text-sm leading-6">
                        Clique em <strong>Conectar numero</strong> para iniciar o pareamento.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-3xl border border-white/8 bg-white/3 p-5">
                  <h3 className="text-lg font-semibold">Resumo da sessao</h3>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <SummaryItem
                      label="Estado atual"
                      value={statusMeta.label}
                      hint={session.status === 'CONNECTED' ? 'Pronto para uso' : 'Aguardando acao'}
                    />
                    <SummaryItem
                      label="Atualizacao"
                      value={isAwaitingConnection ? 'Monitorando em tempo real' : 'Sincronizado'}
                      hint={isAwaitingConnection ? 'Socket + polling ativo' : 'Sem reconexao pendente'}
                    />
                    <SummaryItem
                      label="QR ativo"
                      value={session.qrCodeDataUrl ? 'Sim' : 'Nao'}
                      hint={session.qrCodeDataUrl ? 'Escaneie pelo app do WhatsApp' : 'Gere um novo QR quando precisar'}
                    />
                    <SummaryItem
                      label="Pareamento"
                      value={session.phoneNumber ?? 'Sem numero'}
                      hint={session.displayName ?? 'Nenhum aparelho conectado'}
                    />
                  </div>
                </div>

                <div className="rounded-3xl border border-white/8 bg-white/3 p-5">
                  <h3 className="text-lg font-semibold">O que esta pronto nesta tela</h3>
                  <ul className="mt-4 space-y-3 text-sm leading-6 text-white/70">
                    <li className="rounded-2xl border border-white/8 bg-background/30 px-4 py-3">
                      Consulta do status atual da sessao via API.
                    </li>
                    <li className="rounded-2xl border border-white/8 bg-background/30 px-4 py-3">
                      Inicio do pareamento e exibicao do QR Code.
                    </li>
                    <li className="rounded-2xl border border-white/8 bg-background/30 px-4 py-3">
                      Atualizacao em tempo real por socket para QR, conexao e desconexao.
                    </li>
                    <li className="rounded-2xl border border-white/8 bg-background/30 px-4 py-3">
                      Encerramento da sessao atual para trocar de numero ou reautenticar.
                    </li>
                  </ul>
                </div>

                <div className="rounded-3xl border border-white/8 bg-white/3 p-5">
                  <h3 className="text-lg font-semibold">Motivos de encerramento</h3>
                  <p className="mt-2 text-sm leading-6 text-white/60">
                    Cadastre aqui os motivos que aparecem na modal de encerramento do atendimento.
                  </p>

                  <div className="mt-4 flex gap-3">
                    <input
                      value={newCloseReason}
                      onChange={(event) => setNewCloseReason(event.target.value)}
                      placeholder="Novo motivo de encerramento"
                      className="w-full rounded-2xl border border-white/10 bg-background/30 px-4 py-3 text-sm outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddCloseReason}
                      disabled={isSavingCloseReason || !newCloseReason.trim()}
                      className="shrink-0 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                    >
                      {isSavingCloseReason ? 'Salvando...' : 'Adicionar'}
                    </button>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    {closeReasons.map((reason) => (
                      <div
                        key={reason}
                        className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-background/30 px-4 py-2 text-sm"
                      >
                        <span>{reason}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveCloseReason(reason)}
                          disabled={isRemovingCloseReason === reason}
                          className="text-white/50 transition hover:text-white disabled:opacity-40 cursor-pointer"
                        >
                          {isRemovingCloseReason === reason ? '...' : 'x'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-white/8 bg-white/3 p-5">
                  <h3 className="text-lg font-semibold">Tags padronizadas de clientes</h3>
                  <p className="mt-2 text-sm leading-6 text-white/60">
                    Cadastre as tags disponiveis para vincular nos atendimentos, sem escrita livre.
                  </p>

                  <div className="mt-4 flex gap-3">
                    <input
                      value={newContactTag}
                      onChange={(event) => setNewContactTag(event.target.value)}
                      placeholder="Nova tag"
                      className="w-full rounded-2xl border border-white/10 bg-background/30 px-4 py-3 text-sm outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddContactTag}
                      disabled={isSavingContactTag || !newContactTag.trim()}
                      className="shrink-0 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                    >
                      {isSavingContactTag ? 'Salvando...' : 'Adicionar'}
                    </button>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    {contactTags.map((tag) => (
                      <div
                        key={tag}
                        className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-background/30 px-4 py-2 text-sm"
                      >
                        <span>{tag}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveContactTag(tag)}
                          disabled={isRemovingContactTag === tag}
                          className="text-white/50 transition hover:text-white disabled:opacity-40 cursor-pointer"
                        >
                          {isRemovingContactTag === tag ? '...' : 'x'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </article>
        </section>
        )}
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/3 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/45">{label}</p>
      <p className="mt-3 truncate text-sm font-medium text-white/90">{value}</p>
    </div>
  );
}

function SummaryItem({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-background/30 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/45">{label}</p>
      <p className="mt-2 text-sm font-semibold text-white/90">{value}</p>
      <p className="mt-1 text-xs leading-5 text-white/50">{hint}</p>
    </div>
  );
}

function formatKnowledgeFileSize(sizeBytes?: number | null) {
  const size = Number(sizeBytes ?? 0);
  if (!Number.isFinite(size) || size <= 0) return 'Sem tamanho';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatKnowledgeDate(value?: string | null) {
  if (!value) return 'Sem data';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sem data';

  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type SettingsTabbedSectionsProps = {
  user: AuthUser | null;
  isLoadingUser: boolean;
  isAdmin: boolean;
  session: WhatsAppSession;
  statusMeta: { label: string; badgeClass: string; description: string };
  isLoadingSession: boolean;
  isAwaitingConnection: boolean;
  isConnecting: boolean;
  isDisconnecting: boolean;
  isLoggingOut: boolean;
  feedback: string | null;
  connectionSteps: string[];
  closeReasons: string[];
  newCloseReason: string;
  setNewCloseReason: (value: string) => void;
  isSavingCloseReason: boolean;
  isRemovingCloseReason: string | null;
  handleAddCloseReason: () => Promise<void>;
  handleRemoveCloseReason: (reason: string) => Promise<void>;
  contactTags: string[];
  newContactTag: string;
  setNewContactTag: (value: string) => void;
  isSavingContactTag: boolean;
  isRemovingContactTag: string | null;
  handleAddContactTag: () => Promise<void>;
  handleRemoveContactTag: (tag: string) => Promise<void>;
  aiAgentConfig: WhatsAppAiAgentConfig;
  knowledgeItems: WhatsAppAiKnowledgeItem[];
  distributionConfig: WhatsAppDistributionConfig;
  isLoadingAiAgentConfig: boolean;
  isSavingAiAgentConfig: boolean;
  isLoadingKnowledgeItems: boolean;
  isCreatingKnowledgeItem: boolean;
  isUploadingKnowledgeItem: boolean;
  isSavingKnowledgeItemId: string | null;
  isRemovingKnowledgeItemId: string | null;
  isLoadingDistributionConfig: boolean;
  isSavingDistributionConfig: boolean;
  handleAiAgentConfigChange: (
    patch:
      | Partial<WhatsAppAiAgentConfig>
      | ((current: WhatsAppAiAgentConfig) => Partial<WhatsAppAiAgentConfig>)
  ) => void;
  newKnowledgeTitle: string;
  setNewKnowledgeTitle: (value: string) => void;
  newKnowledgeContent: string;
  setNewKnowledgeContent: (value: string) => void;
  newKnowledgeAlwaysInclude: boolean;
  setNewKnowledgeAlwaysInclude: (value: boolean) => void;
  newKnowledgeUploadTitle: string;
  setNewKnowledgeUploadTitle: (value: string) => void;
  newKnowledgeUploadAlwaysInclude: boolean;
  setNewKnowledgeUploadAlwaysInclude: (value: boolean) => void;
  knowledgeFileInputRef: React.RefObject<HTMLInputElement | null>;
  handleKnowledgeItemChange: (
    itemId: string,
    patch:
      | Partial<WhatsAppAiKnowledgeItem>
      | ((current: WhatsAppAiKnowledgeItem) => Partial<WhatsAppAiKnowledgeItem>)
  ) => void;
  handleCreateKnowledgeManualItem: () => Promise<void>;
  handleKnowledgeFileSelected: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleSaveKnowledgeItem: (itemId: string) => Promise<void>;
  handleDeleteKnowledgeItem: (itemId: string) => Promise<void>;
  handleDistributionConfigChange: (
    patch:
      | Partial<WhatsAppDistributionConfig>
      | ((current: WhatsAppDistributionConfig) => Partial<WhatsAppDistributionConfig>)
  ) => void;
  handleSaveAiAgentConfig: () => Promise<void>;
  handleSaveDistributionConfig: () => Promise<void>;
  handleConnect: () => Promise<void>;
  handleDisconnect: () => Promise<void>;
  openLogoutDialog: () => void;
};

function SettingsTabbedSections({
  user,
  isLoadingUser,
  isAdmin,
  session,
  statusMeta,
  isLoadingSession,
  isAwaitingConnection,
  isConnecting,
  isDisconnecting,
  isLoggingOut,
  feedback,
  connectionSteps,
  closeReasons,
  newCloseReason,
  setNewCloseReason,
  isSavingCloseReason,
  isRemovingCloseReason,
  handleAddCloseReason,
  handleRemoveCloseReason,
  contactTags,
  newContactTag,
  setNewContactTag,
  isSavingContactTag,
  isRemovingContactTag,
  handleAddContactTag,
  handleRemoveContactTag,
  aiAgentConfig,
  knowledgeItems,
  distributionConfig,
  isLoadingAiAgentConfig,
  isSavingAiAgentConfig,
  isLoadingKnowledgeItems,
  isCreatingKnowledgeItem,
  isUploadingKnowledgeItem,
  isSavingKnowledgeItemId,
  isRemovingKnowledgeItemId,
  isLoadingDistributionConfig,
  isSavingDistributionConfig,
  handleAiAgentConfigChange,
  newKnowledgeTitle,
  setNewKnowledgeTitle,
  newKnowledgeContent,
  setNewKnowledgeContent,
  newKnowledgeAlwaysInclude,
  setNewKnowledgeAlwaysInclude,
  newKnowledgeUploadTitle,
  setNewKnowledgeUploadTitle,
  newKnowledgeUploadAlwaysInclude,
  setNewKnowledgeUploadAlwaysInclude,
  knowledgeFileInputRef,
  handleKnowledgeItemChange,
  handleCreateKnowledgeManualItem,
  handleKnowledgeFileSelected,
  handleSaveKnowledgeItem,
  handleDeleteKnowledgeItem,
  handleDistributionConfigChange,
  handleSaveAiAgentConfig,
  handleSaveDistributionConfig,
  handleConnect,
  handleDisconnect,
  openLogoutDialog,
}: SettingsTabbedSectionsProps) {
  const userInitials = user?.name?.slice(0, 2)?.toUpperCase() ?? 'US';
  const providerLabel = aiAgentConfig.provider === 'openai' ? 'OpenAI' : 'Gemini';
  const activeProviderSettings =
    aiAgentConfig.provider === 'openai' ? aiAgentConfig.openai : aiAgentConfig.gemini;
  const activeProviderCredentials =
    aiAgentConfig.credentials?.[aiAgentConfig.provider] ?? {
      hasApiKey: false,
      usesStoredApiKey: false,
    };
  const activeProviderModelPresets = WHATSAPP_AI_MODEL_PRESETS[aiAgentConfig.provider];
  const activeModelPreset =
    activeProviderModelPresets.find((preset) => preset.value === activeProviderSettings.model) ?? null;
  const isUsingCustomModel = !activeModelPreset;
  const activeDelayLabel = formatAiResponseDelay(aiAgentConfig.responseDelayMs);
  const hasPendingProviderKey = Boolean(activeProviderSettings.apiKey.trim());
  const isRemovingStoredProviderKey = Boolean(activeProviderSettings.clearApiKey);
  const willKeepProviderApiKey =
    hasPendingProviderKey || (activeProviderCredentials.hasApiKey && !isRemovingStoredProviderKey);
  const activeProviderCredentialMessage = hasPendingProviderKey
    ? 'Uma nova chave sera enviada criptografada e salva apenas no backend quando voce clicar em Salvar.'
    : isRemovingStoredProviderKey
      ? 'A chave salva para este provedor sera removida quando voce salvar.'
      : activeProviderCredentials.hasApiKey
        ? activeProviderCredentials.usesStoredApiKey
          ? 'Existe uma chave salva no backend para este provedor. Ela nao volta para o navegador.'
          : 'Nenhuma chave salva no sistema, mas o backend encontrou uma chave no ambiente.'
        : 'Nenhuma chave encontrada para o provedor selecionado.';
  const aiBlockingReasons = !aiAgentConfig.enabled
    ? ['As respostas automaticas estao desligadas.']
    : [
        ...(activeProviderSettings.model.trim()
          ? []
          : [`Informe um modelo para ${providerLabel}.`]),
        ...(willKeepProviderApiKey ? [] : [`Informe uma chave de API para ${providerLabel}.`]),
        ...(session.status === 'CONNECTED'
          ? []
          : ['O WhatsApp precisa estar conectado para a IA conseguir enviar a resposta.']),
      ];
  const aiOperationalNotes = [
    `A IA aguarda ${activeDelayLabel} de silencio apos a ultima mensagem do cliente. Se chegar outra mensagem antes disso, o tempo reinicia.`,
    'Depois desse silencio, o envio simula digitacao com base no tamanho real da resposta.',
    aiAgentConfig.onlyUnassignedConversations
      ? 'So responde conversas sem atendente atribuido.'
      : 'Pode responder mesmo em conversas ja atribuidas.',
    aiAgentConfig.replyToGroups
      ? 'Tambem responde mensagens recebidas em grupos.'
      : 'Ignora grupos e responde apenas conversas individuais.',
  ];
  const aiOperationalState = !aiAgentConfig.enabled
    ? {
        label: 'Automacao desligada',
        badgeClass: 'border border-white/10 bg-white/5 text-white/75',
      }
    : aiBlockingReasons.length > 0
      ? {
          label: 'Precisa de ajuste',
          badgeClass: 'border border-amber-500/25 bg-amber-500/15 text-amber-100',
        }
      : {
          label: 'Pronto para responder',
          badgeClass: 'border border-emerald-500/25 bg-emerald-500/15 text-emerald-100',
        };
  const newConversationDistributionLabel =
    distributionConfig.newConversations.strategy === 'online_round_robin'
      ? 'Circular entre online'
      : 'Fila manual';
  const queueDistributionLabel =
    distributionConfig.queueTransfers.strategy === 'online_round_robin'
      ? 'Circular entre online'
      : distributionConfig.queueTransfers.strategy === 'online_random'
        ? 'Aleatorio entre online'
        : 'Permanece na fila';
  const activeKnowledgeCount = knowledgeItems.filter((item) => item.enabled).length;
  const pinnedKnowledgeCount = knowledgeItems.filter((item) => item.alwaysInclude).length;

  return (
    <section className="rounded-3xl border border-white/10 bg-card p-6 shadow-[0_12px_50px_rgba(0,0,0,0.14)]">
      <Tabs defaultValue="whatsapp" className="gap-6">
        <div className="flex flex-col gap-5 border-b border-white/8 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold">Configuracoes separadas por area</h2>
            <p className="max-w-2xl text-sm leading-6 text-white/60">
              Alterne entre usuario, WhatsApp e sistema para manter cada grupo de configuracoes no
              contexto certo.
            </p>
          </div>

          <TabsList className="h-auto w-full flex-wrap justify-start gap-2 rounded-2xl bg-white/5 p-1 lg:w-auto">
            <TabsTrigger
              value="usuario"
              className="cursor-pointer rounded-xl px-4 py-2 text-white data-[state=active]:bg-white data-[state=active]:text-slate-900"
            >
              <UserRound size={16} />
              Usuario
            </TabsTrigger>
            <TabsTrigger
              value="whatsapp"
              className="cursor-pointer rounded-xl px-4 py-2 text-white data-[state=active]:bg-white data-[state=active]:text-slate-900"
            >
              <Smartphone size={16} />
              WhatsApp
            </TabsTrigger>
            <TabsTrigger
              value="sistema"
              className="cursor-pointer rounded-xl px-4 py-2 text-white data-[state=active]:bg-white data-[state=active]:text-slate-900"
            >
              <Settings2 size={16} />
              Sistema
            </TabsTrigger>
          </TabsList>
        </div>

        {feedback && (
          <div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
            {feedback}
          </div>
        )}

        <TabsContent value="usuario">
          <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
            <article className="rounded-3xl border border-white/10 bg-background/30 p-6 shadow-[0_12px_50px_rgba(0,0,0,0.14)]">
              <div className="mb-6 flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-amber-400 text-xl font-bold text-black">
                  {userInitials}
                </div>

                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/45">
                    Usuario logado
                  </p>
                  {isLoadingUser ? (
                    <div className="mt-2 h-5 w-32 animate-pulse rounded bg-white/10" />
                  ) : (
                    <>
                      <h3 className="truncate text-xl font-semibold">{user?.name ?? 'Sem nome'}</h3>
                      <p className="truncate text-sm text-white/55">{user?.email ?? 'Sem e-mail'}</p>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-white/8 bg-white/3 p-4 text-sm text-white/70">
                <p>Este bloco concentra a sessao do usuario autenticado.</p>
                <p>Use esta aba para revisar a conta ativa antes de alterar operacao ou conexoes.</p>
              </div>
            </article>

            <div className="space-y-6">
              <article className="rounded-3xl border border-white/10 bg-background/30 p-6 shadow-[0_12px_50px_rgba(0,0,0,0.14)]">
                <div className="flex flex-col gap-4 border-b border-white/8 pb-5 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">Sessao da conta</h3>
                    <p className="mt-2 text-sm leading-6 text-white/60">
                      Controle o acesso da conta atual ao painel.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={openLogoutDialog}
                    disabled={isLoggingOut}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-100 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <LogOut size={16} />
                    {isLoggingOut ? 'Saindo...' : 'Sair da conta'}
                  </button>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <InfoCard label="Nome" value={user?.name ?? 'Sem nome'} />
                  <InfoCard label="E-mail" value={user?.email ?? 'Sem e-mail'} />
                </div>
              </article>

              <article className="rounded-3xl border border-white/10 bg-background/30 p-6 shadow-[0_12px_50px_rgba(0,0,0,0.14)]">
                <h3 className="text-lg font-semibold">Acesso rapido</h3>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <SummaryItem
                    label="Usuario"
                    value="Conta ativa"
                    hint="Dados da sessao autenticada e controle de logout."
                  />
                  <SummaryItem
                    label="WhatsApp"
                    value={statusMeta.label}
                    hint="Pareamento, QR Code e reconexao da linha."
                  />
                  <SummaryItem
                    label="Sistema"
                    value="IA, filas e padroes"
                    hint="Automacao, distribuicao da fila e listas padronizadas."
                  />
                </div>
              </article>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="whatsapp">
          <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
            <div className="space-y-6">
              <article className="rounded-3xl border border-white/10 bg-background/30 p-6 shadow-[0_12px_50px_rgba(0,0,0,0.14)]">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-white/5 p-3">
                    {session.status === 'CONNECTED' ? <Wifi size={20} /> : <WifiOff size={20} />}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Etapas da conexao</h3>
                    <p className="text-sm text-white/55">{statusMeta.description}</p>
                  </div>
                </div>

                <ul className="mt-5 space-y-3 text-sm text-white/70">
                  {connectionSteps.map((step) => (
                    <li
                      key={step}
                      className="rounded-2xl border border-white/8 bg-white/3 px-4 py-3 leading-6"
                    >
                      {step}
                    </li>
                  ))}
                </ul>
              </article>
            </div>

            <article className="rounded-3xl border border-white/10 bg-background/30 p-6 shadow-[0_12px_50px_rgba(0,0,0,0.14)]">
              <div className="flex flex-col gap-5 border-b border-white/8 pb-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-2xl font-semibold">Sessao do WhatsApp</h3>
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusMeta.badgeClass}`}
                    >
                      {statusMeta.label}
                    </span>
                  </div>
                  <p className="max-w-2xl text-sm leading-6 text-white/65">{statusMeta.description}</p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleConnect}
                    disabled={isConnecting || isDisconnecting}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isConnecting ? (
                      <LoaderCircle size={16} className="animate-spin" />
                    ) : (
                      <Smartphone size={16} />
                    )}
                    {session.status === 'CONNECTED' ? 'Gerar novo pareamento' : 'Conectar numero'}
                  </button>

                  <button
                    type="button"
                    onClick={handleDisconnect}
                    disabled={session.status === 'DISCONNECTED' || isDisconnecting}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isDisconnecting ? (
                      <LoaderCircle size={16} className="animate-spin" />
                    ) : (
                      <WifiOff size={16} />
                    )}
                    Desconectar
                  </button>
                </div>
              </div>

              {session.lastError && (
                <div className="mt-5 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                  Ultimo erro: {session.lastError}
                </div>
              )}

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <InfoCard label="Instancia" value={session.id ?? 'default'} />
                <InfoCard label="Numero" value={session.phoneNumber ?? 'Nao conectado'} />
                <InfoCard label="Nome exibido" value={session.displayName ?? 'Nao disponivel'} />
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
                <div className="rounded-3xl border border-dashed border-white/12 bg-card p-5">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="rounded-2xl bg-white/5 p-3">
                      <QrCode size={20} />
                    </div>
                    <div>
                      <h4 className="font-semibold">QR Code</h4>
                      <p className="text-sm text-white/55">
                        O codigo aparece aqui assim que o backend gerar a sessao.
                      </p>
                    </div>
                  </div>

                  <div className="flex min-h-80 items-center justify-center rounded-[22px] border border-white/8 bg-white p-4">
                    {isLoadingSession ? (
                      <LoaderCircle className="animate-spin text-slate-700" size={28} />
                    ) : session.qrCodeDataUrl ? (
                      <img
                        src={session.qrCodeDataUrl ?? undefined}
                        alt="QR Code para conectar o WhatsApp"
                        className="h-auto w-full max-w-[260px]"
                      />
                    ) : (
                      <div className="space-y-3 px-5 text-center text-slate-600">
                        <p className="font-semibold">Nenhum QR Code disponivel.</p>
                        <p className="text-sm leading-6">
                          Clique em <strong>Conectar numero</strong> para iniciar o pareamento.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-3xl border border-white/8 bg-white/3 p-5">
                    <h4 className="text-lg font-semibold">Resumo da sessao</h4>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <SummaryItem
                        label="Estado atual"
                        value={statusMeta.label}
                        hint={session.status === 'CONNECTED' ? 'Pronto para uso' : 'Aguardando acao'}
                      />
                      <SummaryItem
                        label="Atualizacao"
                        value={isAwaitingConnection ? 'Monitorando em tempo real' : 'Sincronizado'}
                        hint={isAwaitingConnection ? 'Socket + polling ativo' : 'Sem reconexao pendente'}
                      />
                      <SummaryItem
                        label="QR ativo"
                        value={session.qrCodeDataUrl ? 'Sim' : 'Nao'}
                        hint={
                          session.qrCodeDataUrl
                            ? 'Escaneie pelo app do WhatsApp'
                            : 'Gere um novo QR quando precisar'
                        }
                      />
                      <SummaryItem
                        label="Pareamento"
                        value={session.phoneNumber ?? 'Sem numero'}
                        hint={session.displayName ?? 'Nenhum aparelho conectado'}
                      />
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/8 bg-white/3 p-5">
                    <h4 className="text-lg font-semibold">O que esta pronto nesta area</h4>
                    <ul className="mt-4 space-y-3 text-sm leading-6 text-white/70">
                      <li className="rounded-2xl border border-white/8 bg-background/30 px-4 py-3">
                        Consulta do status atual da sessao via API.
                      </li>
                      <li className="rounded-2xl border border-white/8 bg-background/30 px-4 py-3">
                        Inicio do pareamento e exibicao do QR Code.
                      </li>
                      <li className="rounded-2xl border border-white/8 bg-background/30 px-4 py-3">
                        Atualizacao em tempo real por socket para QR, conexao e desconexao.
                      </li>
                      <li className="rounded-2xl border border-white/8 bg-background/30 px-4 py-3">
                        Encerramento da sessao atual para trocar de numero ou reautenticar.
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </article>
          </div>
        </TabsContent>

        <TabsContent value="sistema">
          <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
            <article className="rounded-3xl border border-white/10 bg-background/30 p-6 shadow-[0_12px_50px_rgba(0,0,0,0.14)]">
              <h3 className="text-lg font-semibold">Central operacional</h3>
              <p className="mt-3 text-sm leading-6 text-white/60">
                Separe aqui o que pertence a IA, o que pertence a filas e o que pertence aos
                padroes gerais do atendimento.
              </p>

              <div className="mt-6 grid gap-4">
                <SummaryItem
                  label="Motivos"
                  value={String(closeReasons.length)}
                  hint="Opcoes exibidas ao encerrar um atendimento."
                />
                <SummaryItem
                  label="Tags"
                  value={String(contactTags.length)}
                  hint="Etiquetas disponiveis para vincular aos clientes."
                />
                <SummaryItem
                  label="IA"
                  value={aiAgentConfig.enabled ? 'Ativo' : 'Inativo'}
                  hint={
                    isAdmin
                      ? `${providerLabel} ${activeProviderCredentials.hasApiKey ? 'configurado' : 'sem chave'}`
                      : 'Disponivel apenas para administradores'
                  }
                />
                <SummaryItem
                  label="Base IA"
                  value={String(activeKnowledgeCount)}
                  hint={`${pinnedKnowledgeCount} item(ns) fixo(s) sempre incluido(s) no prompt.`}
                />
                <SummaryItem
                  label="Filas"
                  value={newConversationDistributionLabel}
                  hint={`${queueDistributionLabel} quando voltar para a fila.`}
                />
              </div>
            </article>

            <div className="space-y-6">
              <Tabs defaultValue="ia" className="space-y-6">
                <article className="rounded-3xl border border-white/10 bg-background/30 p-5 shadow-[0_12px_50px_rgba(0,0,0,0.14)]">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">Configuracoes por bloco</h3>
                      <p className="mt-2 text-sm leading-6 text-white/60">
                        Separe o que controla a IA, as filas e os padroes gerais para reduzir ruido
                        na operacao.
                      </p>
                    </div>

                    <TabsList className="h-auto w-full flex-wrap justify-start gap-2 rounded-2xl bg-white/5 p-1 lg:w-auto">
                      <TabsTrigger
                        value="ia"
                        className="cursor-pointer rounded-xl px-4 py-2 text-white data-[state=active]:bg-white data-[state=active]:text-slate-900"
                      >
                        IA
                      </TabsTrigger>
                      <TabsTrigger
                        value="filas"
                        className="cursor-pointer rounded-xl px-4 py-2 text-white data-[state=active]:bg-white data-[state=active]:text-slate-900"
                      >
                        Filas
                      </TabsTrigger>
                      <TabsTrigger
                        value="padroes"
                        className="cursor-pointer rounded-xl px-4 py-2 text-white data-[state=active]:bg-white data-[state=active]:text-slate-900"
                      >
                        Padroes
                      </TabsTrigger>
                    </TabsList>
                  </div>
                </article>

                <TabsContent value="ia" className="mt-0 space-y-6">
              <article className="rounded-3xl border border-white/10 bg-background/30 p-5 shadow-[0_12px_50px_rgba(0,0,0,0.14)]">
                <div className="flex flex-col gap-4 border-b border-white/8 pb-5 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">Agente IA do WhatsApp</h3>
                    <p className="mt-2 text-sm leading-6 text-white/60">
                      Escolha o provedor, defina o modelo e escreva o prompt operacional usado para
                      responder automaticamente os clientes.
                    </p>
                  </div>

                  <span
                    className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold ${
                      aiAgentConfig.enabled
                        ? 'border border-emerald-500/25 bg-emerald-500/15 text-emerald-200'
                        : 'border border-white/10 bg-white/5 text-white/70'
                    }`}
                  >
                    {aiAgentConfig.enabled ? 'Agente ativo' : 'Agente inativo'}
                  </span>
                </div>

                {!isAdmin ? (
                  <div className="mt-5 rounded-2xl border border-white/8 bg-white/3 px-4 py-4 text-sm leading-6 text-white/70">
                    Somente usuarios administradores podem alterar a configuracao do agente IA.
                  </div>
                ) : (
                  <div className="mt-5 space-y-5">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-2xl border border-white/8 bg-white/3 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/45">
                          Automacao
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            handleAiAgentConfigChange((current) => ({
                              enabled: !current.enabled,
                            }))
                          }
                          className={`mt-3 inline-flex cursor-pointer items-center rounded-full px-4 py-2 text-sm font-medium transition ${
                            aiAgentConfig.enabled
                              ? 'border border-emerald-500/25 bg-emerald-500/15 text-emerald-100'
                              : 'border border-white/10 bg-background/30 text-white/75 hover:bg-white/10'
                          }`}
                        >
                          {aiAgentConfig.enabled ? 'Respostas automaticas ligadas' : 'Respostas automaticas desligadas'}
                        </button>
                        <p className="mt-3 text-sm leading-6 text-white/55">
                          Quando ativo, o sistema responde sozinho nas conversas que seguirem as regras abaixo.
                        </p>
                      </div>

                      <div className="rounded-2xl border border-white/8 bg-white/3 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/45">
                          Provedor
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {(['openai', 'gemini'] as const).map((providerOption) => {
                            const isActive = aiAgentConfig.provider === providerOption;
                            return (
                              <button
                                key={providerOption}
                                type="button"
                                onClick={() =>
                                  handleAiAgentConfigChange({
                                    provider: providerOption,
                                  })
                                }
                                className={`cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition ${
                                  isActive
                                    ? 'bg-white text-slate-900'
                                    : 'border border-white/10 bg-background/30 text-white/75 hover:bg-white/10'
                                }`}
                              >
                                {providerOption === 'openai' ? 'OpenAI' : 'Gemini'}
                              </button>
                            );
                          })}
                        </div>
                        <p className="mt-3 text-sm leading-6 text-white/55">
                          Provedor ativo: <span className="font-semibold text-white/90">{providerLabel}</span>
                        </p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/8 bg-white/3 p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/45">
                            Estado operacional
                          </p>
                          <p className="mt-2 text-sm leading-6 text-white/60">
                            Confira aqui se a IA esta pronta para responder e qual tempo sera
                            aguardado antes do envio.
                          </p>
                        </div>

                        <span
                          className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold ${aiOperationalState.badgeClass}`}
                        >
                          {aiOperationalState.label}
                        </span>
                      </div>

                      <div className="mt-4 grid gap-4 md:grid-cols-3">
                        <SummaryItem
                          label="Provedor ativo"
                          value={providerLabel}
                          hint={activeProviderCredentials.hasApiKey ? 'Chave disponivel' : 'Chave pendente'}
                        />
                        <SummaryItem
                          label="Modelo"
                          value={activeProviderSettings.model || 'Nao definido'}
                          hint={
                            activeModelPreset?.description ??
                            'Modelo personalizado informado manualmente.'
                          }
                        />
                        <SummaryItem
                          label="Delay efetivo"
                          value={activeDelayLabel}
                          hint="Contado apos a ultima mensagem do cliente."
                        />
                      </div>

                      {aiBlockingReasons.length > 0 ? (
                        <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-4 text-sm text-amber-100">
                          <p className="font-semibold">O que ainda bloqueia a resposta automatica</p>
                          <ul className="mt-3 space-y-2 leading-6 text-amber-50/90">
                            {aiBlockingReasons.map((reason) => (
                              <li
                                key={reason}
                                className="rounded-2xl border border-amber-500/15 bg-black/10 px-3 py-2"
                              >
                                {reason}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        {aiOperationalNotes.map((note) => (
                          <div
                            key={note}
                            className="rounded-2xl border border-white/8 bg-background/30 px-4 py-3 text-sm leading-6 text-white/70"
                          >
                            {note}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="space-y-2 text-sm text-white/75">
                        <span className="block text-xs font-semibold uppercase tracking-[0.24em] text-white/45">
                          Nome do agente
                        </span>
                        <input
                          value={aiAgentConfig.agentName}
                          onChange={(event) =>
                            handleAiAgentConfigChange({
                              agentName: event.target.value,
                            })
                          }
                          placeholder="Ex.: Assistente comercial"
                          className="w-full rounded-2xl border border-white/10 bg-background/30 px-4 py-3 text-sm outline-none"
                        />
                      </label>

                      <label className="space-y-2 text-sm text-white/75">
                        <span className="block text-xs font-semibold uppercase tracking-[0.24em] text-white/45">
                          Modelo ativo
                        </span>
                        <select
                          value={activeModelPreset?.value ?? CUSTOM_MODEL_OPTION}
                          onChange={(event) =>
                            handleAiAgentConfigChange((current) =>
                              event.target.value === CUSTOM_MODEL_OPTION
                                ? {
                                    [current.provider]: {
                                      ...(current[current.provider] as WhatsAppAiAgentConfig['openai']),
                                      model: '',
                                    },
                                  }
                                : {
                                    [current.provider]: {
                                      ...(current[current.provider] as WhatsAppAiAgentConfig['openai']),
                                      model: event.target.value,
                                    },
                                  }
                            )
                          }
                          className="w-full rounded-2xl border border-white/10 bg-background/30 px-4 py-3 text-sm outline-none"
                        >
                          {activeProviderModelPresets.map((preset) => (
                            <option key={preset.value} value={preset.value}>
                              {preset.label} ({preset.value})
                            </option>
                          ))}
                          <option value={CUSTOM_MODEL_OPTION}>Outro modelo manual</option>
                        </select>
                        <p className="text-xs leading-5 text-white/45">
                          {activeModelPreset
                            ? `${activeModelPreset.description} Valor enviado ao backend: ${activeModelPreset.value}.`
                            : 'Use um valor manual se quiser testar um modelo ainda nao listado nos presets.'}
                        </p>
                        {isUsingCustomModel ? (
                          <input
                            value={activeProviderSettings.model}
                            onChange={(event) =>
                              handleAiAgentConfigChange((current) => ({
                                [current.provider]: {
                                  ...(current[current.provider] as WhatsAppAiAgentConfig['openai']),
                                  model: event.target.value,
                                },
                              }))
                            }
                            placeholder={
                              aiAgentConfig.provider === 'openai'
                                ? 'gpt-4o-mini'
                                : 'gemini-2.5-flash'
                            }
                            className="w-full rounded-2xl border border-white/10 bg-background/30 px-4 py-3 text-sm outline-none"
                          />
                        ) : null}
                      </label>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="space-y-2 text-sm text-white/75">
                        <span className="block text-xs font-semibold uppercase tracking-[0.24em] text-white/45">
                          Chave da API
                        </span>
                        <input
                          type="password"
                          value={activeProviderSettings.apiKey}
                          onChange={(event) =>
                            handleAiAgentConfigChange((current) => ({
                              [current.provider]: {
                                ...(current[current.provider] as WhatsAppAiAgentConfig['openai']),
                                apiKey: event.target.value,
                                clearApiKey: false,
                              },
                            }))
                          }
                          autoComplete="new-password"
                          placeholder={
                            aiAgentConfig.provider === 'openai'
                              ? 'sk-...'
                              : 'AIza...'
                          }
                          className="w-full rounded-2xl border border-white/10 bg-background/30 px-4 py-3 text-sm outline-none"
                        />
                        <p className="text-xs leading-5 text-white/45">
                          {activeProviderCredentialMessage}
                        </p>
                        <div className="flex flex-wrap gap-2 pt-1">
                          {activeProviderCredentials.usesStoredApiKey &&
                          !hasPendingProviderKey &&
                          !isRemovingStoredProviderKey ? (
                            <button
                              type="button"
                              onClick={() =>
                                handleAiAgentConfigChange((current) => ({
                                  [current.provider]: {
                                    ...(current[current.provider] as WhatsAppAiAgentConfig['openai']),
                                    apiKey: '',
                                    clearApiKey: true,
                                  },
                                }))
                              }
                              className="cursor-pointer rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-100 transition hover:bg-rose-500/20"
                            >
                              Remover chave salva
                            </button>
                          ) : null}

                          {isRemovingStoredProviderKey ? (
                            <button
                              type="button"
                              onClick={() =>
                                handleAiAgentConfigChange((current) => ({
                                  [current.provider]: {
                                    ...(current[current.provider] as WhatsAppAiAgentConfig['openai']),
                                    clearApiKey: false,
                                  },
                                }))
                              }
                              className="cursor-pointer rounded-full border border-white/10 bg-background/30 px-3 py-1 text-xs font-medium text-white/75 transition hover:bg-white/10"
                            >
                              Cancelar remocao
                            </button>
                          ) : null}
                        </div>
                      </label>

                      <div className="grid gap-4 sm:grid-cols-4">
                        <label className="space-y-2 text-sm text-white/75 sm:col-span-2">
                          <span className="block text-xs font-semibold uppercase tracking-[0.24em] text-white/45">
                            Janela de silencio antes de digitar
                          </span>
                          <input
                            type="number"
                            min={0}
                            max={15000}
                            value={aiAgentConfig.responseDelayMs}
                            onChange={(event) =>
                              handleAiAgentConfigChange({
                                responseDelayMs: Number(event.target.value),
                              })
                            }
                            className="w-full rounded-2xl border border-white/10 bg-background/30 px-4 py-3 text-sm outline-none"
                          />
                          <p className="text-xs leading-5 text-white/45">
                            A IA aguarda <span className="font-semibold text-white/85">{activeDelayLabel}</span>{' '}
                            de silencio apos a ultima mensagem do cliente. Depois disso, o sistema
                            calcula a digitacao pelo tamanho do texto antes de enviar.
                          </p>
                          <div className="flex flex-wrap gap-2 pt-1">
                            {AI_DELAY_PRESETS.map((delayPreset) => {
                              const isActive = aiAgentConfig.responseDelayMs === delayPreset;
                              return (
                                <button
                                  key={delayPreset}
                                  type="button"
                                  onClick={() =>
                                    handleAiAgentConfigChange({
                                      responseDelayMs: delayPreset,
                                    })
                                  }
                                  className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition ${
                                    isActive
                                      ? 'border border-emerald-500/25 bg-emerald-500/15 text-emerald-100'
                                      : 'border border-white/10 bg-background/30 text-white/70 hover:bg-white/10'
                                  }`}
                                >
                                  {formatAiResponseDelay(delayPreset)}
                                </button>
                              );
                            })}
                          </div>
                        </label>

                        <label className="space-y-2 text-sm text-white/75 sm:col-span-1">
                          <span className="block text-xs font-semibold uppercase tracking-[0.24em] text-white/45">
                            Contexto
                          </span>
                          <input
                            type="number"
                            min={4}
                            max={30}
                            value={aiAgentConfig.maxContextMessages}
                            onChange={(event) =>
                              handleAiAgentConfigChange({
                                maxContextMessages: Number(event.target.value),
                              })
                            }
                            className="w-full rounded-2xl border border-white/10 bg-background/30 px-4 py-3 text-sm outline-none"
                          />
                        </label>

                        <label className="space-y-2 text-sm text-white/75 sm:col-span-1">
                          <span className="block text-xs font-semibold uppercase tracking-[0.24em] text-white/45">
                            Temperatura
                          </span>
                          <input
                            type="number"
                            min={0}
                            max={2}
                            step={0.1}
                            value={aiAgentConfig.temperature}
                            onChange={(event) =>
                              handleAiAgentConfigChange({
                                temperature: Number(event.target.value),
                              })
                            }
                            className="w-full rounded-2xl border border-white/10 bg-background/30 px-4 py-3 text-sm outline-none"
                          />
                        </label>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleAiAgentConfigChange((current) => ({
                            onlyUnassignedConversations: !current.onlyUnassignedConversations,
                          }))
                        }
                        className={`flex cursor-pointer flex-col items-start rounded-2xl border px-4 py-4 text-left text-sm transition ${
                          aiAgentConfig.onlyUnassignedConversations
                            ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100'
                            : 'border-white/10 bg-background/30 text-white/75 hover:bg-white/10'
                        }`}
                      >
                        <span className="font-semibold">Responder apenas conversas sem atendente</span>
                        <span className="mt-2 leading-6 opacity-80">
                          {aiAgentConfig.onlyUnassignedConversations
                            ? 'A IA fica de fora quando a conversa ja esta atribuida a alguem.'
                            : 'A IA pode responder mesmo com conversa atribuida.'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleAiAgentConfigChange((current) => ({
                            replyToGroups: !current.replyToGroups,
                          }))
                        }
                        className={`flex cursor-pointer flex-col items-start rounded-2xl border px-4 py-4 text-left text-sm transition ${
                          aiAgentConfig.replyToGroups
                            ? 'border-amber-500/25 bg-amber-500/10 text-amber-100'
                            : 'border-white/10 bg-background/30 text-white/75 hover:bg-white/10'
                        }`}
                      >
                        <span className="font-semibold">Responder grupos</span>
                        <span className="mt-2 leading-6 opacity-80">
                          {aiAgentConfig.replyToGroups
                            ? 'A automacao tambem considera mensagens vindas de grupos.'
                            : 'A automacao responde apenas conversas individuais.'}
                        </span>
                      </button>
                    </div>

                    <label className="block space-y-2 text-sm text-white/75">
                      <span className="block text-xs font-semibold uppercase tracking-[0.24em] text-white/45">
                        Prompt do agente
                      </span>
                      <textarea
                        value={aiAgentConfig.systemPrompt}
                        onChange={(event) =>
                          handleAiAgentConfigChange({
                            systemPrompt: event.target.value,
                          })
                        }
                        rows={8}
                        placeholder="Descreva como a IA deve conduzir o atendimento."
                        className="min-h-[180px] w-full rounded-2xl border border-white/10 bg-background/30 px-4 py-3 text-sm leading-6 outline-none"
                      />
                    </label>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-4">
                      <p className="text-sm leading-6 text-white/55">
                        {isLoadingAiAgentConfig
                          ? 'Carregando configuracao salva...'
                          : 'As respostas automaticas usam o provedor selecionado e o prompt configurado acima.'}
                      </p>

                      <button
                        type="button"
                        onClick={handleSaveAiAgentConfig}
                        disabled={isSavingAiAgentConfig || isLoadingAiAgentConfig}
                        className="inline-flex cursor-pointer items-center rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isSavingAiAgentConfig ? 'Salvando...' : 'Salvar agente IA'}
                      </button>
                    </div>
                  </div>
                )}
              </article>
              <article className="rounded-3xl border border-white/10 bg-background/30 p-5 shadow-[0_12px_50px_rgba(0,0,0,0.14)]">
                <div className="flex flex-col gap-4 border-b border-white/8 pb-5 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">Base de conhecimento da IA</h3>
                    <p className="mt-2 text-sm leading-6 text-white/60">
                      Cadastre identidade, politicas, respostas padrao e documentos textuais para a IA consultar antes de responder o cliente.
                    </p>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3">
                    <SummaryItem
                      label="Itens ativos"
                      value={String(activeKnowledgeCount)}
                      hint="Entradas habilitadas para consulta da IA."
                    />
                    <SummaryItem
                      label="Fixos"
                      value={String(pinnedKnowledgeCount)}
                      hint="Sempre entram no prompt, mesmo sem busca especifica."
                    />
                    <SummaryItem
                      label="Arquivos"
                      value={String(knowledgeItems.filter((item) => item.sourceType === 'file').length)}
                      hint="Documentos textuais anexados na base."
                    />
                  </div>
                </div>

                {!isAdmin ? (
                  <div className="mt-5 rounded-2xl border border-white/8 bg-white/3 px-4 py-4 text-sm leading-6 text-white/70">
                    Somente usuarios administradores podem alterar a base de conhecimento da IA.
                  </div>
                ) : (
                  <div className="mt-5 space-y-5">
                    <div className="grid gap-4 xl:grid-cols-2">
                      <div className="rounded-2xl border border-white/8 bg-white/3 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/45">
                          Adicionar conteudo manual
                        </p>
                        <div className="mt-4 space-y-3">
                          <input
                            value={newKnowledgeTitle}
                            onChange={(event) => setNewKnowledgeTitle(event.target.value)}
                            placeholder="Ex.: Identidade da marca"
                            className="w-full rounded-2xl border border-white/10 bg-background/30 px-4 py-3 text-sm outline-none"
                          />
                          <textarea
                            value={newKnowledgeContent}
                            onChange={(event) => setNewKnowledgeContent(event.target.value)}
                            rows={8}
                            placeholder="Cole aqui o conteudo que a IA precisa conhecer."
                            className="min-h-[180px] w-full rounded-2xl border border-white/10 bg-background/30 px-4 py-3 text-sm leading-6 outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => setNewKnowledgeAlwaysInclude(!newKnowledgeAlwaysInclude)}
                            className={`flex w-full cursor-pointer flex-col items-start rounded-2xl border px-4 py-4 text-left text-sm transition ${
                              newKnowledgeAlwaysInclude
                                ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100'
                                : 'border-white/10 bg-background/30 text-white/75 hover:bg-white/10'
                            }`}
                          >
                            <span className="font-semibold">Sempre incluir no prompt</span>
                            <span className="mt-2 leading-6 opacity-80">
                              Use para identidade, regras fixas e informacoes que a IA sempre deve considerar.
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={handleCreateKnowledgeManualItem}
                            disabled={isCreatingKnowledgeItem || !newKnowledgeTitle.trim() || !newKnowledgeContent.trim()}
                            className="inline-flex cursor-pointer items-center rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isCreatingKnowledgeItem ? 'Salvando...' : 'Adicionar conteudo'}
                          </button>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/8 bg-white/3 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/45">
                          Anexar documento textual
                        </p>
                        <p className="mt-2 text-sm leading-6 text-white/60">
                          Aceita TXT, MD, CSV, JSON, HTML, XML e YAML. O texto extraido entra na base para a IA consultar.
                        </p>
                        <div className="mt-4 space-y-3">
                          <input
                            value={newKnowledgeUploadTitle}
                            onChange={(event) => setNewKnowledgeUploadTitle(event.target.value)}
                            placeholder="Titulo opcional para sobrescrever o nome do arquivo"
                            className="w-full rounded-2xl border border-white/10 bg-background/30 px-4 py-3 text-sm outline-none"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setNewKnowledgeUploadAlwaysInclude(!newKnowledgeUploadAlwaysInclude)
                            }
                            className={`flex w-full cursor-pointer flex-col items-start rounded-2xl border px-4 py-4 text-left text-sm transition ${
                              newKnowledgeUploadAlwaysInclude
                                ? 'border-sky-500/25 bg-sky-500/10 text-sky-100'
                                : 'border-white/10 bg-background/30 text-white/75 hover:bg-white/10'
                            }`}
                          >
                            <span className="font-semibold">Sempre incluir este documento</span>
                            <span className="mt-2 leading-6 opacity-80">
                              Ative para manuais ou politicas que devem acompanhar toda resposta.
                            </span>
                          </button>
                          <input
                            ref={knowledgeFileInputRef}
                            type="file"
                            accept=".txt,.md,.markdown,.csv,.json,.html,.htm,.xml,.yaml,.yml,text/plain,text/markdown,text/csv,application/json,text/html,application/xml,text/xml,application/yaml,text/yaml"
                            onChange={handleKnowledgeFileSelected}
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={() => knowledgeFileInputRef.current?.click()}
                            disabled={isUploadingKnowledgeItem}
                            className="inline-flex cursor-pointer items-center rounded-2xl border border-white/10 bg-background/30 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isUploadingKnowledgeItem ? 'Enviando...' : 'Selecionar documento'}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/8 bg-white/3 p-4">
                      <div className="flex flex-col gap-2 border-b border-white/8 pb-4 md:flex-row md:items-end md:justify-between">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/45">
                            Itens cadastrados
                          </p>
                          <p className="mt-2 text-sm leading-6 text-white/60">
                            Edite, desligue ou remova itens da base. A IA consulta primeiro os habilitados e prioriza os fixos.
                          </p>
                        </div>
                        <p className="text-xs leading-5 text-white/45">
                          {isLoadingKnowledgeItems ? 'Carregando base...' : `${knowledgeItems.length} item(ns) cadastrado(s)`}
                        </p>
                      </div>

                      {isLoadingKnowledgeItems ? (
                        <div className="mt-4 rounded-2xl border border-white/10 bg-background/30 px-4 py-4 text-sm text-white/60">
                          Carregando base de conhecimento da IA...
                        </div>
                      ) : knowledgeItems.length === 0 ? (
                        <div className="mt-4 rounded-2xl border border-white/10 bg-background/30 px-4 py-4 text-sm text-white/60">
                          Nenhum item cadastrado ainda. Adicione um texto manual ou anexe um documento para a IA consultar.
                        </div>
                      ) : (
                        <Accordion type="single" collapsible className="mt-4 space-y-4">
                          {knowledgeItems.map((item) => (
                            <AccordionItem
                              key={item.id}
                              value={item.id}
                              className="overflow-hidden rounded-2xl border border-white/10 bg-background/30 px-4"
                            >
                              <AccordionTrigger className="py-4 text-white hover:no-underline">
                                <div className="min-w-0 flex-1 text-left">
                                  <div className="flex flex-wrap gap-2 text-xs">
                                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/75">
                                      {item.sourceType === 'file' ? 'Arquivo' : 'Manual'}
                                    </span>
                                    <span
                                      className={`rounded-full px-3 py-1 ${
                                        item.enabled
                                          ? 'border border-emerald-500/25 bg-emerald-500/10 text-emerald-100'
                                          : 'border border-white/10 bg-white/5 text-white/55'
                                      }`}
                                    >
                                      {item.enabled ? 'Ativo' : 'Desligado'}
                                    </span>
                                    {item.alwaysInclude ? (
                                      <span className="rounded-full border border-sky-500/25 bg-sky-500/10 px-3 py-1 text-sky-100">
                                        Sempre incluir
                                      </span>
                                    ) : null}
                                  </div>

                                  <div className="mt-3 min-w-0">
                                    <p className="truncate text-sm font-semibold text-white/95">{item.title}</p>
                                    <p className="mt-1 truncate text-xs leading-5 text-white/45">
                                      {item.contentPreview ?? item.content}
                                    </p>
                                  </div>

                                  <div className="mt-3 text-xs leading-5 text-white/45">
                                    <p>Atualizado em {formatKnowledgeDate(item.updatedAt)}</p>
                                    {item.fileName ? (
                                      <p>
                                        {item.fileName} {item.sizeBytes ? `- ${formatKnowledgeFileSize(item.sizeBytes)}` : ''}
                                      </p>
                                    ) : null}
                                  </div>
                                </div>
                              </AccordionTrigger>

                              <AccordionContent className="pt-0">
                                <div className="grid gap-3 border-t border-white/8 pt-4">
                                  <input
                                    value={item.title}
                                    onChange={(event) =>
                                      handleKnowledgeItemChange(item.id, {
                                        title: event.target.value,
                                      })
                                    }
                                    className="w-full rounded-2xl border border-white/10 bg-card px-4 py-3 text-sm outline-none"
                                  />
                                  <textarea
                                    value={item.content}
                                    onChange={(event) =>
                                      handleKnowledgeItemChange(item.id, {
                                        content: event.target.value,
                                      })
                                    }
                                    rows={8}
                                    className="min-h-[180px] w-full rounded-2xl border border-white/10 bg-card px-4 py-3 text-sm leading-6 outline-none"
                                  />
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleKnowledgeItemChange(item.id, (current) => ({
                                          enabled: !current.enabled,
                                        }))
                                      }
                                      className={`cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition ${
                                        item.enabled
                                          ? 'border border-emerald-500/25 bg-emerald-500/10 text-emerald-100'
                                          : 'border border-white/10 bg-card text-white/75 hover:bg-white/10'
                                      }`}
                                    >
                                      {item.enabled ? 'Item ativo' : 'Item desligado'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleKnowledgeItemChange(item.id, (current) => ({
                                          alwaysInclude: !current.alwaysInclude,
                                        }))
                                      }
                                      className={`cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition ${
                                        item.alwaysInclude
                                          ? 'border border-sky-500/25 bg-sky-500/10 text-sky-100'
                                          : 'border border-white/10 bg-card text-white/75 hover:bg-white/10'
                                      }`}
                                    >
                                      {item.alwaysInclude ? 'Sempre incluir' : 'Incluir sob demanda'}
                                    </button>
                                  </div>
                                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-4">
                                    <p className="text-xs leading-5 text-white/45">
                                      {item.contentLength ?? item.content.length} caracteres armazenados.
                                    </p>
                                    <div className="flex flex-wrap gap-3">
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteKnowledgeItem(item.id)}
                                        disabled={isRemovingKnowledgeItemId === item.id}
                                        className="cursor-pointer rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                        {isRemovingKnowledgeItemId === item.id ? 'Removendo...' : 'Remover'}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleSaveKnowledgeItem(item.id)}
                                        disabled={isSavingKnowledgeItemId === item.id}
                                        className="cursor-pointer rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                        {isSavingKnowledgeItemId === item.id ? 'Salvando...' : 'Salvar item'}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      )}
                    </div>
                  </div>
                )}
              </article>
                </TabsContent>

                <TabsContent value="filas" className="mt-0 space-y-6">
              <article className="rounded-3xl border border-white/10 bg-background/30 p-5 shadow-[0_12px_50px_rgba(0,0,0,0.14)]">
                <div className="flex flex-col gap-4 border-b border-white/8 pb-5 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">Distribuicao dos atendimentos</h3>
                    <p className="mt-2 text-sm leading-6 text-white/60">
                      Defina como novos atendimentos entram na operacao, como a fila redistribui
                      entre quem estiver online e se a IA pode assumir antes do humano.
                    </p>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3">
                    <SummaryItem
                      label="Novos"
                      value={newConversationDistributionLabel}
                      hint={
                        distributionConfig.newConversations.passThroughAiFirst
                          ? 'Passa pela IA antes do humano'
                          : 'Segue direto para a distribuicao humana'
                      }
                    />
                    <SummaryItem
                      label="Fila"
                      value={queueDistributionLabel}
                      hint={
                        distributionConfig.queueTransfers.passThroughAiFirst
                          ? 'Fila pode passar pela IA'
                          : 'Fila distribui sem IA'
                      }
                    />
                    <SummaryItem
                      label="Handoff IA"
                      value={distributionConfig.aiHandoff.enabled ? 'Ativo' : 'Desligado'}
                      hint="Permite que a IA transfira sozinha quando perceber necessidade humana."
                    />
                  </div>
                </div>

                {!isAdmin ? (
                  <div className="mt-5 rounded-2xl border border-white/8 bg-white/3 px-4 py-4 text-sm leading-6 text-white/70">
                    Somente usuarios administradores podem alterar a distribuicao dos atendimentos.
                  </div>
                ) : (
                  <div className="mt-5 space-y-5">
                    <div className="grid gap-4 xl:grid-cols-2">
                      <div className="rounded-2xl border border-white/8 bg-white/3 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/45">
                          Novos atendimentos
                        </p>
                        <p className="mt-2 text-sm leading-6 text-white/60">
                          Escolha se a entrada nova cai direto na fila ou alterna automaticamente
                          entre os atendentes que estiverem online naquele momento.
                        </p>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {[
                            { value: 'manual_queue', label: 'Fila manual' },
                            { value: 'online_round_robin', label: 'Circular entre online' },
                          ].map((option) => {
                            const isActive = distributionConfig.newConversations.strategy === option.value;
                            return (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() =>
                                  handleDistributionConfigChange({
                                    newConversations: {
                                      ...distributionConfig.newConversations,
                                      strategy: option.value as WhatsAppDistributionConfig['newConversations']['strategy'],
                                    },
                                  })
                                }
                                className={`cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition ${
                                  isActive
                                    ? 'bg-white text-slate-900'
                                    : 'border border-white/10 bg-background/30 text-white/75 hover:bg-white/10'
                                }`}
                              >
                                {option.label}
                              </button>
                            );
                          })}
                        </div>

                        <div className="mt-4 rounded-2xl border border-white/10 bg-background/30 px-4 py-4 text-sm leading-6 text-white/60">
                          A ordem circular e montada automaticamente com base nos atendentes online.
                          Se houver um online, ele recebe. Se houver dois ou mais, o sistema alterna
                          entre eles sem precisar cadastrar ordem manual.
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            handleDistributionConfigChange((current) => ({
                              newConversations: {
                                ...current.newConversations,
                                passThroughAiFirst: !current.newConversations.passThroughAiFirst,
                              },
                            }))
                          }
                          className={`mt-4 flex w-full cursor-pointer flex-col items-start rounded-2xl border px-4 py-4 text-left text-sm transition ${
                            distributionConfig.newConversations.passThroughAiFirst
                              ? 'border-sky-500/25 bg-sky-500/10 text-sky-100'
                              : 'border-white/10 bg-background/30 text-white/75 hover:bg-white/10'
                          }`}
                          >
                            <span className="font-semibold">Passar primeiro pela IA</span>
                            <span className="mt-2 leading-6 opacity-80">
                              Quando ativo, a conversa entra na IA e so vai para humano quando houver transferencia.
                            </span>
                          </button>
                      </div>

                      <div className="rounded-2xl border border-white/8 bg-white/3 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/45">
                          Transferencia para fila
                        </p>
                        <p className="mt-2 text-sm leading-6 text-white/60">
                          Ao devolver um atendimento, a fila pode manter pendente ou redistribuir entre quem estiver online naquele momento.
                        </p>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {[
                            { value: 'manual_queue', label: 'Manter na fila' },
                            { value: 'online_round_robin', label: 'Circular entre online' },
                            { value: 'online_random', label: 'Aleatorio entre online' },
                          ].map((option) => {
                            const isActive = distributionConfig.queueTransfers.strategy === option.value;
                            return (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() =>
                                  handleDistributionConfigChange({
                                    queueTransfers: {
                                      ...distributionConfig.queueTransfers,
                                      strategy: option.value as WhatsAppDistributionConfig['queueTransfers']['strategy'],
                                    },
                                  })
                                }
                                className={`cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition ${
                                  isActive
                                    ? 'bg-white text-slate-900'
                                    : 'border border-white/10 bg-background/30 text-white/75 hover:bg-white/10'
                                }`}
                              >
                                {option.label}
                              </button>
                            );
                          })}
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            handleDistributionConfigChange((current) => ({
                              queueTransfers: {
                                ...current.queueTransfers,
                                passThroughAiFirst: !current.queueTransfers.passThroughAiFirst,
                              },
                            }))
                          }
                          className={`mt-4 flex w-full cursor-pointer flex-col items-start rounded-2xl border px-4 py-4 text-left text-sm transition ${
                            distributionConfig.queueTransfers.passThroughAiFirst
                              ? 'border-sky-500/25 bg-sky-500/10 text-sky-100'
                              : 'border-white/10 bg-background/30 text-white/75 hover:bg-white/10'
                          }`}
                        >
                          <span className="font-semibold">Fila pode passar primeiro pela IA</span>
                          <span className="mt-2 leading-6 opacity-80">
                            Quando ativo, a conversa vai para a IA antes de chegar ao proximo atendente humano.
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleDistributionConfigChange((current) => ({
                              aiHandoff: {
                                ...current.aiHandoff,
                                enabled: !current.aiHandoff.enabled,
                              },
                            }))
                          }
                          className={`mt-4 flex w-full cursor-pointer flex-col items-start rounded-2xl border px-4 py-4 text-left text-sm transition ${
                            distributionConfig.aiHandoff.enabled
                              ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100'
                              : 'border-white/10 bg-background/30 text-white/75 hover:bg-white/10'
                          }`}
                        >
                          <span className="font-semibold">Permitir transferencia automatica da IA</span>
                          <span className="mt-2 leading-6 opacity-80">
                            Se a IA entender que precisa de humano, ela mesma transfere usando a regra configurada acima.
                          </span>
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-4">
                      <p className="text-sm leading-6 text-white/55">
                        {isLoadingDistributionConfig
                          ? 'Carregando distribuicao salva...'
                          : 'As regras acima controlam a entrada nova, a fila e o handoff automatico da IA.'}
                      </p>

                      <button
                        type="button"
                        onClick={handleSaveDistributionConfig}
                        disabled={isSavingDistributionConfig || isLoadingDistributionConfig}
                        className="inline-flex cursor-pointer items-center rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isSavingDistributionConfig ? 'Salvando...' : 'Salvar distribuicao'}
                      </button>
                    </div>
                  </div>
                )}
              </article>
                </TabsContent>

                <TabsContent value="padroes" className="mt-0 space-y-6">
              <article className="rounded-3xl border border-white/10 bg-background/30 p-5 shadow-[0_12px_50px_rgba(0,0,0,0.14)]">
                <h3 className="text-lg font-semibold">Motivos de encerramento</h3>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  Cadastre aqui os motivos que aparecem na modal de encerramento do atendimento.
                </p>

                <div className="mt-4 flex gap-3">
                  <input
                    value={newCloseReason}
                    onChange={(event) => setNewCloseReason(event.target.value)}
                    placeholder="Novo motivo de encerramento"
                    className="w-full rounded-2xl border border-white/10 bg-background/30 px-4 py-3 text-sm outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddCloseReason}
                    disabled={isSavingCloseReason || !newCloseReason.trim()}
                    className="shrink-0 cursor-pointer rounded-2xl bg-primary px-4 py-3 text-sm font-semibold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSavingCloseReason ? 'Salvando...' : 'Adicionar'}
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  {closeReasons.map((reason) => (
                    <div
                      key={reason}
                      className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-background/30 px-4 py-2 text-sm"
                    >
                      <span>{reason}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveCloseReason(reason)}
                        disabled={isRemovingCloseReason === reason}
                        className="cursor-pointer text-white/50 transition hover:text-white disabled:opacity-40"
                      >
                        {isRemovingCloseReason === reason ? '...' : 'x'}
                      </button>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-3xl border border-white/10 bg-background/30 p-5 shadow-[0_12px_50px_rgba(0,0,0,0.14)]">
                <h3 className="text-lg font-semibold">Tags padronizadas de clientes</h3>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  Cadastre as tags disponiveis para vincular nos atendimentos, sem escrita livre.
                </p>

                <div className="mt-4 flex gap-3">
                  <input
                    value={newContactTag}
                    onChange={(event) => setNewContactTag(event.target.value)}
                    placeholder="Nova tag"
                    className="w-full rounded-2xl border border-white/10 bg-background/30 px-4 py-3 text-sm outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddContactTag}
                    disabled={isSavingContactTag || !newContactTag.trim()}
                    className="shrink-0 cursor-pointer rounded-2xl bg-primary px-4 py-3 text-sm font-semibold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSavingContactTag ? 'Salvando...' : 'Adicionar'}
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  {contactTags.map((tag) => (
                    <div
                      key={tag}
                      className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-background/30 px-4 py-2 text-sm"
                    >
                      <span>{tag}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveContactTag(tag)}
                        disabled={isRemovingContactTag === tag}
                        className="cursor-pointer text-white/50 transition hover:text-white disabled:opacity-40"
                      >
                        {isRemovingContactTag === tag ? '...' : 'x'}
                      </button>
                    </div>
                  ))}
                </div>
              </article>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}

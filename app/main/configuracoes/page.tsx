'use client';

import { getMe } from '@/lib/auth';
import {
  connectWhatsApp,
  createContactTag,
  createCloseReason,
  DEFAULT_WHATSAPP_CLOSE_REASONS,
  DEFAULT_WHATSAPP_CONTACT_TAGS,
  deleteContactTag,
  deleteCloseReason,
  getContactTags,
  getCloseReasons,
  getWhatsAppSession,
  logoutWhatsApp,
} from '@/lib/Whatsapp';
import type { WhatsAppSession } from '@/types/Whatsapp.types';
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

type AuthUser = {
  id: string;
  name: string;
  email: string;
};

const EMPTY_SESSION: WhatsAppSession = {
  id: 'default',
  status: 'DISCONNECTED',
  qrCodeDataUrl: null,
  phoneNumber: null,
  displayName: null,
  lastError: null,
};

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
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<WhatsAppSession>(EMPTY_SESSION);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [closeReasons, setCloseReasons] = useState<string[]>(DEFAULT_WHATSAPP_CLOSE_REASONS);
  const [newCloseReason, setNewCloseReason] = useState('');
  const [isSavingCloseReason, setIsSavingCloseReason] = useState(false);
  const [isRemovingCloseReason, setIsRemovingCloseReason] = useState<string | null>(null);
  const [contactTags, setContactTags] = useState<string[]>(DEFAULT_WHATSAPP_CONTACT_TAGS);
  const [newContactTag, setNewContactTag] = useState('');
  const [isSavingContactTag, setIsSavingContactTag] = useState(false);
  const [isRemovingContactTag, setIsRemovingContactTag] = useState<string | null>(null);

  const statusMeta = STATUS_META[session.status];
  const isAwaitingConnection = session.status === 'CONNECTING' || session.status === 'QR_READY';

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
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL;
    if (!socketUrl) return;

    const socket = io(socketUrl, {
      withCredentials: true,
      transports: ['websocket'],
    });

    socketRef.current = socket;

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
        setSession((current) => ({
          ...EMPTY_SESSION,
          id: current.id ?? EMPTY_SESSION.id,
          status: willReconnect ? 'CONNECTING' : 'DISCONNECTED',
          lastError: reason ?? null,
        }));
        setFeedback(willReconnect ? 'Conexao perdida. Tentando reconectar...' : 'WhatsApp desconectado.');
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
          handleConnect={handleConnect}
          handleDisconnect={handleDisconnect}
          handleLogout={handleLogout}
        />

        {false && (
        <section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-6">
            <article className="rounded-[24px] border border-white/10 bg-card p-6 shadow-[0_12px_50px_rgba(0,0,0,0.14)]">
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

            <article className="rounded-[24px] border border-white/10 bg-card p-6 shadow-[0_12px_50px_rgba(0,0,0,0.14)]">
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

          <article className="rounded-[24px] border border-white/10 bg-card p-6 shadow-[0_12px_50px_rgba(0,0,0,0.14)]">
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
              <div className="rounded-[24px] border border-dashed border-white/12 bg-background/40 p-5">
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

                <div className="flex min-h-[320px] items-center justify-center rounded-[22px] border border-white/8 bg-white p-4">
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
                <div className="rounded-[24px] border border-white/8 bg-white/3 p-5">
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

                <div className="rounded-[24px] border border-white/8 bg-white/3 p-5">
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

                <div className="rounded-[24px] border border-white/8 bg-white/3 p-5">
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

                <div className="rounded-[24px] border border-white/8 bg-white/3 p-5">
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

type SettingsTabbedSectionsProps = {
  user: AuthUser | null;
  isLoadingUser: boolean;
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
  handleConnect: () => Promise<void>;
  handleDisconnect: () => Promise<void>;
  handleLogout: () => Promise<void>;
};

function SettingsTabbedSections({
  user,
  isLoadingUser,
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
  handleConnect,
  handleDisconnect,
  handleLogout,
}: SettingsTabbedSectionsProps) {
  const userInitials = user?.name?.slice(0, 2)?.toUpperCase() ?? 'US';

  return (
    <section className="rounded-[24px] border border-white/10 bg-card p-6 shadow-[0_12px_50px_rgba(0,0,0,0.14)]">
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
            <article className="rounded-[24px] border border-white/10 bg-background/30 p-6 shadow-[0_12px_50px_rgba(0,0,0,0.14)]">
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
              <article className="rounded-[24px] border border-white/10 bg-background/30 p-6 shadow-[0_12px_50px_rgba(0,0,0,0.14)]">
                <div className="flex flex-col gap-4 border-b border-white/8 pb-5 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">Sessao da conta</h3>
                    <p className="mt-2 text-sm leading-6 text-white/60">
                      Controle o acesso da conta atual ao painel.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleLogout}
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

              <article className="rounded-[24px] border border-white/10 bg-background/30 p-6 shadow-[0_12px_50px_rgba(0,0,0,0.14)]">
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
                    value="Padroes"
                    hint="Motivos de encerramento e tags padronizadas."
                  />
                </div>
              </article>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="whatsapp">
          <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
            <div className="space-y-6">
              <article className="rounded-[24px] border border-white/10 bg-background/30 p-6 shadow-[0_12px_50px_rgba(0,0,0,0.14)]">
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

            <article className="rounded-[24px] border border-white/10 bg-background/30 p-6 shadow-[0_12px_50px_rgba(0,0,0,0.14)]">
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
                <div className="rounded-[24px] border border-dashed border-white/12 bg-card p-5">
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

                  <div className="flex min-h-[320px] items-center justify-center rounded-[22px] border border-white/8 bg-white p-4">
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
                  <div className="rounded-[24px] border border-white/8 bg-white/3 p-5">
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

                  <div className="rounded-[24px] border border-white/8 bg-white/3 p-5">
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
            <article className="rounded-[24px] border border-white/10 bg-background/30 p-6 shadow-[0_12px_50px_rgba(0,0,0,0.14)]">
              <h3 className="text-lg font-semibold">Padroes operacionais</h3>
              <p className="mt-3 text-sm leading-6 text-white/60">
                Centralize aqui as listas padronizadas usadas no atendimento para manter a equipe
                consistente e reduzir escrita livre.
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
              </div>
            </article>

            <div className="space-y-6">
              <article className="rounded-[24px] border border-white/10 bg-background/30 p-5 shadow-[0_12px_50px_rgba(0,0,0,0.14)]">
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

              <article className="rounded-[24px] border border-white/10 bg-background/30 p-5 shadow-[0_12px_50px_rgba(0,0,0,0.14)]">
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
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}

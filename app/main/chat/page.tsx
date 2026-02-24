'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { FaCog, FaQrcode, FaSyncAlt, FaWhatsapp } from 'react-icons/fa';
import type { Socket } from 'socket.io-client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useWhatsAppSocket } from '@/context/whatsapp-socket-context';
import {
  readWhatsAppAlertPreferences,
  writeWhatsAppAlertPreferences,
  type WhatsAppAlertPreferences,
} from '@/lib/whatsapp-alert-preferences';
import {
  assignWhatsAppConversation,
  assignWhatsAppConversationToMe,
  connectWhatsApp,
  closeWhatsAppConversation,
  disconnectWhatsApp,
  getWhatsAppConversationMessages,
  getWhatsAppConversations,
  getWhatsAppStatus,
  markWhatsAppConversationRead,
  sendWhatsAppTextMessage,
  startWhatsAppConversation,
  type WhatsAppConversation,
  type WhatsAppMessage,
  type WhatsAppStatus,
} from '@/lib/whatsapp';
import {
  AlertCircle,
  ArrowLeft,
  ArrowLeftRight,
  Check,
  CheckCheck,
  Clock3,
  MessageSquare,
  MessageSquareX,
  RefreshCcw,
  Send,
  User,
} from 'lucide-react';

type WhatsAppSocketMessageEvent = {
  conversationId: string;
  message: WhatsAppMessage;
  conversation?: WhatsAppConversation | null;
};

type WhatsAppPresencePayload = {
  onlineUsers: Array<{
    id: string;
    name: string;
    email?: string | null;
    role?: string | null;
  }>;
  onlineCount: number;
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripAuthorPrefix(
  body: string | null | undefined,
  authorName?: string | null,
) {
  if (!body) return body || '';
  if (!authorName) return body;

  const escapedName = escapeRegExp(authorName.trim());
  const patterns = [
    new RegExp(`^\\*\\s*${escapedName}\\s*:\\s*\\*\\s*\\n?`, 'i'),
    new RegExp(`^\\*\\s*${escapedName}\\s*\\*\\s*:\\s*\\n?`, 'i'),
    new RegExp(`^${escapedName}\\s*:\\s*\\n?`, 'i'),
  ];

  let result = body;
  for (const pattern of patterns) {
    const next = result.replace(pattern, '');
    if (next !== result) {
      result = next;
      break;
    }
  }

  return result.trimStart();
}

function formatPhoneDisplay(phone: string) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';

  if (digits.length === 13 && digits.startsWith('55')) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }

  if (digits.length === 12 && digits.startsWith('55')) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
  }

  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return digits;
}

function getOutgoingStatusPresentation(status?: string | null) {
  const normalized = String(status || '').toLowerCase();

  if (normalized === 'read') {
    return {
      label: 'Lida',
      icon: CheckCheck,
      className: 'text-sky-300',
    };
  }

  if (normalized === 'delivered') {
    return {
      label: 'Entregue',
      icon: CheckCheck,
      className: 'text-primary-foreground/80',
    };
  }

  if (normalized === 'failed' || normalized === 'error') {
    return {
      label: 'Falha no envio',
      icon: AlertCircle,
      className: 'text-red-200',
    };
  }

  if (normalized === 'pending') {
    return {
      label: 'Enviando',
      icon: Clock3,
      className: 'text-primary-foreground/80',
    };
  }

  return {
    label: 'Enviada (aguardando entrega)',
    icon: Check,
    className: 'text-primary-foreground/80',
  };
}

function getConversationIdentifier(conversation: WhatsAppConversation | null) {
  if (!conversation) return null;

  if (conversation.contact?.phone) {
    return {
      label: 'Telefone',
      value:
        formatPhoneDisplay(conversation.contact.phone) ||
        conversation.contact.phone,
      kind: 'phone' as const,
    };
  }

  if (conversation.phone) {
    return {
      label: 'Telefone',
      value: formatPhoneDisplay(conversation.phone) || conversation.phone,
      kind: 'phone' as const,
    };
  }

  if (conversation.remoteJid?.includes('@lid')) {
    return {
      label: 'ID WhatsApp (LID)',
      value: conversation.remoteJid.split('@')[0],
      kind: 'lid' as const,
    };
  }

  return {
    label: 'ID WhatsApp',
    value: conversation.phone || conversation.remoteJid,
    kind: 'id' as const,
  };
}

function areConversationListsEquivalent(
  current: WhatsAppConversation[],
  next: WhatsAppConversation[],
) {
  if (current === next) return true;
  if (current.length !== next.length) return false;

  for (let i = 0; i < current.length; i += 1) {
    const a = current[i];
    const b = next[i];
    if (!a || !b) return false;

    if (a.id !== b.id) return false;
    if (a.unreadCount !== b.unreadCount) return false;
    if ((a.lastMessageAt || null) !== (b.lastMessageAt || null)) return false;
    if ((a.lastMessagePreview || null) !== (b.lastMessagePreview || null)) return false;
    if ((a.assignedUserId || null) !== (b.assignedUserId || null)) return false;
    if ((a.phone || null) !== (b.phone || null)) return false;
    if ((a.pushName || null) !== (b.pushName || null)) return false;
    if ((a.waName || null) !== (b.waName || null)) return false;
    if ((a.remoteJid || null) !== (b.remoteJid || null)) return false;

    if ((a.assignedUser?.id || null) !== (b.assignedUser?.id || null)) return false;
    if ((a.assignedUser?.name || null) !== (b.assignedUser?.name || null)) return false;

    if ((a.contact?.id || null) !== (b.contact?.id || null)) return false;
    if ((a.contact?.name || null) !== (b.contact?.name || null)) return false;
    if ((a.contact?.phone || null) !== (b.contact?.phone || null)) return false;
  }

  return true;
}

function getInitialsFromName(value: string | null | undefined) {
  const safe = String(value || '').trim();
  if (!safe) return '?';

  const parts = safe.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

function formatConversationListTime(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (sameDay) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();

  if (isYesterday) return 'Ontem';

  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function ChatPageContent() {
  const searchParams = useSearchParams();
  const { user, socket: sharedSocket } = useWhatsAppSocket();
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<WhatsAppConversation | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [scope, setScope] = useState<'all' | 'mine'>('mine');
  const [search, setSearch] = useState('');
  const [composerText, setComposerText] = useState('');
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [presence, setPresence] = useState<WhatsAppPresencePayload>({
    onlineUsers: [],
    onlineCount: 0,
  });
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');
  const [alertPreferences, setAlertPreferences] = useState<WhatsAppAlertPreferences>({
    inAppToastEnabled: true,
    browserNotificationEnabled: true,
    soundEnabled: true,
  });
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferTargetUserId, setTransferTargetUserId] = useState<string>('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [isNewConversationModalOpen, setIsNewConversationModalOpen] = useState(false);
  const [newConversationPhone, setNewConversationPhone] = useState('');
  const [newConversationName, setNewConversationName] = useState('');
  const [newConversationInitialMessage, setNewConversationInitialMessage] = useState('');
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [isCloseConversationModalOpen, setIsCloseConversationModalOpen] = useState(false);
  const [isClosingConversation, setIsClosingConversation] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const socketRef = useRef<Socket | null>(null);
  const socketConnectedRef = useRef(false);
  const statusRequestInFlightRef = useRef(false);
  const conversationsRequestInFlightRef = useRef(false);
  const searchRefreshTimeoutRef = useRef<number | null>(null);
  const selectedConversationIdRef = useRef<string | null>(null);
  const searchRef = useRef('');
  const requestedConversationIdRef = useRef<string | null>(null);

  const statusLabel = useMemo(() => {
    switch (status?.status) {
      case 'connected': return 'Conectado';
      case 'connecting': return 'Conectando...';
      case 'qr': return 'Aguardando QR';
      case 'logged_out': return 'Desconectado (logout)';
      case 'error': return 'Erro';
      default: return 'Desconectado';
    }
  }, [status?.status]);

  const statusColor = useMemo(() => {
    switch (status?.status) {
      case 'connected': return 'var(--color-success, #16a34a)';
      case 'qr':
      case 'connecting': return 'var(--color-warning, #d97706)';
      case 'error':
      case 'logged_out': return 'var(--color-danger, #dc2626)';
      default: return 'var(--color-muted-foreground)';
    }
  }, [status?.status]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === selectedConversationId) || selectedConversation,
    [conversations, selectedConversation, selectedConversationId],
  );
  
  const activeConversationIdentifier = useMemo(
    () => getConversationIdentifier(activeConversation),
    [activeConversation],
  );

  const renderConversationTitle = (conversation: WhatsAppConversation) =>
    conversation.contact?.name ||
    conversation.pushName ||
    conversation.waName ||
    conversation.phone ||
    conversation.remoteJid;

  async function requestNotificationPermission() {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setNotificationPermission('unsupported');
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
    } catch {
      setNotificationPermission(Notification.permission);
    }
  }

  function updateAlertPreference(key: keyof WhatsAppAlertPreferences, value: boolean) {
    const next = writeWhatsAppAlertPreferences({ [key]: value });
    setAlertPreferences(next);
  }

  useEffect(() => { selectedConversationIdRef.current = selectedConversationId; }, [selectedConversationId]);
  useEffect(() => { searchRef.current = search; }, [search]);
  useEffect(() => { requestedConversationIdRef.current = searchParams.get('conversationId'); }, [searchParams]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ('Notification' in window) setNotificationPermission(Notification.permission);
    setAlertPreferences(readWhatsAppAlertPreferences());
  }, []);

  useEffect(() => {
    void loadStatus(true);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void loadStatus(true);
        if (!socketConnectedRef.current) void loadConversations();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    void loadConversations(true);
  }, [scope, search]);

  useEffect(() => {
    if (isRealtimeConnected) return;

    const interval = window.setInterval(() => {
      void loadStatus();
      void loadConversations();
      if (selectedConversationIdRef.current) {
        void loadConversationMessages(selectedConversationIdRef.current, false);
      }
    }, 45000);

    return () => window.clearInterval(interval);
  }, [isRealtimeConnected, scope, search]);

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([]);
      setSelectedConversation(null);
      return;
    }
    loadConversationMessages(selectedConversationId, true);
    markWhatsAppConversationRead(selectedConversationId).catch(() => {});
  }, [selectedConversationId]);

  useEffect(() => {
    const socket = sharedSocket;
    if (!user || !socket) return;
    socketRef.current = socket;
    socketConnectedRef.current = socket.connected;
    setIsRealtimeConnected(socket.connected);

    const handleSocketConnect = () => {
      socketConnectedRef.current = true;
      setIsRealtimeConnected(true);
      void loadStatus(true);
      void loadConversations(true);
      if (selectedConversationIdRef.current) {
        void loadConversationMessages(selectedConversationIdRef.current, false);
        socket.emit('whatsapp:joinConversation', selectedConversationIdRef.current);
      }
    };

    const handleSocketDisconnect = () => {
      socketConnectedRef.current = false;
      setIsRealtimeConnected(false);
      void loadStatus(true);
      void loadConversations();
    };

    const handleStatusUpdated = (payload: WhatsAppStatus) => { setStatus(payload); };
    const handlePresenceUpdated = (payload: WhatsAppPresencePayload) => { setPresence(payload); };

    const handleConversationUpdated = (payload: WhatsAppConversation) => {
      setConversations((prev) => {
        const exists = prev.some((c) => c.id === payload.id);
        const next = exists ? prev.map((c) => (c.id === payload.id ? { ...c, ...payload } : c)) : [payload, ...prev];
        return [...next].sort((a, b) => {
          const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
          const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
          return bTime - aTime;
        });
      });

      if (selectedConversationIdRef.current === payload.id) {
        setSelectedConversation((prev) => ({ ...(prev || {}), ...payload }) as WhatsAppConversation);
      }
      if (searchRef.current.trim()) {
        if (searchRefreshTimeoutRef.current) {
          window.clearTimeout(searchRefreshTimeoutRef.current);
        }
        searchRefreshTimeoutRef.current = window.setTimeout(() => {
          searchRefreshTimeoutRef.current = null;
          void loadConversations();
        }, 500);
      }
    };

    const handleMessageCreated = (payload: WhatsAppSocketMessageEvent) => {
      if (payload.conversation) {
        setConversations((prev) => {
          const exists = prev.some((c) => c.id === payload.conversation!.id);
          const next = exists
            ? prev.map((c) => (c.id === payload.conversation!.id ? { ...c, ...payload.conversation! } : c))
            : [payload.conversation!, ...prev];
          return [...next].sort((a, b) => {
            const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
            const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
            return bTime - aTime;
          });
        });
      }

      if (selectedConversationIdRef.current === payload.conversationId && payload.message) {
        shouldAutoScrollRef.current = true;
        setMessages((prev) => {
          const exists = prev.some((m) => m.id === payload.message.id);
          if (exists) return prev.map((m) => (m.id === payload.message.id ? payload.message : m));
          return [...prev, payload.message].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        });

        if (payload.conversation) {
          setSelectedConversation((prev) => ({ ...(prev || {}), ...payload.conversation }) as WhatsAppConversation);
        }

        if (!payload.message.fromMe) {
          void markWhatsAppConversationRead(payload.conversationId).catch(() => {});
        }
      }
    };

    const handleConnectError = (error: any) => console.warn('Socket WhatsApp connect_error:', error?.message);

    socket.on('connect', handleSocketConnect);
    socket.on('disconnect', handleSocketDisconnect);
    socket.on('whatsapp:status.updated', handleStatusUpdated);
    socket.on('whatsapp:presence.updated', handlePresenceUpdated);
    socket.on('whatsapp:conversation.updated', handleConversationUpdated);
    socket.on('whatsapp:message.created', handleMessageCreated);
    socket.on('connect_error', handleConnectError);

    return () => {
      socketConnectedRef.current = false;
      setIsRealtimeConnected(false);
      if (searchRefreshTimeoutRef.current) {
        window.clearTimeout(searchRefreshTimeoutRef.current);
        searchRefreshTimeoutRef.current = null;
      }
      socket.off('connect', handleSocketConnect);
      socket.off('disconnect', handleSocketDisconnect);
      socket.off('whatsapp:status.updated', handleStatusUpdated);
      socket.off('whatsapp:presence.updated', handlePresenceUpdated);
      socket.off('whatsapp:conversation.updated', handleConversationUpdated);
      socket.off('whatsapp:message.created', handleMessageCreated);
      socket.off('connect_error', handleConnectError);
      socketRef.current = null;
    };
  }, [user, sharedSocket]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    if (selectedConversationId) socket.emit('whatsapp:joinConversation', selectedConversationId);
    return () => {
      if (selectedConversationId) socket.emit('whatsapp:leaveConversation', selectedConversationId);
    };
  }, [selectedConversationId]);

  useEffect(() => {
    if (shouldAutoScrollRef.current) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadStatus(force = false) {
    if (!force) {
      if (statusRequestInFlightRef.current) return;
      if (socketConnectedRef.current) return;
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    }

    statusRequestInFlightRef.current = true;
    try {
      if (!status) setIsLoadingStatus(true);
      const data = await getWhatsAppStatus();
      setStatus(data);
    } catch (error: any) { setErrorMessage(error?.response?.data?.error || 'Erro ao consultar status'); }
    finally {
      statusRequestInFlightRef.current = false;
      setIsLoadingStatus(false);
    }
  }

  async function loadConversations(force = false) {
    if (!force) {
      if (conversationsRequestInFlightRef.current) return;
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    }

    conversationsRequestInFlightRef.current = true;
    try {
      if (conversations.length === 0) setIsLoadingConversations(true);
      const data = await getWhatsAppConversations({ scope, search: search.trim() || undefined, limit: 80 });
      setConversations((prev) => (areConversationListsEquivalent(prev, data) ? prev : data));
      const requestedConversationId = requestedConversationIdRef.current;
      if (requestedConversationId && data.some((c) => c.id === requestedConversationId)) {
        setSelectedConversationId(requestedConversationId);
        requestedConversationIdRef.current = null;
      }
      if (!selectedConversationId && data.length > 0 && window.innerWidth >= 768) {
        setSelectedConversationId(data[0].id);
      }
    } catch (error: any) { setErrorMessage(error?.response?.data?.error || 'Erro ao carregar conversas'); }
    finally {
      conversationsRequestInFlightRef.current = false;
      setIsLoadingConversations(false);
    }
  }

  async function loadConversationMessages(conversationId: string, forceScroll: boolean) {
    try {
      if (forceScroll) setIsLoadingMessages(true);
      shouldAutoScrollRef.current = forceScroll;
      const data = await getWhatsAppConversationMessages(conversationId, { limit: 150 });
      setSelectedConversation(data.conversation);
      setMessages(data.messages);
    } catch (error: any) { setErrorMessage(error?.response?.data?.error || 'Erro ao carregar mensagens'); }
    finally { setIsLoadingMessages(false); }
  }

  async function handleConnect() {
    try {
      setIsConnecting(true); setErrorMessage(null);
      const data = await connectWhatsApp();
      setStatus(data);
    } catch (error: any) { setErrorMessage(error?.response?.data?.error || 'Erro ao conectar WhatsApp'); }
    finally { setIsConnecting(false); }
  }

  async function handleDisconnect(resetSession = false) {
    try {
      setIsConnecting(true); setErrorMessage(null);
      const data = await disconnectWhatsApp(resetSession ? { resetSession: true } : undefined);
      setStatus(data);
    } catch (error: any) { setErrorMessage(error?.response?.data?.error || 'Erro ao desconectar WhatsApp'); }
    finally { setIsConnecting(false); }
  }

  async function handleSendMessage() {
    if (!selectedConversationId || !composerText.trim()) return;
    try {
      setIsSending(true); setErrorMessage(null);
      const text = composerText;
      setComposerText('');
      await sendWhatsAppTextMessage(selectedConversationId, text);
      // O socket jÃ¡ injeta a mensagem/status. Evita recarregar a conversa com loader (piscada).
      if (!socketConnectedRef.current) {
        await loadConversationMessages(selectedConversationId, false);
      }
      await loadConversations();
    } catch (error: any) { setErrorMessage(error?.response?.data?.error || 'Erro ao enviar mensagem'); }
    finally { setIsSending(false); }
  }

  async function handleAssignToMe() {
    if (!selectedConversationId) return;
    try {
      setErrorMessage(null);
      await assignWhatsAppConversationToMe(selectedConversationId);
      await Promise.all([loadConversations(), loadConversationMessages(selectedConversationId, false)]);
    } catch (error: any) { setErrorMessage(error?.response?.data?.error || 'Erro ao assumir conversa'); }
  }

  async function handleTransferConversation() {
    if (!selectedConversationId || !transferTargetUserId) return;
    try {
      setIsTransferring(true); setErrorMessage(null);
      await assignWhatsAppConversation(selectedConversationId, transferTargetUserId);
      setIsTransferModalOpen(false);
      await Promise.all([loadConversations(), loadConversationMessages(selectedConversationId, false)]);
    } catch (error: any) { setErrorMessage(error?.response?.data?.error || 'Erro ao transferir conversa'); }
    finally { setIsTransferring(false); }
  }

  async function handleCreateConversationFromSystem() {
    if (!newConversationPhone.trim()) return;
    try {
      setIsCreatingConversation(true); setErrorMessage(null);
      const conversation = await startWhatsAppConversation({
        phone: newConversationPhone,
        name: newConversationName.trim() || undefined,
        initialMessage: newConversationInitialMessage.trim() || undefined,
      });
      setScope('mine');
      setSelectedConversationId(conversation.id);
      setIsNewConversationModalOpen(false);
      setNewConversationPhone(''); setNewConversationName(''); setNewConversationInitialMessage('');
      await Promise.all([loadConversations(), loadConversationMessages(conversation.id, true)]);
    } catch (error: any) { setErrorMessage(error?.response?.data?.error || 'Erro ao abrir atendimento'); }
    finally { setIsCreatingConversation(false); }
  }

  async function handleCloseConversation() {
    if (!selectedConversationId) return;
    try {
      setIsClosingConversation(true); setErrorMessage(null);
      await closeWhatsAppConversation(selectedConversationId);
      setIsCloseConversationModalOpen(false);
      setSelectedConversationId(null); // Volta pra lista no mobile
      await loadConversations();
    } catch (error: any) { setErrorMessage(error?.response?.data?.error || 'Erro ao encerrar atendimento'); }
    finally { setIsClosingConversation(false); }
  }

  const onlineTransferCandidates = useMemo(() => presence.onlineUsers.filter((u) => u.id !== user?.id), [presence.onlineUsers, user?.id]);
  const queueStats = useMemo(() => {
    const unassigned = conversations.filter((c) => !c.assignedUserId).length;
    const mine = user ? conversations.filter((c) => c.assignedUserId === user.id).length : 0;
    const waitingUnread = conversations.filter((c) => !c.assignedUserId && c.unreadCount > 0).length;
    return { unassigned, mine, waitingUnread };
  }, [conversations, user]);

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      
      {/* HEADER PRINCIPAL - Oculto no mobile se houver um chat aberto */}
      <header className={`flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4 xl:mb-6 ${selectedConversationId ? 'hidden md:flex' : 'flex'}`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="bg-primary/10 p-2.5 rounded-xl">
            <FaWhatsapp className="text-primary text-2xl" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
              Chat WhatsApp
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground truncate">
              Inbox integrado ao CRM
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className="px-3 py-2 rounded-lg border text-sm font-medium bg-card"
            style={{ borderColor: 'var(--color-border)', color: statusColor }}
          >
            {isLoadingStatus ? 'Carregando...' : statusLabel}
          </div>
          {status?.phoneNumber && (
            <div
              className="px-3 py-2 rounded-lg border text-sm hidden sm:block"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}
            >
              {status.phoneNumber}
            </div>
          )}
          <button
            className="btn btn-primary"
            onClick={() => setIsNewConversationModalOpen(true)}
            disabled={status?.status !== 'connected'}
          >
            Novo atendimento
          </button>
          <button className="btn btn-ghost bg-card border" onClick={() => setIsSettingsOpen(true)}>
            <FaCog />
          </button>
        </div>
      </header>

      {errorMessage && (
        <div className="mb-4 rounded-lg px-4 py-3 text-sm text-red-600 bg-red-50 border border-red-200">
          {errorMessage}
        </div>
      )}

      {/* CONTAINER PRINCIPAL FLEX - Substitui o Grid */}
      <div className="flex flex-1 min-h-0 gap-4 overflow-hidden">
        
        {/* COLUNA 1: LISTA DE CONVERSAS */}
        <section 
          className={`w-full md:w-[380px] flex-col min-h-0 overflow-hidden bg-card rounded-2xl border border-border shadow-sm 
          ${selectedConversationId ? 'hidden md:flex' : 'flex'}`}
        >
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-2 mb-3 bg-muted/50 p-1 rounded-lg">
              <button
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${scope === 'mine' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'}`}
                onClick={() => setScope('mine')}
              >
                Minhas
              </button>
              <button
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${scope === 'all' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'}`}
                onClick={() => setScope('all')}
              >
                Todas
              </button>
            </div>
            <input
              className="input w-full bg-background rounded-xl border-none focus:ring-1"
              placeholder="Buscar contato..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoadingConversations ? (
              <div className="p-6 text-sm text-muted-foreground text-center">Carregando conversas...</div>
            ) : conversations.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground text-center">Nenhuma conversa encontrada.</div>
            ) : (
              <ul className="p-2 space-y-2">
                {conversations.map((conversation) => (
                  <li key={conversation.id}>
                    {(() => {
                      const title = renderConversationTitle(conversation);
                      const initials = getInitialsFromName(title);
                      const timeLabel = formatConversationListTime(conversation.lastMessageAt);
                      const isSelected = selectedConversationId === conversation.id;
                      const preview = conversation.lastMessagePreview || '...';
                      return (
                        <button
                          className={`group w-full text-left px-3 py-3 rounded-2xl border cursor-pointer transition-all duration-150
                            ${isSelected
                              ? 'bg-primary/10 border-primary/30 shadow-[inset_3px_0_0_var(--color-primary)]'
                              : 'bg-card border-border/70 hover:bg-muted/40 hover:border-border'
                            }`}
                          onClick={() => setSelectedConversationId(conversation.id)}
                        >
                          <div className="flex items-center gap-3">
                            <div className="relative shrink-0">
                              <div className={`w-12 h-12 rounded-full flex items-center justify-center border text-sm font-bold tracking-wide
                                ${isSelected
                                  ? 'bg-primary/15 border-primary/30 text-primary'
                                  : 'bg-muted/70 border-border text-foreground'
                                }`}
                              >
                                {initials}
                              </div>
                              <span
                                className={`absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-card ${
                                  conversation.assignedUserId ? 'bg-emerald-500' : 'bg-muted-foreground/40'
                                }`}
                                title={conversation.assignedUserId ? 'Com responsÃ¡vel' : 'Sem responsÃ¡vel'}
                              />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className={`truncate text-[15px] leading-tight ${isSelected ? 'font-semibold text-foreground' : 'font-medium text-foreground'}`}>
                                    {title}
                                  </p>
                                  <p className={`mt-1 line-clamp-1 text-sm ${conversation.unreadCount > 0 ? 'text-foreground/90 font-medium' : 'text-muted-foreground'}`}>
                                    {preview}
                                  </p>
                                </div>

                                <div className="shrink-0 text-right flex flex-col items-end gap-1">
                                  {timeLabel ? (
                                    <span className={`text-xs ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}>
                                      {timeLabel}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground/60">-</span>
                                  )}

                                  {conversation.unreadCount > 0 ? (
                                    <span className="min-w-5 h-5 px-1.5 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-bold">
                                      {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                                    </span>
                                  ) : null}
                                </div>
                              </div>

                              <div className="mt-2 flex items-center gap-2">
                                {conversation.assignedUser ? (
                                  <span className="px-2 py-0.5 text-[10px] rounded-full bg-primary/10 text-primary whitespace-nowrap">
                                    Resp. {conversation.assignedUser.name.split(' ')[0]}
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 text-[10px] rounded-full border border-border text-muted-foreground whitespace-nowrap">
                                    Sem responsÃ¡vel
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })()}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* COLUNA 2: ÃREA DO CHAT */}
        <section 
          className={`flex-1 flex-col min-h-0 overflow-hidden bg-card md:rounded-2xl md:border md:border-border md:overflow-hidden md:shadow-sm 
          ${!selectedConversationId ? 'hidden md:flex' : 'flex'}`}
        >
          {status?.status !== 'connected' && !selectedConversationId && (
             <div className="m-auto text-center max-w-sm p-6">
                <FaQrcode className="mx-auto text-muted-foreground text-4xl mb-4" />
                <h3 className="text-lg font-semibold">Conecte seu WhatsApp</h3>
                <p className="text-sm text-muted-foreground mt-2 mb-6">Acesse as configuraÃ§Ãµes para parear seu nÃºmero e comeÃ§ar a atender.</p>
                <button className="btn btn-primary" onClick={handleConnect} disabled={isConnecting}>
                  {isConnecting ? 'Conectando...' : 'Gerar QR Code'}
                </button>
             </div>
          )}

          {activeConversation ? (
            <>
              {/* HEADER DO CHAT */}
              <div className="p-3 sm:p-4 border-b border-border flex flex-row items-center justify-between gap-3 bg-card/80 backdrop-blur-md z-10">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  {/* BotÃ£o de Voltar para Mobile */}
                  <button
                    className="md:hidden p-2 -ml-2 text-muted-foreground hover:bg-muted rounded-full transition-colors cursor-pointer"
                    onClick={() => setSelectedConversationId(null)}
                  >
                    <ArrowLeft size={22} />
                  </button>
                  
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-primary font-bold">{renderConversationTitle(activeConversation).charAt(0).toUpperCase()}</span>
                  </div>
                  
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="font-bold text-[15px] sm:text-base truncate">
                        {renderConversationTitle(activeConversation)}
                      </h2>
                    </div>
                    {activeConversationIdentifier && (
                      <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                        {activeConversationIdentifier.value}
                        {activeConversation.assignedUser && (
                          <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[9px] gap-1 items-center flex uppercase tracking-wider">
                            <User size={13}/> {activeConversation.assignedUser.name.split(' ')[0]}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button className="p-2 text-muted-foreground hover:bg-muted rounded-full cursor-pointer" onClick={() => loadConversationMessages(activeConversation.id, false)} title="Atualizar">
                    <RefreshCcw size={18}/>
                  </button>
                  <button className="p-2 text-red-500 hover:bg-red-50 rounded-full cursor-pointer" onClick={() => setIsCloseConversationModalOpen(true)} title="Encerrar">
                    <MessageSquareX size={18}/>
                  </button>
                  <button 
                    className="p-2 text-primary hover:bg-primary/10 rounded-full cursor-pointer" 
                    onClick={() => {
                      const defaultTarget = onlineTransferCandidates.find((c) => c.id !== activeConversation.assignedUserId)?.id || onlineTransferCandidates[0]?.id || '';
                      setTransferTargetUserId(defaultTarget);
                      setIsTransferModalOpen(true);
                    }} 
                    title="Transferir"
                  >
                    <ArrowLeftRight size={18}/>
                  </button>
                </div>
              </div>

              {/* LISTA DE MENSAGENS */}
              <div
                className="flex-1 overflow-y-auto p-2 space-y-4 bg-muted/10"
                onScroll={(e) => {
                  const el = e.currentTarget;
                  shouldAutoScrollRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
                }}
              >
                {isLoadingMessages ? (
                  <div className="text-sm text-center text-muted-foreground mt-4">Carregando mensagens...</div>
                ) : messages.length === 0 ? (
                  <div className="text-sm text-center text-muted-foreground mt-4">Nenhuma mensagem ainda.</div>
                ) : (
                  messages.map((message) => {
                    const fromCurrentUser = Boolean(user && message.senderUserId === user.id);
                    const displayBody = message.fromMe && message.senderUser?.name
                        ? stripAuthorPrefix(message.body, message.senderUser.name)
                        : message.body;
                    const authorName = message.fromMe
                      ? (message.senderUser?.name || (fromCurrentUser ? user?.name : null) || 'Equipe')
                      : (activeConversation.contact?.name || activeConversation.pushName || 'Cliente');
                    const outgoingStatus = message.fromMe ? getOutgoingStatusPresentation(message.status) : null;
                    return (
                      <div key={message.id} className={`flex ${message.fromMe ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[85%] sm:max-w-[75%] px-4 py-2.5 shadow-sm
                            ${message.fromMe ? 'bg-primary text-primary-foreground rounded-2xl rounded-tr-sm' : 'bg-card border border-border rounded-2xl rounded-tl-sm'}`}
                        >
                          <p
                            className={`text-[11px] font-semibold mb-1 ${
                              message.fromMe ? 'text-primary-foreground/90' : 'text-emerald-600'
                            }`}
                          >
                            {authorName}:
                          </p>
                          {message.type !== 'text' && (
                            <p className="text-[10px] mb-1 opacity-70 italic uppercase tracking-wider">
                              [{message.type}]
                            </p>
                          )}
                          <p className="whitespace-pre-wrap wrap-break-word text-[14px] sm:text-[15px] leading-relaxed">
                            {displayBody || '(mÃ­dia/mensagem nÃ£o suportada)'}
                          </p>
                          <div
                            className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
                              message.fromMe ? 'text-primary-foreground/70' : 'text-muted-foreground'
                            }`}
                          >
                            <span>{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            {outgoingStatus && (
                              <span
                                className={`inline-flex items-center ${outgoingStatus.className}`}
                                title={outgoingStatus.label}
                                aria-label={outgoingStatus.label}
                              >
                                <outgoingStatus.icon size={12} strokeWidth={2.2} />
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* INPUT DE MENSAGEM */}
              <div className="p-3 sm:p-4 bg-card border-t border-border">
                {activeConversation.assignedUserId !== user?.id && activeConversation.assignedUserId && (
                   <div className="mb-3 p-2 bg-yellow-50 text-yellow-800 text-xs rounded-md border border-yellow-200 text-center">
                     Esta conversa estÃ¡ atribuÃ­da a outro usuÃ¡rio.
                   </div>
                )}
                {!activeConversation.assignedUserId && (
                  <div className="mb-3 flex justify-between items-center p-2 bg-primary/5 border border-primary/20 rounded-lg">
                    <span className="text-xs text-foreground font-medium">Conversa sem responsÃ¡vel</span>
                    <button className="btn btn-secondary text-xs px-3 py-1.5 h-auto" onClick={handleAssignToMe}>
                      Assumir
                    </button>
                  </div>
                )}
                <div className="flex gap-2 items-end">
                  <textarea
                    className="flex-1 bg-muted/50 border-none focus:ring-0 resize-none rounded-2xl px-4 py-3 text-[15px] max-h-32 shadow-sm"
                    rows={1}
                    placeholder={status?.status === 'connected' ? 'Digite uma mensagem...' : 'Conecte para enviar mensagens'}
                    value={composerText}
                    onChange={(e) => {
                       setComposerText(e.target.value);
                       e.target.style.height = 'auto';
                       e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (!isSending) void handleSendMessage();
                      }
                    }}
                    disabled={status?.status !== 'connected' || isSending}
                  />
                  <button
                    className={`p-3.5 rounded-full flex items-center justify-center transition-transform shrink-0 mb-0.5 cursor-pointer
                      ${!composerText.trim() || isSending ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground shadow-md hover:scale-105'}`}
                    onClick={handleSendMessage}
                    disabled={isSending || status?.status !== 'connected' || !composerText.trim()}
                  >
                    <Send size={18} className={isSending ? 'opacity-50' : ''} />
                  </button>
                </div>
              </div>
            </>
          ) : (
            status?.status === 'connected' && (
              <div className="flex-1 flex items-center justify-center p-8 bg-muted/5">
                <div className="text-center">
                  <div className="inline-flex p-4 rounded-full bg-primary/10 mb-4">
                    <MessageSquare className="text-primary text-3xl" />
                  </div>
                  <p className="font-semibold text-lg">Selecione uma conversa</p>
                  <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
                    As mensagens recebidas irÃ£o aparecer na lista ao lado.
                  </p>
                </div>
              </div>
            )
          )}
        </section>
      </div>

      {/* MODAL DE CONFIGURAÃ‡Ã•ES */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="w-[min(56rem,calc(100vw-1rem))] max-w-none max-h-[90vh] min-h-0 overflow-hidden p-0 gap-0 flex flex-col rounded-2xl">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border bg-card">
            <DialogTitle className="text-xl">ConfiguraÃ§Ãµes do Chat WhatsApp</DialogTitle>
            <DialogDescription>
              ConexÃ£o, fila de distribuiÃ§Ã£o e alertas do atendimento.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 py-4 bg-muted/10">
            <div className="grid gap-5">
              
              {/* ConexÃ£o */}
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <p className="text-sm font-semibold mb-4 text-primary">Status da ConexÃ£o</p>
                <div className="grid sm:grid-cols-2 gap-4 text-sm">
                  <div className="rounded-lg bg-muted/30 border border-border p-3">
                    <p className="text-xs text-muted-foreground mb-1">Status</p>
                    <p className="font-medium" style={{ color: statusColor }}>{statusLabel}</p>
                  </div>
                  <div className="rounded-lg bg-muted/30 border border-border p-3">
                    <p className="text-xs text-muted-foreground mb-1">NÃºmero conectado</p>
                    <p className="font-medium truncate">{status?.phoneNumber || status?.wid || 'NÃ£o conectado'}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {status?.status && status.status !== 'disconnected' ? (
                    <button className="btn border border-red-200 text-red-600 hover:bg-red-50" onClick={() => handleDisconnect(true)} disabled={isConnecting}>
                      Desconectar nÃºmero
                    </button>
                  ) : null}
                  {status?.status !== 'connected' && (
                    <button className="btn btn-primary" onClick={handleConnect} disabled={isConnecting}>
                      {isConnecting ? 'Conectando...' : 'Conectar / Gerar QR'}
                    </button>
                  )}
                  <button className="btn btn-secondary" onClick={() => loadStatus(true)}>
                    Atualizar status
                  </button>
                </div>
              </div>

              {/* Fila e DistribuiÃ§Ã£o */}
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <p className="text-sm font-semibold mb-4 text-primary">Fila e DistribuiÃ§Ã£o</p>
                <div className="grid sm:grid-cols-3 gap-4 text-sm">
                  <div className="rounded-lg bg-muted/30 border border-border p-3">
                    <p className="text-xs text-muted-foreground mb-1">Atendentes online</p>
                    <p className="font-bold text-lg">{presence.onlineCount}</p>
                  </div>
                  <div className="rounded-lg bg-muted/30 border border-border p-3">
                    <p className="text-xs text-muted-foreground mb-1">Sem responsÃ¡vel</p>
                    <p className="font-bold text-lg">{queueStats.unassigned}</p>
                  </div>
                  <div className="rounded-lg bg-muted/30 border border-border p-3">
                    <p className="text-xs text-muted-foreground mb-1">Aguardando (unread)</p>
                    <p className="font-bold text-lg text-amber-600">{queueStats.waitingUnread}</p>
                  </div>
                </div>
                
                <div className="mt-4">
                  <p className="text-xs text-muted-foreground mb-2">UsuÃ¡rios online no chat</p>
                  {presence.onlineUsers.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">Nenhum usuÃ¡rio online no momento.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {presence.onlineUsers.map((onlineUser) => (
                        <span
                          key={onlineUser.id}
                          className={`px-3 py-1.5 rounded-full border text-xs font-medium
                            ${onlineUser.id === user?.id ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background'}`}
                        >
                          <span className="w-1.5 h-1.5 inline-block rounded-full bg-green-500 mr-2"></span>
                          {onlineUser.name}
                          {onlineUser.id === user?.id ? ' (vocÃª)' : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Alertas */}
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <p className="text-sm font-semibold mb-4 text-primary">PreferÃªncias de Alerta</p>
                <div className="space-y-4">
                  <label className="flex items-center justify-between gap-4 cursor-pointer p-2 hover:bg-muted/30 rounded-lg transition-colors">
                    <div>
                      <p className="text-sm font-medium">Toast interno global</p>
                      <p className="text-xs text-muted-foreground mt-0.5">NotificaÃ§Ã£o visual dentro do sistema ao receber mensagem.</p>
                    </div>
                    <Switch
                      checked={alertPreferences.inAppToastEnabled}
                      onCheckedChange={(checked) => updateAlertPreference('inAppToastEnabled', Boolean(checked))}
                    />
                  </label>

                  <label className="flex items-center justify-between gap-4 cursor-pointer p-2 hover:bg-muted/30 rounded-lg transition-colors">
                    <div>
                      <p className="text-sm font-medium">Som (beep)</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Alerta sonoro de nova mensagem.</p>
                    </div>
                    <Switch
                      checked={alertPreferences.soundEnabled}
                      onCheckedChange={(checked) => updateAlertPreference('soundEnabled', Boolean(checked))}
                    />
                  </label>

                  <label className="flex items-center justify-between gap-4 cursor-pointer p-2 hover:bg-muted/30 rounded-lg transition-colors">
                    <div>
                      <p className="text-sm font-medium">NotificaÃ§Ã£o do navegador (Push)</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Alertas do sistema operacional mesmo se a aba nÃ£o estiver visÃ­vel.</p>
                    </div>
                    <Switch
                      checked={alertPreferences.browserNotificationEnabled}
                      onCheckedChange={(checked) => updateAlertPreference('browserNotificationEnabled', Boolean(checked))}
                    />
                  </label>

                  {notificationPermission !== 'granted' && alertPreferences.browserNotificationEnabled && (
                    <div className="mt-2 ml-2 flex items-center gap-3 bg-amber-50 p-3 rounded-lg border border-amber-200">
                      <span className="text-xs text-amber-800">Status permissÃ£o: <strong>{notificationPermission}</strong></span>
                      {notificationPermission !== 'unsupported' && (
                        <button className="text-xs bg-amber-600 text-white px-3 py-1.5 rounded-md hover:bg-amber-700 transition-colors" onClick={requestNotificationPermission}>
                          Permitir no navegador
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t border-border bg-card">
            <button className="btn btn-primary" onClick={() => setIsSettingsOpen(false)}>
              Fechar ConfiguraÃ§Ãµes
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DE TRANSFERÃŠNCIA */}
      <Dialog open={isTransferModalOpen} onOpenChange={setIsTransferModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Transferir atendimento</DialogTitle>
            <DialogDescription>
              Selecione um usuÃ¡rio online para assumir esta conversa.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {activeConversation && (
              <div className="rounded-xl bg-muted/30 border border-border p-4">
                <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Conversa atual</p>
                <p className="font-medium truncate text-foreground">{renderConversationTitle(activeConversation)}</p>
                <p className="text-xs mt-1 text-muted-foreground">
                  ResponsÃ¡vel: <span className="font-medium text-foreground">{activeConversation.assignedUser?.name || 'Nenhum'}</span>
                </p>
              </div>
            )}

            {onlineTransferCandidates.length > 0 ? (
              <div>
                <p className="text-sm font-medium mb-3">Atendentes disponÃ­veis</p>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                  {onlineTransferCandidates.map((onlineUser) => {
                    const selected = transferTargetUserId === onlineUser.id;
                    return (
                      <button
                        key={onlineUser.id}
                        type="button"
                        className={`w-full text-left rounded-xl border p-3 cursor-pointer transition-all
                          ${selected ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border hover:bg-muted/50'}`}
                        onClick={() => setTransferTargetUserId(onlineUser.id)}
                      >
                        <p className={`font-medium ${selected ? 'text-primary' : 'text-foreground'}`}>{onlineUser.name}</p>
                        {onlineUser.email && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{onlineUser.email}</p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 text-center">
                Nenhum outro usuÃ¡rio estÃ¡ online no chat no momento.
              </div>
            )}
          </div>

          <DialogFooter>
            <button className="btn btn-ghost" onClick={() => setIsTransferModalOpen(false)} disabled={isTransferring}>
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={handleTransferConversation} disabled={isTransferring || !transferTargetUserId}>
              {isTransferring ? 'Transferindo...' : 'Transferir Conversa'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DE ENCERRAR CONVERSA */}
      <Dialog open={isCloseConversationModalOpen} onOpenChange={setIsCloseConversationModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-red-600">Encerrar atendimento</DialogTitle>
            <DialogDescription>
              A conversa sairÃ¡ da sua lista ativa. Se o cliente enviar uma nova mensagem, ela voltarÃ¡ automaticamente para o inbox sem responsÃ¡vel.
            </DialogDescription>
          </DialogHeader>

          {activeConversation && (
            <div className="rounded-xl bg-muted/30 border border-border p-4 my-2">
              <p className="font-medium truncate text-lg">{renderConversationTitle(activeConversation)}</p>
              <p className="text-sm mt-1 text-muted-foreground">
                {activeConversation.contact?.phone || activeConversation.phone || activeConversation.remoteJid}
              </p>
            </div>
          )}

          <DialogFooter>
            <button className="btn btn-ghost" onClick={() => setIsCloseConversationModalOpen(false)} disabled={isClosingConversation}>
              Manter Aberto
            </button>
            <button
              className="btn border-none bg-red-600 hover:bg-red-700 text-white"
              onClick={handleCloseConversation}
              disabled={isClosingConversation}
            >
              {isClosingConversation ? 'Encerrando...' : 'Confirmar Encerramento'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DE NOVO ATENDIMENTO */}
      <Dialog open={isNewConversationModalOpen} onOpenChange={setIsNewConversationModalOpen}>
        <DialogContent className="w-[min(34rem,calc(100vw-1rem))] max-w-none max-h-[90vh] min-h-0 overflow-hidden p-0 gap-0 flex flex-col rounded-2xl">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border bg-card">
            <DialogTitle>Iniciar Novo Atendimento</DialogTitle>
            <DialogDescription>
              Abra uma conversa ativa com um cliente informando o nÃºmero. VocÃª pode opcionalmente jÃ¡ enviar a primeira mensagem.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5 bg-muted/5">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-foreground">Telefone WhatsApp</label>
              <input
                className="input w-full bg-background rounded-xl border-border"
                placeholder="Ex: 5511999999999"
                value={newConversationPhone}
                onChange={(e) => setNewConversationPhone(e.target.value)}
              />
              <p className="text-xs mt-1.5 text-muted-foreground">
                ObrigatÃ³rio incluir DDI (Ex: Brasil = 55) + DDD + NÃºmero. Apenas nÃºmeros.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5 text-foreground">Nome do Contato (Opcional)</label>
              <input
                className="input w-full bg-background rounded-xl border-border"
                placeholder="Para identificar visualmente na lista"
                value={newConversationName}
                onChange={(e) => setNewConversationName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5 text-foreground">Mensagem Inicial (Opcional)</label>
              <textarea
                className="input w-full min-h-[120px] resize-none bg-background rounded-xl border-border"
                placeholder="OlÃ¡, como podemos ajudar?"
                value={newConversationInitialMessage}
                onChange={(e) => setNewConversationInitialMessage(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t border-border bg-card">
            <button className="btn btn-ghost" onClick={() => setIsNewConversationModalOpen(false)} disabled={isCreatingConversation}>
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={handleCreateConversationFromSystem} disabled={isCreatingConversation || !newConversationPhone.trim()}>
              {isCreatingConversation ? 'Abrindo Conversa...' : 'Abrir Atendimento'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full min-h-0 items-center justify-center rounded-2xl border border-border bg-card">
          <p className="text-sm text-muted-foreground">Carregando chat...</p>
        </div>
      }
    >
      <ChatPageContent />
    </Suspense>
  );
}


'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { io, Socket } from 'socket.io-client'
import {
  getConversations,
  markConversationAsRead,
  closeConversation as closeConversationApi,
} from '@/lib/Whatsapp'
import type { WhatsAppConversation, WhatsAppMessage } from '@/types/Whatsapp.types'

// ─────────────────────────────────────────
// TIPOS DO CONTEXT
// ─────────────────────────────────────────

interface MessagesByConversation {
  [conversationId: string]: WhatsAppMessage[]
}

interface WhatsAppContextValue {
  // Conversas
  conversations: WhatsAppConversation[]
  isLoadingConversations: boolean

  // Conversa ativa
  activeConversationId: string | null
  setActiveConversation: (id: string) => void
  activeConversation: WhatsAppConversation | null

  // Mensagens da conversa ativa
  messages: WhatsAppMessage[]
  isLoadingMessages: boolean

  // Ações
  closeConversation: (id: string) => Promise<void>
  addOutgoingMessage: (msg: WhatsAppMessage) => void

  // Socket
  isConnected: boolean
}

// ─────────────────────────────────────────
// CONTEXT
// ─────────────────────────────────────────

const WhatsAppContext = createContext<WhatsAppContextValue | null>(null)

export function WhatsAppProvider({ children }: { children: React.ReactNode }) {
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([])
  const [isLoadingConversations, setIsLoadingConversations] = useState(true)
  const [messagesByConversation, setMessagesByConversation] = useState<MessagesByConversation>({})
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  const socketRef = useRef<Socket | null>(null)
  const previousConversationRef = useRef<string | null>(null)

  // ── Carregar conversas UMA única vez ────
  useEffect(() => {
    async function loadConversations() {
      try {
        const result = await getConversations({ limit: 50 })
        setConversations(result.data)
      } catch (err) {
        console.error('[WhatsApp] Erro ao carregar conversas:', err)
      } finally {
        setIsLoadingConversations(false)
      }
    }

    loadConversations()
  }, [])

  // ── Socket.io — conecta uma única vez ───
  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL!, {
      withCredentials: true,
      transports: ['websocket'],
    })

    socketRef.current = socket

    socket.on('connect', () => {
      setIsConnected(true)
      console.log('[Socket] Conectado')
    })

    socket.on('disconnect', () => {
      setIsConnected(false)
      console.log('[Socket] Desconectado')
    })

    // Nova mensagem recebida
    socket.on('whatsapp:new-message', (payload: {
      message: WhatsAppMessage
      conversationId: string
      conversation: Partial<WhatsAppConversation>
    }) => {
      const { message, conversationId, conversation } = payload

      // Adiciona a mensagem na lista da conversa
      setMessagesByConversation((prev) => ({
        ...prev,
        [conversationId]: [...(prev[conversationId] ?? []), message],
      }))

      // Atualiza o preview e unreadCount da conversa na lista
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                lastMessagePreview: conversation.lastMessagePreview ?? c.lastMessagePreview,
                lastMessageAt: conversation.lastMessageAt ?? c.lastMessageAt,
                unreadCount: conversation.unreadCount ?? c.unreadCount,
              }
            : c
        )
      )

      // Se a conversa ainda não existe na lista (primeira mensagem), adiciona
      setConversations((prev) => {
        const exists = prev.find((c) => c.id === conversationId)
        if (!exists && conversation) {
          return [conversation as WhatsAppConversation, ...prev]
        }
        return prev
      })
    })

    // Status de mensagem atualizado (sent → delivered → read)
    socket.on('whatsapp:message-status', ({ messageId, status }: { messageId: string; status: string }) => {
      setMessagesByConversation((prev) => {
        const updated = { ...prev }
        for (const convId of Object.keys(updated)) {
          updated[convId] = updated[convId].map((m) =>
            m.remoteMessageId === messageId ? { ...m, status: status as WhatsAppMessage['status'] } : m
          )
        }
        return updated
      })
    })

    // Conversa encerrada
    socket.on('whatsapp:conversation-closed', ({ conversationId }: { conversationId: string }) => {
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, status: 'CLOSED' } : c))
      )
    })

    return () => {
      socket.disconnect()
    }
  }, [])

  // ── Trocar conversa ativa ───────────────
  const setActiveConversation = useCallback(
    async (id: string) => {
      // Sai da sala anterior no socket
      if (previousConversationRef.current) {
        socketRef.current?.emit('leave:conversation', previousConversationRef.current)
      }

      setActiveConversationId(id)
      previousConversationRef.current = id

      // Entra na sala da nova conversa
      socketRef.current?.emit('join:conversation', id)

      // Zera unread
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c))
      )
      markConversationAsRead(id).catch(() => {})

      // Carrega mensagens só se ainda não tiver carregado
      if (messagesByConversation[id]) return

      setIsLoadingMessages(true)
      try {
        const { getMessages } = await import('@/lib/Whatsapp')
        const msgs = await getMessages(id, { limit: 50 })
        setMessagesByConversation((prev) => ({ ...prev, [id]: msgs }))
      } catch (err) {
        console.error('[WhatsApp] Erro ao carregar mensagens:', err)
      } finally {
        setIsLoadingMessages(false)
      }
    },
    [messagesByConversation]
  )

  // ── Encerrar conversa ───────────────────
  const closeConversation = useCallback(async (id: string) => {
    await closeConversationApi(id)
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: 'CLOSED' } : c))
    )
  }, [])

  // ── Adicionar mensagem enviada pelo próprio usuário ──
  const addOutgoingMessage = useCallback((msg: WhatsAppMessage) => {
    setMessagesByConversation((prev) => ({
      ...prev,
      [msg.conversationId]: [...(prev[msg.conversationId] ?? []), msg],
    }))
    setConversations((prev) =>
      prev.map((c) =>
        c.id === msg.conversationId
          ? { ...c, lastMessagePreview: msg.body ?? c.lastMessagePreview, lastMessageAt: msg.timestamp }
          : c
      )
    )
  }, [])

  const activeConversation = conversations.find((c) => c.id === activeConversationId) ?? null
  const messages = activeConversationId ? (messagesByConversation[activeConversationId] ?? []) : []

  return (
    <WhatsAppContext.Provider
      value={{
        conversations,
        isLoadingConversations,
        activeConversationId,
        setActiveConversation,
        activeConversation,
        messages,
        isLoadingMessages,
        closeConversation,
        addOutgoingMessage,
        isConnected,
      }}
    >
      {children}
    </WhatsAppContext.Provider>
  )
}

// ─────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────

export function useWhatsApp() {
  const ctx = useContext(WhatsAppContext)
  if (!ctx) throw new Error('useWhatsApp deve ser usado dentro de <WhatsAppProvider>')
  return ctx
}
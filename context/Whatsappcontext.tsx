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

interface MessagesByConversation {
  [conversationId: string]: WhatsAppMessage[]
}

interface WhatsAppContextValue {
  conversations: WhatsAppConversation[]
  isLoadingConversations: boolean
  activeConversationId: string | null
  setActiveConversation: (id: string) => void
  activeConversation: WhatsAppConversation | null
  messages: WhatsAppMessage[]
  isLoadingMessages: boolean
  closeConversation: (id: string, reason: string) => Promise<void>
  addOutgoingMessage: (msg: WhatsAppMessage) => void
  registerConversation: (conversation: WhatsAppConversation) => void
  isConnected: boolean
}

const WhatsAppContext = createContext<WhatsAppContextValue | null>(null)

function isConversationVisible(conversation: Partial<WhatsAppConversation> | null | undefined) {
  return conversation?.status !== 'CLOSED' && conversation?.status !== 'ARCHIVED'
}

function isSameMessage(a: WhatsAppMessage, b: WhatsAppMessage) {
  if (a.id && b.id) return a.id === b.id
  if (a.remoteMessageId && b.remoteMessageId) return a.remoteMessageId === b.remoteMessageId
  return false
}

function appendUniqueMessage(messages: WhatsAppMessage[], nextMessage: WhatsAppMessage) {
  const index = messages.findIndex((message) => isSameMessage(message, nextMessage))
  if (index === -1) return [...messages, nextMessage]

  const updated = [...messages]
  updated[index] = { ...updated[index], ...nextMessage }
  return updated
}

function dedupeMessages(messages: WhatsAppMessage[]) {
  return messages.reduce<WhatsAppMessage[]>((acc, message) => appendUniqueMessage(acc, message), [])
}

function sortConversations(conversations: WhatsAppConversation[]) {
  return [...conversations].sort((a, b) => {
    const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0
    const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0
    return bTime - aTime
  })
}

function upsertConversationInList(
  conversations: WhatsAppConversation[],
  nextConversation: Partial<WhatsAppConversation>
) {
  if (!isConversationVisible(nextConversation) || !nextConversation.id) return conversations

  const existing = conversations.find((conversation) => conversation.id === nextConversation.id)
  if (!existing) {
    return sortConversations([nextConversation as WhatsAppConversation, ...conversations])
  }

  return sortConversations(
    conversations.map((conversation) =>
      conversation.id === nextConversation.id
        ? { ...conversation, ...nextConversation }
        : conversation
    )
  )
}

export function WhatsAppProvider({ children }: { children: React.ReactNode }) {
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([])
  const [isLoadingConversations, setIsLoadingConversations] = useState(true)
  const [messagesByConversation, setMessagesByConversation] = useState<MessagesByConversation>({})
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  const socketRef = useRef<Socket | null>(null)
  const previousConversationRef = useRef<string | null>(null)

  useEffect(() => {
    async function loadConversations() {
      try {
        const result = await getConversations({ limit: 50 })
        setConversations(sortConversations(result.data.filter(isConversationVisible)))
      } catch (err) {
        console.error('[WhatsApp] Erro ao carregar conversas:', err)
      } finally {
        setIsLoadingConversations(false)
      }
    }

    loadConversations()
  }, [])

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

    socket.on('whatsapp:new-message', (payload: {
      message: WhatsAppMessage
      conversationId: string
      conversation?: Partial<WhatsAppConversation>
    }) => {
      const { message, conversationId, conversation } = payload

      setMessagesByConversation((prev) => ({
        ...prev,
        [conversationId]: appendUniqueMessage(prev[conversationId] ?? [], message),
      }))

      setConversations((prev) =>
        sortConversations(
          prev.map((conversationItem) =>
            conversationItem.id === conversationId
              ? {
                  ...conversationItem,
                  lastMessagePreview:
                    conversation?.lastMessagePreview ?? message.body ?? conversationItem.lastMessagePreview,
                  lastMessageAt:
                    conversation?.lastMessageAt ?? message.timestamp ?? conversationItem.lastMessageAt,
                  unreadCount: conversation?.unreadCount ?? conversationItem.unreadCount,
                }
              : conversationItem
          )
        )
      )

      setConversations((prev) => {
        if (!conversation) return prev
        return upsertConversationInList(prev, conversation)
      })
    })

    socket.on('whatsapp:conversation-upserted', ({ conversation }: { conversation: WhatsAppConversation }) => {
      setConversations((prev) => upsertConversationInList(prev, conversation))
    })

    socket.on('whatsapp:message-status', ({ messageId, status }: { messageId: string; status: string }) => {
      setMessagesByConversation((prev) => {
        const updated = { ...prev }
        for (const convId of Object.keys(updated)) {
          updated[convId] = updated[convId].map((message) =>
            message.remoteMessageId === messageId
              ? { ...message, status: status as WhatsAppMessage['status'] }
              : message
          )
        }
        return updated
      })
    })

    socket.on('whatsapp:conversation-closed', ({ conversationId }: { conversationId: string }) => {
      setConversations((prev) => prev.filter((conversation) => conversation.id !== conversationId))
      setMessagesByConversation((prev) => {
        const updated = { ...prev }
        delete updated[conversationId]
        return updated
      })
      setActiveConversationId((current) => (current === conversationId ? null : current))
      if (previousConversationRef.current === conversationId) {
        previousConversationRef.current = null
      }
    })

    return () => {
      socket.disconnect()
    }
  }, [])

  const setActiveConversation = useCallback(
    async (id: string) => {
      if (previousConversationRef.current) {
        socketRef.current?.emit('leave:conversation', previousConversationRef.current)
      }

      setActiveConversationId(id)
      previousConversationRef.current = id

      socketRef.current?.emit('join:conversation', id)

      setConversations((prev) =>
        prev.map((conversation) => (conversation.id === id ? { ...conversation, unreadCount: 0 } : conversation))
      )
      markConversationAsRead(id).catch(() => {})

      if (messagesByConversation[id]) return

      setIsLoadingMessages(true)
      try {
        const { getMessages } = await import('@/lib/Whatsapp')
        const messages = await getMessages(id, { limit: 50 })
        setMessagesByConversation((prev) => ({ ...prev, [id]: dedupeMessages(messages) }))
      } catch (err) {
        console.error('[WhatsApp] Erro ao carregar mensagens:', err)
      } finally {
        setIsLoadingMessages(false)
      }
    },
    [messagesByConversation]
  )

  const closeConversation = useCallback(async (id: string, reason: string) => {
    await closeConversationApi(id, reason)
    setConversations((prev) => prev.filter((conversation) => conversation.id !== id))
    setMessagesByConversation((prev) => {
      const updated = { ...prev }
      delete updated[id]
      return updated
    })
    setActiveConversationId((current) => (current === id ? null : current))
    if (previousConversationRef.current === id) {
      previousConversationRef.current = null
    }
  }, [])

  const addOutgoingMessage = useCallback((msg: WhatsAppMessage) => {
    setMessagesByConversation((prev) => ({
      ...prev,
      [msg.conversationId]: appendUniqueMessage(prev[msg.conversationId] ?? [], msg),
    }))
    setConversations((prev) =>
      sortConversations(
        prev.map((conversation) =>
          conversation.id === msg.conversationId
            ? {
                ...conversation,
                lastMessagePreview: msg.body ?? conversation.lastMessagePreview,
                lastMessageAt: msg.timestamp,
              }
            : conversation
        )
      )
    )
  }, [])

  const registerConversation = useCallback((conversation: WhatsAppConversation) => {
    setConversations((prev) => upsertConversationInList(prev, conversation))
  }, [])

  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId) ?? null
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
        registerConversation,
        isConnected,
      }}
    >
      {children}
    </WhatsAppContext.Provider>
  )
}

export function useWhatsApp() {
  const ctx = useContext(WhatsAppContext)
  if (!ctx) throw new Error('useWhatsApp deve ser usado dentro de <WhatsAppProvider>')
  return ctx
}

'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { io, Socket } from 'socket.io-client'
import { getUsers, getMe } from '@/lib/auth'
import {
  assignConversation as assignConversationApi,
  closeConversation as closeConversationApi,
  getConversations,
  getMessages,
  markConversationAsRead,
  saveConversationContact as saveConversationContactApi,
  type SaveConversationContactInput,
} from '@/lib/Whatsapp'
import type {
  ConversationPresence,
  CRMContact,
  OnlineAgent,
  WhatsAppConversation,
  WhatsAppMessage,
} from '@/types/Whatsapp.types'

interface MessagesByConversation {
  [conversationId: string]: WhatsAppMessage[]
}

interface WhatsAppContextValue {
  conversations: WhatsAppConversation[]
  isLoadingConversations: boolean
  activeConversationId: string | null
  setActiveConversation: (id: string) => Promise<void>
  activeConversation: WhatsAppConversation | null
  activePresence: ConversationPresence | null
  getPresenceForConversation: (conversationId?: string | null) => ConversationPresence | null
  messages: WhatsAppMessage[]
  isLoadingMessages: boolean
  closeConversation: (id: string, reason: string) => Promise<void>
  addOutgoingMessage: (msg: WhatsAppMessage) => void
  registerConversation: (conversation: WhatsAppConversation) => void
  assignConversation: (id: string, userId: string) => Promise<WhatsAppConversation>
  saveConversationContact: (
    id: string,
    payload: SaveConversationContactInput
  ) => Promise<{ conversation: WhatsAppConversation; contact: CRMContact }>
  agents: OnlineAgent[]
  currentUserId: string | null
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

function shouldShowConversationForUser(
  conversation: WhatsAppConversation,
  currentUserId: string | null
) {
  if (!isConversationVisible(conversation)) return false
  if (!currentUserId) return true
  return !conversation.assignedUserId || conversation.assignedUserId === currentUserId
}

function extractAudioDurationFromMessage(message?: WhatsAppMessage | null) {
  return (
    message?.raw?.message?.audioMessage?.seconds ??
    message?.raw?.audioMessage?.seconds ??
    null
  )
}

function getPreviewTextForMessage(message: WhatsAppMessage) {
  if (message.body?.trim()) return message.body.trim()
  if (message.type === 'image') return '[Imagem]'
  if (message.type === 'audio') return '[Audio]'
  if (message.type === 'video') return '[Video]'
  if (message.type === 'document') return '[Arquivo]'
  if (message.type === 'sticker') return '[Figurinha]'
  if (message.type === 'reaction') return '[Reacao]'
  return '[Mensagem]'
}

export function WhatsAppProvider({ children }: { children: React.ReactNode }) {
  const [allConversations, setAllConversations] = useState<WhatsAppConversation[]>([])
  const [isLoadingConversations, setIsLoadingConversations] = useState(true)
  const [messagesByConversation, setMessagesByConversation] = useState<MessagesByConversation>({})
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [agents, setAgents] = useState<OnlineAgent[]>([])
  const [presenceByRemoteJid, setPresenceByRemoteJid] = useState<Record<string, ConversationPresence>>({})

  const socketRef = useRef<Socket | null>(null)
  const previousConversationRef = useRef<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function bootstrap() {
      try {
        const [me, users, result] = await Promise.all([
          getMe(),
          getUsers().catch(() => []),
          getConversations({ limit: 50 }),
        ])

        if (!isMounted) return

        setCurrentUserId(me?.id ?? null)
        setAgents((prev) =>
          users.map((user) => ({
            ...user,
            isOnline: prev.find((agent) => agent.id === user.id)?.isOnline ?? false,
          }))
        )
        setAllConversations(sortConversations(result.data.filter(isConversationVisible)))
      } catch (err) {
        console.error('[WhatsApp] Erro ao carregar contexto inicial:', err)
      } finally {
        if (isMounted) setIsLoadingConversations(false)
      }
    }

    bootstrap()

    return () => {
      isMounted = false
    }
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

    socket.on('agents:online', ({ userIds }: { userIds: string[] }) => {
      setAgents((prev) =>
        prev.map((agent) => ({
          ...agent,
          isOnline: userIds.includes(agent.id),
        }))
      )
    })

    socket.on('whatsapp:presence', (presence: ConversationPresence) => {
      if (!presence?.remoteJid) return
      setPresenceByRemoteJid((prev) => ({
        ...prev,
        [presence.remoteJid]: presence,
      }))
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

      setAllConversations((prev) =>
        sortConversations(
          prev.map((conversationItem) =>
            conversationItem.id === conversationId
              ? {
                  ...conversationItem,
                  lastMessagePreview:
                    conversation?.lastMessagePreview ??
                    getPreviewTextForMessage(message) ??
                    conversationItem.lastMessagePreview,
                  lastMessageAt:
                    conversation?.lastMessageAt ?? message.timestamp ?? conversationItem.lastMessageAt,
                  unreadCount: conversation?.unreadCount ?? conversationItem.unreadCount,
                  assignedUserId: conversation?.assignedUserId ?? conversationItem.assignedUserId,
                  assignedUser: conversation?.assignedUser ?? conversationItem.assignedUser,
                  lastMessageType: conversation?.lastMessageType ?? message.type ?? conversationItem.lastMessageType,
                  lastMessageDurationSeconds:
                    conversation?.lastMessageDurationSeconds ??
                    (message.type === 'audio'
                      ? extractAudioDurationFromMessage(message)
                      : conversationItem.lastMessageDurationSeconds),
                }
              : conversationItem
          )
        )
      )

      setAllConversations((prev) => {
        if (!conversation) return prev
        return upsertConversationInList(prev, conversation)
      })
    })

    socket.on('whatsapp:conversation-upserted', ({ conversation }: { conversation: WhatsAppConversation }) => {
      setAllConversations((prev) => upsertConversationInList(prev, conversation))
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
      setAllConversations((prev) => prev.filter((conversation) => conversation.id !== conversationId))
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

  useEffect(() => {
    if (!socketRef.current || !currentUserId) return
    if (!socketRef.current.connected) return
    socketRef.current.emit('auth:register', currentUserId)
  }, [currentUserId, isConnected])

  const conversations = useMemo(
    () =>
      allConversations.filter((conversation) =>
        shouldShowConversationForUser(conversation, currentUserId)
      ),
    [allConversations, currentUserId]
  )

  useEffect(() => {
    if (!socketRef.current || !socketRef.current.connected || conversations.length === 0) return
    socketRef.current.emit(
      'watch:conversations',
      conversations
        .filter((conversation) => conversation.chatType === 'individual')
        .map((conversation) => conversation.id)
    )
  }, [conversations, isConnected])

  useEffect(() => {
    if (!activeConversationId) return
    const stillVisible = conversations.some((conversation) => conversation.id === activeConversationId)
    if (!stillVisible) {
      if (previousConversationRef.current) {
        socketRef.current?.emit('leave:conversation', previousConversationRef.current)
        previousConversationRef.current = null
      }
      setActiveConversationId(null)
    }
  }, [activeConversationId, conversations])

  const assignConversation = useCallback(async (id: string, userId: string) => {
    const conversation = await assignConversationApi(id, userId)
    setAllConversations((prev) => upsertConversationInList(prev, conversation))
    return conversation
  }, [])

  const setActiveConversation = useCallback(
    async (id: string) => {
      if (previousConversationRef.current) {
        socketRef.current?.emit('leave:conversation', previousConversationRef.current)
      }

      const selectedConversation = allConversations.find((conversation) => conversation.id === id)
      if (selectedConversation && !selectedConversation.assignedUserId && currentUserId) {
        try {
          await assignConversation(id, currentUserId)
        } catch (error) {
          console.error('[WhatsApp] Erro ao assumir atendimento:', error)
        }
      }

      setActiveConversationId(id)
      previousConversationRef.current = id

      socketRef.current?.emit('join:conversation', id)

      setAllConversations((prev) =>
        prev.map((conversation) => (conversation.id === id ? { ...conversation, unreadCount: 0 } : conversation))
      )
      markConversationAsRead(id).catch(() => {})

      if (messagesByConversation[id]) return

      setIsLoadingMessages(true)
      try {
        const messages = await getMessages(id, { limit: 50 })
        setMessagesByConversation((prev) => ({ ...prev, [id]: dedupeMessages(messages) }))
      } catch (err) {
        console.error('[WhatsApp] Erro ao carregar mensagens:', err)
      } finally {
        setIsLoadingMessages(false)
      }
    },
    [allConversations, assignConversation, currentUserId, messagesByConversation]
  )

  const closeConversation = useCallback(async (id: string, reason: string) => {
    await closeConversationApi(id, reason)
    setAllConversations((prev) => prev.filter((conversation) => conversation.id !== id))
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

  const addOutgoingMessage = useCallback(
    (msg: WhatsAppMessage) => {
      setMessagesByConversation((prev) => ({
        ...prev,
        [msg.conversationId]: appendUniqueMessage(prev[msg.conversationId] ?? [], msg),
      }))
      setAllConversations((prev) =>
        sortConversations(
          prev.map((conversation) =>
            conversation.id === msg.conversationId
              ? {
                  ...conversation,
                  lastMessagePreview: getPreviewTextForMessage(msg),
                  lastMessageAt: msg.timestamp,
                  assignedUserId: conversation.assignedUserId ?? currentUserId,
                  lastMessageType: msg.type,
                  lastMessageDurationSeconds:
                    msg.type === 'audio' ? extractAudioDurationFromMessage(msg) : null,
                }
              : conversation
          )
        )
      )
    },
    [currentUserId]
  )

  const registerConversation = useCallback((conversation: WhatsAppConversation) => {
    setAllConversations((prev) => upsertConversationInList(prev, conversation))
  }, [])

  const saveConversationContact = useCallback(
    async (id: string, payload: SaveConversationContactInput) => {
      const response = await saveConversationContactApi(id, payload)
      setAllConversations((prev) =>
        upsertConversationInList(prev, {
          ...response.conversation,
          contact: response.contact,
          contactId: response.contact.id,
        })
      )
      return response
    },
    []
  )

  const activeConversation =
    conversations.find((conversation) => conversation.id === activeConversationId) ?? null
  const messages = activeConversationId ? (messagesByConversation[activeConversationId] ?? []) : []

  const getPresenceForConversation = useCallback(
    (conversationId?: string | null) => {
      if (!conversationId) return null
      const conversation = allConversations.find((item) => item.id === conversationId)
      if (!conversation?.remoteJid) return null
      return presenceByRemoteJid[conversation.remoteJid] ?? null
    },
    [allConversations, presenceByRemoteJid]
  )

  const activePresence = getPresenceForConversation(activeConversationId)

  return (
    <WhatsAppContext.Provider
      value={{
        conversations,
        isLoadingConversations,
        activeConversationId,
        setActiveConversation,
        activeConversation,
        activePresence,
        getPresenceForConversation,
        messages,
        isLoadingMessages,
        closeConversation,
        addOutgoingMessage,
        registerConversation,
        assignConversation,
        saveConversationContact,
        agents,
        currentUserId,
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

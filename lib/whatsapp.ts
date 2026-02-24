import { api } from './api'

export type WhatsAppStatus = {
  instanceId: string
  status: 'disconnected' | 'connecting' | 'qr' | 'connected' | 'logged_out' | 'error'
  qrCodeDataUrl: string | null
  lastError: string | null
  wid: string | null
  phoneNumber: string | null
  displayName: string | null
  lastSeenAt: string | null
}

export type WhatsAppConversation = {
  id: string
  remoteJid: string
  isArchived?: boolean
  phone?: string | null
  pushName?: string | null
  waName?: string | null
  lastMessagePreview?: string | null
  lastMessageAt?: string | null
  unreadCount: number
  assignedUserId?: string | null
  assignedUser?: { id: string; name: string; email: string } | null
  contact?: { id: string; name: string; phone?: string | null; email?: string | null; segment?: string | null } | null
  messages?: Array<{
    id: string
    body?: string | null
    type: string
    fromMe: boolean
    timestamp: string
    senderUserId?: string | null
  }>
}

export type WhatsAppMessage = {
  id: string
  body?: string | null
  type: string
  fromMe: boolean
  timestamp: string
  status?: string
  senderUserId?: string | null
  senderUser?: { id: string; name: string; email: string } | null
}

export async function getWhatsAppStatus() {
  const { data } = await api.get<WhatsAppStatus>('/whatsapp/status')
  return data
}

export async function connectWhatsApp() {
  const { data } = await api.post<WhatsAppStatus>('/whatsapp/connect')
  return data
}

export async function disconnectWhatsApp(params?: { resetSession?: boolean }) {
  const { data } = await api.post<WhatsAppStatus>('/whatsapp/disconnect', params || {})
  return data
}

export async function getWhatsAppConversations(params?: {
  scope?: 'all' | 'mine'
  search?: string
  limit?: number
}) {
  const { data } = await api.get<WhatsAppConversation[]>('/whatsapp/conversations', {
    params,
  })
  return data
}

export async function getWhatsAppConversationMessages(
  conversationId: string,
  params?: { limit?: number },
) {
  const { data } = await api.get<{
    conversation: WhatsAppConversation
    messages: WhatsAppMessage[]
  }>(`/whatsapp/conversations/${conversationId}/messages`, { params })
  return data
}

export async function sendWhatsAppTextMessage(conversationId: string, text: string) {
  const { data } = await api.post(`/whatsapp/conversations/${conversationId}/messages`, {
    text,
  })
  return data
}

export async function markWhatsAppConversationRead(conversationId: string) {
  await api.post(`/whatsapp/conversations/${conversationId}/read`)
}

export async function closeWhatsAppConversation(conversationId: string) {
  const { data } = await api.post(`/whatsapp/conversations/${conversationId}/close`)
  return data
}

export async function assignWhatsAppConversationToMe(conversationId: string) {
  const { data } = await api.post(`/whatsapp/conversations/${conversationId}/assign/me`)
  return data
}

export async function assignWhatsAppConversation(conversationId: string, userId: string | null) {
  const { data } = await api.post(`/whatsapp/conversations/${conversationId}/assign`, {
    userId,
  })
  return data
}

export async function startWhatsAppConversation(params: {
  phone: string
  name?: string
  initialMessage?: string
}) {
  const { data } = await api.post<WhatsAppConversation>('/whatsapp/conversations/start', params)
  return data
}

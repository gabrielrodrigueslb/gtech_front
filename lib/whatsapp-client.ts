// frontend service -- nao confundir com o whatsapp.service.js do backend
import { api } from './api'
import type {
  CRMContact,
  ConversationPresence,
  ConversationsPage,
  WhatsAppConversation,
  WhatsAppMessage,
  WhatsAppSession,
} from '@/types/Whatsapp.types'

export type OpenConversationInput = {
  phone: string
  contactId?: string
  name?: string
  initialMessage?: string
}

export type WhatsAppConversationProfile = {
  conversationId: string
  avatarUrl: string | null
  displayName: string
}

export type SendWhatsAppMediaInput = {
  mediaDataUrl: string
  mimeType?: string
  fileName?: string
  type?: 'image' | 'audio' | 'document' | 'sticker' | 'video'
  caption?: string
  ptt?: boolean
  seconds?: number
}

export type SaveConversationContactInput = {
  name: string
  email?: string
  phone?: string
  segment?: string
  company?: string
  status?: string
  notes?: string
  tags?: string[]
}

export const DEFAULT_WHATSAPP_CLOSE_REASONS = [
  'Atendimento concluido',
  'Cliente nao respondeu',
  'Solicitacao resolvida em outro canal',
  'Atendimento duplicado',
]

export const DEFAULT_WHATSAPP_CONTACT_TAGS = ['VIP', 'Frequente', 'Suporte', 'Inbound']

export async function getWhatsAppSession(): Promise<WhatsAppSession> {
  const { data } = await api.get('/whatsapp/session')
  return data
}

export async function connectWhatsApp(): Promise<void> {
  await api.post('/whatsapp/session/connect')
}

export async function logoutWhatsApp(): Promise<void> {
  await api.post('/whatsapp/session/logout')
}

export async function getConversations(params?: {
  status?: string
  page?: number
  limit?: number
  search?: string
}): Promise<ConversationsPage> {
  const { data } = await api.get('/whatsapp/conversations', { params })
  return data
}

export async function openConversation(
  input: OpenConversationInput
): Promise<WhatsAppConversation> {
  const { data } = await api.post('/whatsapp/conversations/open', input)
  return data
}

export async function getConversation(id: string): Promise<WhatsAppConversation> {
  const { data } = await api.get(`/whatsapp/conversations/${id}`)
  return data
}

export async function getConversationProfile(
  id: string
): Promise<WhatsAppConversationProfile> {
  const { data } = await api.get(`/whatsapp/conversations/${id}/profile`)
  return data
}

export async function getConversationPresence(
  id: string
): Promise<ConversationPresence | null> {
  const { data } = await api.get(`/whatsapp/conversations/${id}/presence`)
  return data
}

export async function getCloseReasons(): Promise<string[]> {
  const { data } = await api.get('/whatsapp/close-reasons')
  return data.data ?? []
}

export async function createCloseReason(reason: string): Promise<string[]> {
  const { data } = await api.post('/whatsapp/close-reasons', { reason })
  return data.data ?? []
}

export async function deleteCloseReason(reason: string): Promise<string[]> {
  const { data } = await api.delete('/whatsapp/close-reasons', { data: { reason } })
  return data.data ?? []
}

export async function getContactTags(): Promise<string[]> {
  const { data } = await api.get('/whatsapp/contact-tags')
  return data.data ?? []
}

export async function createContactTag(tag: string): Promise<string[]> {
  const { data } = await api.post('/whatsapp/contact-tags', { tag })
  return data.data ?? []
}

export async function deleteContactTag(tag: string): Promise<string[]> {
  const { data } = await api.delete('/whatsapp/contact-tags', { data: { tag } })
  return data.data ?? []
}

export async function closeConversation(
  id: string,
  reason: string
): Promise<WhatsAppConversation> {
  const { data } = await api.post(`/whatsapp/conversations/${id}/close`, { reason })
  return data
}

export async function assignConversation(
  id: string,
  userId: string
): Promise<WhatsAppConversation> {
  const { data } = await api.post(`/whatsapp/conversations/${id}/assign`, { userId })
  return data
}

export async function saveConversationContact(
  id: string,
  input: SaveConversationContactInput
): Promise<{ conversation: WhatsAppConversation; contact: CRMContact }> {
  const { data } = await api.post(`/whatsapp/conversations/${id}/contact`, input)
  return data
}

export async function markConversationAsRead(id: string): Promise<void> {
  await api.patch(`/whatsapp/conversations/${id}/read`)
}

export async function getMessages(
  conversationId: string,
  params?: { cursor?: string; limit?: number }
): Promise<WhatsAppMessage[]> {
  const { data } = await api.get(`/whatsapp/conversations/${conversationId}/messages`, { params })
  return data
}

export async function sendMessage(
  conversationId: string,
  text: string,
  senderUserId: string
): Promise<WhatsAppMessage> {
  const { data } = await api.post(`/whatsapp/conversations/${conversationId}/messages`, {
    text,
    senderUserId,
  })
  return data
}

export async function sendMediaMessage(
  conversationId: string,
  input: SendWhatsAppMediaInput
): Promise<WhatsAppMessage> {
  const { data } = await api.post(`/whatsapp/conversations/${conversationId}/messages`, input)
  return data
}

export function normalizeWhatsAppMediaMimeType(
  mimeType?: string | null,
  declaredType?: SendWhatsAppMediaInput['type']
) {
  const original = String(mimeType ?? '').trim().toLowerCase()
  if (!original) return undefined

  const baseMimeType = original.split(';')[0]?.trim()
  if (!baseMimeType) return undefined

  if (declaredType === 'audio' || baseMimeType.startsWith('audio/')) {
    if (baseMimeType === 'audio/ogg' || baseMimeType === 'application/ogg') {
      return 'audio/ogg'
    }

    if (
      baseMimeType === 'audio/mp4' ||
      baseMimeType === 'audio/m4a' ||
      baseMimeType === 'audio/x-m4a'
    ) {
      return 'audio/mp4'
    }

    if (baseMimeType === 'audio/webm') {
      return original.includes('opus') ? 'audio/webm; codecs=opus' : 'audio/webm'
    }

    if (baseMimeType === 'audio/mp3' || baseMimeType === 'audio/mpeg') {
      return 'audio/mpeg'
    }

    if (
      baseMimeType === 'audio/wav' ||
      baseMimeType === 'audio/x-wav' ||
      baseMimeType === 'audio/wave'
    ) {
      return 'audio/wav'
    }

    if (baseMimeType === 'audio/aac') {
      return 'audio/aac'
    }
  }

  return baseMimeType
}

export function resolveWhatsAppMediaUrl(mediaUrl?: string | null) {
  if (!mediaUrl) return null
  if (/^https?:\/\//i.test(mediaUrl) || mediaUrl.startsWith('blob:') || mediaUrl.startsWith('data:')) {
    return mediaUrl
  }

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? ''
  const socketBaseUrl = process.env.NEXT_PUBLIC_SOCKET_URL ?? ''
  const publicBaseUrl = (apiBaseUrl.replace(/\/api\/?$/, '') || socketBaseUrl).replace(/\/$/, '')
  return `${publicBaseUrl}${mediaUrl}`
}

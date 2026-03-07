// frontend service -- nao confundir com o whatsapp.service.js do backend
import { api } from './api'
import type {
  ConversationsPage,
  WhatsAppConversation,
  WhatsAppMessage,
  WhatsAppSession,
} from '@/types/Whatsapp.types'

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

export async function getConversation(id: string): Promise<WhatsAppConversation> {
  const { data } = await api.get(`/whatsapp/conversations/${id}`)
  return data
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

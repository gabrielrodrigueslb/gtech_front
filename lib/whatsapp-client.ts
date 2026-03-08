// frontend service -- nao confundir com o whatsapp.service.js do backend
import { api } from './api'
import type {
  WhatsAppAiAgentConfigUpdateInput,
  WhatsAppAiAgentConfig,
  WhatsAppAiKnowledgeFileCreateInput,
  WhatsAppAiKnowledgeItem,
  WhatsAppAiKnowledgeManualCreateInput,
  WhatsAppAiKnowledgeUpdateInput,
  CRMContact,
  ConversationPresence,
  ConversationsPage,
  WhatsAppDistributionConfig,
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

export type CloseConversationScheduleInput = {
  reopenAt: string
  message?: string
  sendMessage?: boolean
}

export const DEFAULT_WHATSAPP_CLOSE_REASONS = [
  'Atendimento concluido',
  'Cliente nao respondeu',
  'Solicitacao resolvida em outro canal',
  'Atendimento duplicado',
]

export const DEFAULT_WHATSAPP_CONTACT_TAGS = ['VIP', 'Frequente', 'Suporte', 'Inbound']

export const WHATSAPP_AI_MODEL_PRESETS = {
  openai: [
    {
      value: 'gpt-4o-mini',
      label: 'GPT-4o mini',
      description: 'Mais rapido e economico para atendimento diario.',
    },
    {
      value: 'gpt-4o',
      label: 'GPT-4o',
      description: 'Resposta mais completa sem sair da familia 4o.',
    },
    {
      value: 'gpt-4.1-nano',
      label: 'GPT-4.1 nano',
      description: 'Menor custo e latencia para fluxos bem objetivos.',
    },
    {
      value: 'gpt-4.1-mini',
      label: 'GPT-4.1 mini',
      description: 'Equilibrio entre velocidade, contexto e qualidade.',
    },
    {
      value: 'gpt-4.1',
      label: 'GPT-4.1',
      description: 'Opcao mais robusta para instrucoes longas e casos complexos.',
    },
    {
      value: 'gpt-3.5-turbo',
      label: 'GPT-3.5 Turbo',
      description: 'Legado, util quando o foco for custo e compatibilidade.',
    },
  ],
  gemini: [
    {
      value: 'gemini-2.5-flash',
      label: 'Gemini 2.5 Flash',
      description: 'Rapido e equilibrado para atendimento automatico.',
    },
    {
      value: 'gemini-2.5-flash-lite',
      label: 'Gemini 2.5 Flash-Lite',
      description: 'Versao mais enxuta para menor custo e baixa latencia.',
    },
    {
      value: 'gemini-2.5-pro',
      label: 'Gemini 2.5 Pro',
      description: 'Melhor para raciocinio e instrucoes mais exigentes.',
    },
    {
      value: 'gemini-3-flash-preview',
      label: 'Gemini 3 Flash Preview',
      description: 'Preview mais novo para testes controlados.',
    },
  ],
} as const

export const DEFAULT_WHATSAPP_AI_AGENT_CONFIG: WhatsAppAiAgentConfig = {
  enabled: false,
  provider: 'openai',
  agentName: 'Assistente virtual',
  onlyUnassignedConversations: true,
  replyToGroups: false,
  responseDelayMs: 1500,
  maxContextMessages: 12,
  temperature: 0.4,
  systemPrompt:
    'Voce e o agente virtual de atendimento da Lintra Tech no WhatsApp. Responda sempre em portugues do Brasil, com clareza, objetividade e tom profissional. Priorize respostas curtas, praticas e uteis para avancar o atendimento. Se nao tiver certeza sobre um dado, diga que vai encaminhar para um atendente humano. Nunca invente precos, prazos, politicas internas ou promessas que nao estejam confirmadas.',
  openai: {
    apiKey: '',
    clearApiKey: false,
    model: 'gpt-4o-mini',
  },
  gemini: {
    apiKey: '',
    clearApiKey: false,
    model: 'gemini-2.5-flash',
  },
}

export const DEFAULT_WHATSAPP_DISTRIBUTION_CONFIG: WhatsAppDistributionConfig = {
  newConversations: {
    strategy: 'manual_queue',
    passThroughAiFirst: false,
  },
  queueTransfers: {
    strategy: 'manual_queue',
    passThroughAiFirst: false,
  },
  aiHandoff: {
    enabled: true,
  },
}

type WhatsAppAiAgentTransportKeyResponse = {
  publicKey: string
}

let aiAgentTransportPublicKeyPromise: Promise<string> | null = null
let aiAgentTransportCryptoKeyPromise: Promise<CryptoKey> | null = null

function pemToArrayBuffer(pem: string) {
  const normalized = pem
    .replace('-----BEGIN PUBLIC KEY-----', '')
    .replace('-----END PUBLIC KEY-----', '')
    .replace(/\s+/g, '')

  const binary = atob(normalized)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes.buffer
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''

  for (let index = 0; index < bytes.byteLength; index += 1) {
    binary += String.fromCharCode(bytes[index] ?? 0)
  }

  return btoa(binary)
}

async function getWhatsAppAiAgentTransportPublicKey() {
  if (!aiAgentTransportPublicKeyPromise) {
    aiAgentTransportPublicKeyPromise = api
      .get<WhatsAppAiAgentTransportKeyResponse>('/whatsapp/ai-agent/public-key')
      .then(({ data }) => data.publicKey)
      .catch((error) => {
        aiAgentTransportPublicKeyPromise = null
        throw error
      })
  }

  return aiAgentTransportPublicKeyPromise
}

async function getWhatsAppAiAgentTransportCryptoKey() {
  if (!globalThis.crypto?.subtle) {
    throw new Error('O navegador nao suporta criptografia segura para salvar a chave do agente IA.')
  }

  if (!aiAgentTransportCryptoKeyPromise) {
    aiAgentTransportCryptoKeyPromise = getWhatsAppAiAgentTransportPublicKey()
      .then((publicKey) =>
        globalThis.crypto.subtle.importKey(
          'spki',
          pemToArrayBuffer(publicKey),
          { name: 'RSA-OAEP', hash: 'SHA-256' },
          false,
          ['encrypt']
        )
      )
      .catch((error) => {
        aiAgentTransportCryptoKeyPromise = null
        throw error
      })
  }

  return aiAgentTransportCryptoKeyPromise
}

async function encryptAiAgentApiKey(apiKey: string) {
  const normalized = apiKey.trim()
  if (!normalized) return ''

  const cryptoKey = await getWhatsAppAiAgentTransportCryptoKey()
  const encrypted = await globalThis.crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    cryptoKey,
    new TextEncoder().encode(normalized)
  )

  return arrayBufferToBase64(encrypted)
}

async function buildProviderUpdateInput(
  providerSettings: WhatsAppAiAgentConfig['openai']
) {
  const encryptedApiKey = await encryptAiAgentApiKey(providerSettings.apiKey)

  return {
    model: providerSettings.model,
    clearApiKey: encryptedApiKey ? false : Boolean(providerSettings.clearApiKey),
    ...(encryptedApiKey ? { encryptedApiKey } : {}),
  }
}

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
  day?: string
}): Promise<ConversationsPage> {
  const { data } = await api.get('/whatsapp/conversations', { params })
  return data
}

export async function getHistoricalConversations(params?: {
  page?: number
  limit?: number
  search?: string
  day?: string
}): Promise<ConversationsPage> {
  const { data } = await api.get('/whatsapp/conversations/history', { params })
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

export async function getWhatsAppAiAgentConfig(): Promise<WhatsAppAiAgentConfig> {
  const { data } = await api.get('/whatsapp/ai-agent')
  return data
}

export async function updateWhatsAppAiAgentConfig(
  input: WhatsAppAiAgentConfig
): Promise<WhatsAppAiAgentConfig> {
  const payload: WhatsAppAiAgentConfigUpdateInput = {
    enabled: input.enabled,
    provider: input.provider,
    agentName: input.agentName,
    onlyUnassignedConversations: input.onlyUnassignedConversations,
    replyToGroups: input.replyToGroups,
    responseDelayMs: input.responseDelayMs,
    maxContextMessages: input.maxContextMessages,
    temperature: input.temperature,
    systemPrompt: input.systemPrompt,
    openai: await buildProviderUpdateInput(input.openai),
    gemini: await buildProviderUpdateInput(input.gemini),
  }

  const { data } = await api.put('/whatsapp/ai-agent', payload)
  return data
}

export async function getWhatsAppAiKnowledgeItems(): Promise<WhatsAppAiKnowledgeItem[]> {
  const { data } = await api.get('/whatsapp/ai-agent/knowledge')
  return data.data ?? []
}

export async function createWhatsAppAiKnowledgeManualItem(
  input: WhatsAppAiKnowledgeManualCreateInput
): Promise<WhatsAppAiKnowledgeItem> {
  const { data } = await api.post('/whatsapp/ai-agent/knowledge/manual', input)
  return data
}

export async function createWhatsAppAiKnowledgeFileItem(
  input: WhatsAppAiKnowledgeFileCreateInput
): Promise<WhatsAppAiKnowledgeItem> {
  const { data } = await api.post('/whatsapp/ai-agent/knowledge/upload', input)
  return data
}

export async function updateWhatsAppAiKnowledgeItem(
  id: string,
  input: WhatsAppAiKnowledgeUpdateInput
): Promise<WhatsAppAiKnowledgeItem> {
  const { data } = await api.put(`/whatsapp/ai-agent/knowledge/${id}`, input)
  return data
}

export async function deleteWhatsAppAiKnowledgeItem(id: string): Promise<WhatsAppAiKnowledgeItem[]> {
  const { data } = await api.delete(`/whatsapp/ai-agent/knowledge/${id}`)
  return data.data ?? []
}

export async function getWhatsAppDistributionConfig(): Promise<WhatsAppDistributionConfig> {
  const { data } = await api.get('/whatsapp/distribution')
  return data
}

export async function updateWhatsAppDistributionConfig(
  input: WhatsAppDistributionConfig
): Promise<WhatsAppDistributionConfig> {
  const { data } = await api.put('/whatsapp/distribution', input)
  return data
}

export async function closeConversation(
  id: string,
  reason: string,
  reopenSchedule?: CloseConversationScheduleInput | null
): Promise<WhatsAppConversation> {
  const { data } = await api.post(`/whatsapp/conversations/${id}/close`, {
    reason,
    reopenSchedule: reopenSchedule ?? null,
  })
  return data
}

export async function assignConversation(
  id: string,
  userId: string
): Promise<WhatsAppConversation> {
  const { data } = await api.post(`/whatsapp/conversations/${id}/assign`, { userId })
  return data
}

export async function returnConversationToQueue(id: string): Promise<WhatsAppConversation> {
  const { data } = await api.post(`/whatsapp/conversations/${id}/queue`)
  return data
}

export async function routeConversationToAi(id: string): Promise<WhatsAppConversation> {
  const { data } = await api.post(`/whatsapp/conversations/${id}/route/ai`)
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

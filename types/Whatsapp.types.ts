export interface CRMContact {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  segment?: string | null
  company?: string | null
  status?: 'lead' | 'prospect' | 'customer' | 'inactive' | string
  notes?: string | null
  tags?: string[]
}

export interface ConversationPresence {
  remoteJid: string
  status: 'online' | 'typing' | 'recording' | 'offline'
  lastKnownPresence?: string
  lastSeen?: number | null
}

export interface OnlineAgent {
  id: string
  name: string
  email: string
  active: boolean
  isOnline: boolean
}

export interface WhatsAppSession {
  id: string
  status: 'DISCONNECTED' | 'CONNECTING' | 'QR_READY' | 'CONNECTED' | 'BANNED' | 'ERROR'
  qrCodeDataUrl?: string | null
  phoneNumber?: string | null
  displayName?: string | null
  lastError?: string | null
}

export interface WhatsAppAiProviderSettings {
  apiKey: string
  model: string
  clearApiKey?: boolean
}

export interface WhatsAppAiProviderSettingsUpdateInput {
  model: string
  clearApiKey?: boolean
  encryptedApiKey?: string
}

export interface WhatsAppAiAgentCredentialsSummary {
  openai: {
    hasApiKey: boolean
    usesStoredApiKey: boolean
  }
  gemini: {
    hasApiKey: boolean
    usesStoredApiKey: boolean
  }
}

export interface WhatsAppAiAgentRuntimeSummary {
  activeProvider: 'openai' | 'gemini'
  activeModel: string
  hasActiveApiKey: boolean
  canGenerateReply: boolean
  blockingReasons: string[]
  responseDelayMs: number
  responseDelayLabel: string
}

export interface WhatsAppAiAgentConfig {
  enabled: boolean
  provider: 'openai' | 'gemini'
  agentName: string
  onlyUnassignedConversations: boolean
  replyToGroups: boolean
  responseDelayMs: number
  maxContextMessages: number
  temperature: number
  systemPrompt: string
  openai: WhatsAppAiProviderSettings
  gemini: WhatsAppAiProviderSettings
  credentials?: WhatsAppAiAgentCredentialsSummary
  runtime?: WhatsAppAiAgentRuntimeSummary
}

export interface WhatsAppAiAgentConfigUpdateInput {
  enabled: boolean
  provider: 'openai' | 'gemini'
  agentName: string
  onlyUnassignedConversations: boolean
  replyToGroups: boolean
  responseDelayMs: number
  maxContextMessages: number
  temperature: number
  systemPrompt: string
  openai: WhatsAppAiProviderSettingsUpdateInput
  gemini: WhatsAppAiProviderSettingsUpdateInput
}

export interface WhatsAppAiKnowledgeItem {
  id: string
  title: string
  content: string
  sourceType: 'manual' | 'file'
  fileName?: string | null
  mimeType?: string | null
  sizeBytes?: number | null
  enabled: boolean
  alwaysInclude: boolean
  createdAt: string
  updatedAt: string
  contentPreview?: string
  contentLength?: number
}

export interface WhatsAppAiKnowledgeManualCreateInput {
  title: string
  content: string
  alwaysInclude?: boolean
}

export interface WhatsAppAiKnowledgeFileCreateInput {
  title?: string
  fileName: string
  dataUrl: string
  alwaysInclude?: boolean
}

export interface WhatsAppAiKnowledgeUpdateInput {
  title: string
  content: string
  enabled: boolean
  alwaysInclude: boolean
}

export type WhatsAppConversationRoutingOwnerType = 'queue' | 'user' | 'ai_agent'

export type WhatsAppHumanHandoffStrategy =
  | 'manual_queue'
  | 'online_round_robin'
  | 'online_random'

export interface WhatsAppConversationRouting {
  ownerType: WhatsAppConversationRoutingOwnerType
  ownerId?: string | null
  source?:
    | 'new_conversation'
    | 'queue_transfer'
    | 'manual_assign'
    | 'manual_ai'
    | 'ai_handoff'
    | 'system'
    | string
  humanHandoffStrategy?: WhatsAppHumanHandoffStrategy
  updatedAt?: string | null
}

export interface WhatsAppDistributionNewConversationsConfig {
  strategy: 'manual_queue' | 'online_round_robin'
  passThroughAiFirst: boolean
}

export interface WhatsAppDistributionQueueTransfersConfig {
  strategy: 'manual_queue' | 'online_round_robin' | 'online_random'
  passThroughAiFirst: boolean
}

export interface WhatsAppDistributionRuntimeSummary {
  newConversations: {
    strategy: WhatsAppDistributionNewConversationsConfig['strategy']
    passThroughAiFirst: boolean
  }
  queueTransfers: {
    strategy: WhatsAppDistributionQueueTransfersConfig['strategy']
    passThroughAiFirst: boolean
  }
  aiHandoff: {
    enabled: boolean
  }
}

export interface WhatsAppDistributionConfig {
  newConversations: WhatsAppDistributionNewConversationsConfig
  queueTransfers: WhatsAppDistributionQueueTransfersConfig
  aiHandoff: {
    enabled: boolean
  }
  runtime?: WhatsAppDistributionRuntimeSummary
}

export interface WhatsAppConversation {
  id: string
  instanceKey: string
  remoteJid: string
  chatType: 'individual' | 'group'
  phone?: string | null
  pushName?: string | null
  waName?: string | null
  lastMessagePreview?: string | null
  lastMessageAt?: string | null
  lastMessageType?: WhatsAppMessage['type'] | null
  lastMessageDurationSeconds?: number | null
  unreadCount: number
  isArchived: boolean
  status: 'PENDING' | 'OPEN' | 'CLOSED' | 'ARCHIVED'
  closedAt?: string | null
  lastCloseReason?: string | null
  lastClosedByName?: string | null
  scheduledReopenAt?: string | null
  scheduledReopenMessage?: string | null
  scheduledReopenSendMessage?: boolean
  scheduledReopenCreatedByName?: string | null
  contactId?: string | null
  assignedUserId?: string | null
  contact?: CRMContact | null
  assignedUser?: { id: string; name: string } | null
  routing?: WhatsAppConversationRouting | null
}

export interface WhatsAppMessage {
  id: string
  conversationId: string
  remoteMessageId?: string | null
  remoteJid: string
  fromMe: boolean
  type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'sticker' | 'reaction' | 'system' | 'unknown'
  body?: string | null
  mediaUrl?: string | null
  mediaType?: string | null
  mediaMimeType?: string | null
  raw?: any
  timestamp: string
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | 'RECEIVED'
  senderUserId?: string | null
}

export interface ConversationsPage {
  data: WhatsAppConversation[]
  total: number
  page: number
  limit: number
  day?: string
}

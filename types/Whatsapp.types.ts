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

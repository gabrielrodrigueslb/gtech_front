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
  unreadCount: number
  isArchived: boolean
  status: 'PENDING' | 'OPEN' | 'CLOSED' | 'ARCHIVED'
  closedAt?: string | null
  contactId?: string | null
  assignedUserId?: string | null
  contact?: { id: string; name: string; email?: string } | null
  assignedUser?: { id: string; name: string } | null
}

export interface WhatsAppMessage {
  id: string
  conversationId: string
  remoteMessageId?: string | null
  remoteJid: string
  fromMe: boolean
  type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'sticker' | 'reaction' | 'unknown'
  body?: string | null
  mediaUrl?: string | null
  mediaType?: string | null
  mediaMimeType?: string | null
  timestamp: string
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | 'RECEIVED'
  senderUserId?: string | null
}

export interface ConversationsPage {
  data: WhatsAppConversation[]
  total: number
  page: number
  limit: number
}
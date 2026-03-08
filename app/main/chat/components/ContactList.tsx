'use client'
import { useWhatsApp } from '@/context/Whatsappcontext'
import { useMemo } from 'react'
import ContactCard from './ContactCard'
import {
  FileAudio,
  FileImage,
  FileText,
  History,
  MessageCircleCode,
  Sticker,
  Video,
} from 'lucide-react'
import type { WhatsAppConversation } from '@/types/Whatsapp.types'

type ContactListProps = {
  filter: 'mine' | 'unassigned'
  searchQuery?: string
  onConversationOpen?: () => void
}

function normalizeSearchValue(value?: string | null) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function extractDigits(value?: string | null) {
  return (value ?? '').replace(/\D/g, '')
}

export default function ContactList({
  filter,
  searchQuery = '',
  onConversationOpen,
}: ContactListProps) {
  const {
    conversations,
    isLoadingConversations,
    activeConversationId,
    setActiveConversation,
    currentUserId,
  } =
    useWhatsApp()

  const normalizedSearchQuery = normalizeSearchValue(searchQuery)
  const searchDigits = extractDigits(searchQuery)

  const filteredConversations = useMemo(
    () =>
      conversations.filter((conversation) => {
        const matchesQueue =
          filter === 'unassigned'
            ? !conversation.assignedUserId
            : conversation.assignedUserId === currentUserId

        if (!matchesQueue) return false
        if (!normalizedSearchQuery && !searchDigits) return true

        const searchableText = [
          conversation.contact?.name,
          conversation.contact?.email,
          conversation.contact?.phone,
          conversation.pushName,
          conversation.waName,
          conversation.phone,
          conversation.remoteJid.split('@')[0],
          conversation.lastMessagePreview,
        ]
          .map((value) => normalizeSearchValue(value))
          .filter(Boolean)

        const searchableDigits = [
          conversation.contact?.phone,
          conversation.phone,
          conversation.remoteJid.split('@')[0],
        ]
          .map((value) => extractDigits(value))
          .filter(Boolean)

        const matchesText = normalizedSearchQuery
          ? searchableText.some((value) => value.includes(normalizedSearchQuery))
          : false

        const matchesDigits = searchDigits
          ? searchableDigits.some((value) => value.includes(searchDigits))
          : false

        return matchesText || matchesDigits
      }),
    [conversations, currentUserId, filter, normalizedSearchQuery, searchDigits]
  )

  if (isLoadingConversations) {
    return (
      <ul className="flex-col flex w-full h-full overflow-y-auto">
        {Array.from({ length: 5 }).map((_, i) => (
          <li key={i} className="w-full flex items-center px-3 py-4 gap-2 animate-pulse">
            <div className="w-[52px] h-[52px] rounded-full bg-white/10 shrink-0" />
            <div className="flex flex-col gap-2 flex-1">
              <div className="h-3 bg-white/10 rounded w-2/3" />
              <div className="h-3 bg-white/10 rounded w-1/2" />
            </div>
          </li>
        ))}
      </ul>
    )
  }

  if (filteredConversations.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm opacity-40 p-6 text-center">
        {searchQuery.trim()
          ? 'Nenhum atendimento encontrado para essa busca'
          : filter === 'unassigned'
            ? 'Nenhum atendimento aguardando atribuicao'
            : 'Nenhum atendimento atribuido a voce'}
      </div>
    )
  }

  return (
    <ul className="flex-col flex w-full h-full overflow-y-auto">
      {filteredConversations.map((conv) => {
        const preview = buildMessagePreview(conv)

        return (
          <ContactCard
            key={conv.id}
            conversationId={conv.id}
            lastMessage={preview.text}
            lastMessageIcon={preview.icon}
            isPreviewHighlight={preview.highlight}
            nomeContato={conv.contact?.name ?? conv.pushName ?? conv.phone ?? 'Desconhecido'}
            hora={conv.lastMessageAt ? formatHora(conv.lastMessageAt) : ''}
            online={false}
            isActive={conv.id === activeConversationId}
            noRead={conv.unreadCount > 0}
            unreadCount={conv.unreadCount}
            status={conv.status}
            onClick={() => {
              onConversationOpen?.()
              void setActiveConversation(conv.id)
            }}
          />
        )
      })}
    </ul>
  )
}

function formatHora(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()

  if (isToday) {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function formatDuration(totalSeconds?: number | null) {
  if (!totalSeconds || totalSeconds < 1) return '00:00'
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function buildMessagePreview(conversation: WhatsAppConversation) {
  const preview = conversation.lastMessagePreview ?? ''

  if (conversation.lastMessageType === 'audio') {
    return {
      text: `Audio ${formatDuration(conversation.lastMessageDurationSeconds)}`,
      icon: <FileAudio size={14} />,
      highlight: false,
    }
  }

  if (conversation.lastMessageType === 'image') {
    return { text: 'Imagem', icon: <FileImage size={14} />, highlight: false }
  }

  if (conversation.lastMessageType === 'sticker') {
    return { text: 'Figurinha', icon: <Sticker size={14} />, highlight: false }
  }

  if (conversation.lastMessageType === 'document') {
    return { text: preview || 'Arquivo', icon: <FileText size={14} />, highlight: false }
  }

  if (conversation.lastMessageType === 'video') {
    return { text: 'Video', icon: <Video size={14} />, highlight: false }
  }

  if (conversation.lastMessageType === 'reaction') {
    return { text: preview || 'Reacao', icon: <MessageCircleCode size={14} />, highlight: false }
  }

  if (conversation.lastMessageType === 'system') {
    return { text: preview || 'Historico do atendimento', icon: <History size={14} />, highlight: false }
  }

  return { text: preview, icon: null, highlight: false }
}

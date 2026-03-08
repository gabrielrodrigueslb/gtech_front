'use client'

import { useWhatsApp } from '@/context/Whatsappcontext'
import { useConversationAvatar } from '@/hooks/useConversationAvatar'
import ConversationTranscript from './ConversationTranscript'

export default function ChatMessages() {
  const { messages, isLoadingMessages, activeConversationId, activeConversation } = useWhatsApp()
  const avatarUrl = useConversationAvatar(activeConversationId)

  return (
    <ConversationTranscript
      conversationId={activeConversationId}
      messages={messages}
      isLoadingMessages={isLoadingMessages}
      avatarUrl={avatarUrl}
      incomingAvatarName={
        activeConversation?.contact?.name ??
        activeConversation?.pushName ??
        activeConversation?.phone ??
        null
      }
      emptyStateText="Selecione uma conversa para comecar"
      loadingText="Carregando mensagens..."
    />
  )
}

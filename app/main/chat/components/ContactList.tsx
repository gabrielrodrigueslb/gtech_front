'use client'
import { useWhatsApp } from '@/context/Whatsappcontext'
import ContactCard from './ContactCard'

export default function ContactList() {
  const { conversations, isLoadingConversations, activeConversationId, setActiveConversation } =
    useWhatsApp()

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

  if (conversations.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm opacity-40 p-6 text-center">
        Nenhuma conversa ainda
      </div>
    )
  }

  return (
    <ul className="flex-col flex w-full h-full overflow-y-auto">
      {conversations.map((conv) => (
        <ContactCard
          key={conv.id}
          conversationId={conv.id}
          lastMessage={conv.lastMessagePreview ?? ''}
          nomeContato={conv.contact?.name ?? conv.pushName ?? conv.phone ?? 'Desconhecido'}
          hora={conv.lastMessageAt ? formatHora(conv.lastMessageAt) : ''}
          online={false}
          isActive={conv.id === activeConversationId}
          noRead={conv.unreadCount > 0}
          unreadCount={conv.unreadCount}
          status={conv.status}
          onClick={() => setActiveConversation(conv.id)}
        />
      ))}
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
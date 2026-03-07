'use client'
import { ArrowLeftRight, EllipsisVertical, MessageSquareX } from 'lucide-react'
import UserProfile from './UserProfile'
import { useWhatsApp } from '@/context/Whatsappcontext'
export default function ChatHeader() {
  const { activeConversation, closeConversation } = useWhatsApp()

  if (!activeConversation) {
    return (
      <header className="w-full bg-card py-3 px-4 flex items-center opacity-40">
        <p className="text-sm">Selecione uma conversa</p>
      </header>
    )
  }

  const name =
    activeConversation.contact?.name ??
    activeConversation.pushName ??
    activeConversation.phone ??
    'Desconhecido'

  const isClosed = activeConversation.status === 'CLOSED'

  async function handleClose() {
    if (!activeConversation || isClosed) return
    await closeConversation(activeConversation.id)
  }

  return (
    <header className="w-full bg-card py-3 px-4 flex justify-between items-center">
      <div className="flex items-center gap-3">
        <UserProfile online={false} username={name} />
        <div className="flex flex-col flex-1 gap-1 font-light overflow-hidden max-w-xs">
          <h4 className="font-medium truncate">{name}</h4>
          <p className="text-xs opacity-50">
            {activeConversation.phone ?? activeConversation.remoteJid}
          </p>
        </div>
      </div>

      <div>
        <ul className="flex gap-2 items-center">
          <li className="p-1 rounded-sm transition-all cursor-pointer hover:bg-white/20">
            <EllipsisVertical size={20} />
          </li>
          <li className="p-1 rounded-sm transition-all cursor-pointer hover:bg-white/20">
            <ArrowLeftRight size={20} />
          </li>

          {!isClosed ? (
            <button
              onClick={handleClose}
              className="flex gap-2 text-sm p-3 bg-primary rounded-md ml-2 cursor-pointer hover:opacity-80 transition-opacity"
            >
              <MessageSquareX size={20} /> Encerrar Atendimento
            </button>
          ) : (
            <span className="text-xs opacity-40 ml-2 px-3 py-2 border border-white/10 rounded-md">
              Encerrado
            </span>
          )}
        </ul>
      </div>
    </header>
  )
}
'use client'

import { ArrowLeftRight, EllipsisVertical, MessageSquareX } from 'lucide-react'
import { useState } from 'react'
import UserProfile from './UserProfile'
import { useWhatsApp } from '@/context/Whatsappcontext'

const CLOSE_REASON_OPTIONS = [
  'Atendimento concluido',
  'Cliente nao respondeu',
  'Solicitacao resolvida em outro canal',
  'Atendimento duplicado',
]

export default function ChatHeader() {
  const { activeConversation, closeConversation } = useWhatsApp()
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false)
  const [closeReason, setCloseReason] = useState(CLOSE_REASON_OPTIONS[0])
  const [isClosing, setIsClosing] = useState(false)

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

  function openCloseModal() {
    if (!activeConversation || isClosed) return
    setCloseReason(CLOSE_REASON_OPTIONS[0])
    setIsCloseModalOpen(true)
  }

  function handleCancelClose() {
    if (isClosing) return
    setIsCloseModalOpen(false)
  }

  async function handleConfirmClose() {
    if (!activeConversation || isClosed) return
    const reason = closeReason.trim()
    if (!reason) return

    setIsClosing(true)
    try {
      await closeConversation(activeConversation.id, reason)
      setIsCloseModalOpen(false)
    } finally {
      setIsClosing(false)
    }
  }

  return (
    <>
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
                onClick={openCloseModal}
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

      {isCloseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-card p-6 shadow-2xl">
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">Encerrar atendimento</h3>
              <p className="text-sm opacity-70">
                Informe o motivo do encerramento. O atendimento sera removido da lista de ativos.
              </p>
            </div>

            <div className="mt-5 flex flex-col gap-3">
              <select
                value={closeReason}
                onChange={(e) => setCloseReason(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-background px-4 py-3 text-sm outline-none"
              >
                {CLOSE_REASON_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>

              <textarea
                value={closeReason}
                onChange={(e) => setCloseReason(e.target.value)}
                rows={4}
                placeholder="Descreva o motivo do encerramento"
                className="w-full resize-none rounded-xl border border-white/10 bg-background px-4 py-3 text-sm outline-none"
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleCancelClose}
                disabled={isClosing}
                className="rounded-xl border border-white/10 px-4 py-3 text-sm transition hover:bg-white/5 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmClose}
                disabled={isClosing || !closeReason.trim()}
                className="rounded-xl bg-primary px-4 py-3 text-sm font-medium transition hover:opacity-90 disabled:opacity-50"
              >
                {isClosing ? 'Encerrando...' : 'Encerrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

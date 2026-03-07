'use client'

import { CirclePlus } from 'lucide-react'
import { useState } from 'react'
import { openConversation } from '@/lib/Whatsapp'
import { useWhatsApp } from '@/context/Whatsappcontext'

export default function NewConversationButton() {
  const { registerConversation, setActiveConversation } = useWhatsApp()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [initialMessage, setInitialMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit() {
    if (!phone.trim()) {
      setError('Informe o telefone do atendimento.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const conversation = await openConversation({
        phone,
        name,
        initialMessage,
      })

      registerConversation(conversation)
      setIsModalOpen(false)
      setPhone('')
      setName('')
      setInitialMessage('')
      await setActiveConversation(conversation.id)
    } catch (submitError: any) {
      setError(submitError?.response?.data?.error ?? 'Nao foi possivel abrir o atendimento.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className="bg-primary m-3 font-semibold flex gap-2 items-center justify-center py-3 rounded-xl cursor-pointer hover:opacity-80 transition-opacity"
      >
        <CirclePlus /> Novo Atendimento
      </button>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-card p-6 shadow-2xl">
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">Abrir atendimento</h3>
              <p className="text-sm opacity-70">
                Informe o telefone e, se quiser, uma mensagem inicial para criar o atendimento.
              </p>
            </div>

            <div className="mt-5 space-y-4">
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Telefone com DDD ou codigo do pais"
                className="w-full rounded-xl border border-white/10 bg-background px-4 py-3 text-sm outline-none"
              />

              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome do contato (opcional)"
                className="w-full rounded-xl border border-white/10 bg-background px-4 py-3 text-sm outline-none"
              />

              <textarea
                value={initialMessage}
                onChange={(e) => setInitialMessage(e.target.value)}
                rows={4}
                placeholder="Mensagem inicial (opcional)"
                className="w-full resize-none rounded-xl border border-white/10 bg-background px-4 py-3 text-sm outline-none"
              />

              {error && (
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                  {error}
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl border border-white/10 px-4 py-3 text-sm transition hover:bg-white/5 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSubmit}
                className="rounded-xl bg-primary px-4 py-3 text-sm font-medium transition hover:opacity-90 disabled:opacity-50"
              >
                {isSubmitting ? 'Abrindo...' : 'Abrir atendimento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

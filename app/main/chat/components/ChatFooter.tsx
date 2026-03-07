'use client'
import { Mic, Plus, SendHorizontal, SmilePlus } from 'lucide-react'
import { useRef, useState } from 'react'
import { useWhatsApp } from '@/context/Whatsappcontext'
import { sendMessage } from '@/lib/Whatsapp'

// Troque pelo id do usuário logado — idealmente vem do seu AuthContext
const CURRENT_USER_ID = process.env.NEXT_PUBLIC_CURRENT_USER_ID ?? ''

export default function ChatFooter() {
  const [text, setText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const { activeConversationId, addOutgoingMessage } = useWhatsApp()
  const inputRef = useRef<HTMLInputElement>(null)

  const hasText = text.trim().length > 0

  async function handleSend() {
    if (!hasText || !activeConversationId || isSending) return

    const textToSend = text.trim()
    setText('')
    inputRef.current?.focus()

    setIsSending(true)
    try {
      const msg = await sendMessage(activeConversationId, textToSend, CURRENT_USER_ID)
      addOutgoingMessage(msg)
    } catch (err) {
      console.error('[ChatFooter] Erro ao enviar:', err)
      setText(textToSend) // devolve o texto se falhar
    } finally {
      setIsSending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <footer className="w-full bg-card flex px-3 py-2 gap-4 items-center">
      <span className="flex gap-2">
        <button className="p-1 rounded-sm transition-all cursor-pointer hover:bg-white/20">
          <Plus />
        </button>
        <button className="p-1 rounded-sm transition-all cursor-pointer hover:bg-white/20">
          <SmilePlus />
        </button>
      </span>

      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        type="text"
        disabled={!activeConversationId || isSending}
        className="bg-white/5 rounded-md flex-1 px-6 py-4 text-sm border focus:outline-none disabled:opacity-40"
        placeholder={activeConversationId ? 'Escreva sua mensagem' : 'Selecione uma conversa'}
      />

      <button
        onClick={handleSend}
        disabled={!activeConversationId || isSending}
        className="p-1 size-12 flex items-center justify-center rounded-full transition-all cursor-pointer hover:bg-white/20 bg-primary disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {hasText ? <SendHorizontal /> : <Mic />}
      </button>
    </footer>
  )
}
'use client'

import { CheckCheck, Clock } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useWhatsApp } from '@/context/Whatsappcontext'
import UserProfile from './UserProfile'
import type { WhatsAppMessage } from '@/types/Whatsapp.types'

export default function ChatMessages() {
  const { messages, isLoadingMessages, activeConversationId } = useWhatsApp()
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const lastConversationRef = useRef<string | null>(null)

  useEffect(() => {
    if (!activeConversationId || isLoadingMessages || !scrollContainerRef.current) return

    const isConversationChanged = lastConversationRef.current !== activeConversationId
    const behavior: ScrollBehavior = isConversationChanged ? 'auto' : 'smooth'

    scrollContainerRef.current.scrollTo({
      top: scrollContainerRef.current.scrollHeight,
      behavior,
    })

    lastConversationRef.current = activeConversationId
  }, [activeConversationId, isLoadingMessages, messages.length])

  if (!activeConversationId) {
    return (
      <div className="flex-1 flex items-center justify-center opacity-30 text-sm">
        Selecione uma conversa para comecar
      </div>
    )
  }

  if (isLoadingMessages) {
    return (
      <div className="flex-1 flex items-center justify-center opacity-30 text-sm">
        Carregando mensagens...
      </div>
    )
  }

  const groupedMessages = groupByDate(messages)

  return (
    <div
      ref={scrollContainerRef}
      className="messages flex-1 overflow-x-hidden overflow-y-auto flex p-6 items-start flex-col gap-3"
    >
      {groupedMessages.map(({ label, msgs }) => (
        <div key={label} className="w-full flex flex-col gap-3">
          <span className="py-1 px-4 self-center bg-card rounded-full text-xs font-semibold">
            {label}
          </span>

          {msgs.map((msg) => {
            const timeLabel = new Date(msg.timestamp).toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
            })

            if (msg.fromMe) {
              return (
                <div
                  key={msg.id}
                  className="message-card flex flex-row-reverse gap-2 self-end max-w-[60%]"
                >
                  <div className="message min-w-0 flex flex-col gap-1.5">
                    <span className="rounded-md rounded-tr-none bg-primary p-4 overflow-hidden">
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {msg.body ?? `[${msg.type}]`}
                      </p>
                    </span>
                    <span className="flex self-end items-center gap-1">
                      <p className="text-xs opacity-70">{timeLabel}</p>
                      <MessageStatusIcon status={msg.status} />
                    </span>
                  </div>
                </div>
              )
            }

            return (
              <div key={msg.id} className="message-card flex items-end gap-2 max-w-[60%]">
                <UserProfile username={msg.remoteJid.split('@')[0]} />
                <div className="message min-w-0 flex flex-col gap-1.5">
                  <span className="rounded-md rounded-tl-none bg-card p-4 overflow-hidden">
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {msg.body ?? `[${msg.type}]`}
                    </p>
                  </span>
                  <p className="text-xs opacity-70">{timeLabel}</p>
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function MessageStatusIcon({ status }: { status: WhatsAppMessage['status'] }) {
  if (status === 'READ') return <CheckCheck className="text-primary" size={12} />
  if (status === 'DELIVERED') return <CheckCheck className="opacity-60" size={12} />
  if (status === 'SENT') return <CheckCheck className="opacity-40" size={12} />
  if (status === 'PENDING') return <Clock className="opacity-30" size={12} />
  return null
}

function groupByDate(messages: WhatsAppMessage[]) {
  const groups: { label: string; msgs: WhatsAppMessage[] }[] = []
  const groupedByLabel = new Map<string, WhatsAppMessage[]>()
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  for (const msg of messages) {
    const date = new Date(msg.timestamp)

    let label: string
    if (date.toDateString() === today.toDateString()) label = 'Hoje'
    else if (date.toDateString() === yesterday.toDateString()) label = 'Ontem'
    else label = date.toLocaleDateString('pt-BR')

    if (!groupedByLabel.has(label)) groupedByLabel.set(label, [])
    groupedByLabel.get(label)!.push(msg)
  }

  groupedByLabel.forEach((msgs, label) => groups.push({ label, msgs }))
  return groups
}

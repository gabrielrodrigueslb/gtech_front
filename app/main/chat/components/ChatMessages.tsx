'use client'

import { CheckCheck, Clock } from 'lucide-react'
import { useEffect, useState, useRef } from 'react'
import { useWhatsApp } from '@/context/Whatsappcontext'
import { resolveWhatsAppMediaUrl } from '@/lib/Whatsapp'
import { useConversationAvatar } from '@/hooks/useConversationAvatar'
import ChatAudioPlayer from './ChatAudioPlayer'
import UserProfile from './UserProfile'
import type { WhatsAppMessage } from '@/types/Whatsapp.types'

export default function ChatMessages() {
  const { messages, isLoadingMessages, activeConversationId } = useWhatsApp()
  const avatarUrl = useConversationAvatar(activeConversationId)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const lastConversationRef = useRef<string | null>(null)
  const [previewImage, setPreviewImage] = useState<{ src: string; alt: string } | null>(null)
  const [previewZoom, setPreviewZoom] = useState(1)

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
    <>
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
                      <div className={getBubbleClassName(msg, true)}>
                        <MessageContent
                          message={msg}
                          onPreviewImage={(src, alt) => {
                            setPreviewImage({ src, alt })
                            setPreviewZoom(1)
                          }}
                        />
                      </div>
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
                  <UserProfile username={msg.remoteJid.split('@')[0]} avatarUrl={avatarUrl} />
                  <div className="message min-w-0 flex flex-col gap-1.5">
                    <div className={getBubbleClassName(msg, false)}>
                      <MessageContent
                        message={msg}
                        onPreviewImage={(src, alt) => {
                          setPreviewImage({ src, alt })
                          setPreviewZoom(1)
                        }}
                      />
                    </div>
                    <p className="text-xs opacity-70">{timeLabel}</p>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-6">
          <div className="absolute right-6 top-6 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPreviewZoom((current) => Math.max(1, current - 0.25))}
              className="rounded-full border border-white/10 bg-white/10 px-3 py-2 text-sm"
            >
              -
            </button>
            <button
              type="button"
              onClick={() => setPreviewZoom(1)}
              className="rounded-full border border-white/10 bg-white/10 px-3 py-2 text-sm"
            >
              100%
            </button>
            <button
              type="button"
              onClick={() => setPreviewZoom((current) => Math.min(3, current + 0.25))}
              className="rounded-full border border-white/10 bg-white/10 px-3 py-2 text-sm"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm"
            >
              Fechar
            </button>
          </div>

          <div className="max-h-full max-w-full overflow-auto">
            <img
              src={previewImage.src}
              alt={previewImage.alt}
              className="max-h-[88vh] max-w-[88vw] origin-center object-contain transition-transform duration-150"
              style={{ transform: `scale(${previewZoom})` }}
            />
          </div>
        </div>
      )}
    </>
  )
}

function MessageContent({
  message,
  onPreviewImage,
}: {
  message: WhatsAppMessage
  onPreviewImage: (src: string, alt: string) => void
}) {
  const mediaUrl = resolveWhatsAppMediaUrl(message.mediaUrl)

  if (message.type === 'image' && mediaUrl) {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => onPreviewImage(mediaUrl, message.body ?? 'Imagem enviada')}
          className="block overflow-hidden rounded-xl"
        >
          <img
            src={mediaUrl}
            alt={message.body ?? 'Imagem enviada'}
            className="max-h-[220px] w-full rounded-xl object-cover transition hover:scale-[1.01]"
          />
        </button>
        {message.body && <p className="text-sm whitespace-pre-wrap break-words">{message.body}</p>}
      </div>
    )
  }

  if (message.type === 'sticker' && mediaUrl) {
    return (
      <img
        src={mediaUrl}
        alt="Figurinha"
        className="h-32 w-32 object-contain"
      />
    )
  }

  if (message.type === 'audio' && mediaUrl) {
    return (
      <div className="space-y-2 min-w-[260px]">
        <ChatAudioPlayer src={mediaUrl} mimeType={message.mediaMimeType} label="Audio" variant="bubble" />
        {message.body && <p className="text-sm whitespace-pre-wrap break-words">{message.body}</p>}
      </div>
    )
  }

  if (message.type === 'video' && mediaUrl) {
    return (
      <div className="space-y-3">
        <video controls preload="metadata" className="max-h-[320px] w-full rounded-xl bg-black">
          <source src={mediaUrl} type={message.mediaMimeType ?? 'video/mp4'} />
        </video>
        {message.body && <p className="text-sm whitespace-pre-wrap break-words">{message.body}</p>}
      </div>
    )
  }

  if (message.type === 'document' && mediaUrl) {
    return (
      <a
        href={mediaUrl}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/10 px-4 py-3 text-sm hover:bg-black/20"
      >
        <span className="text-xl">+</span>
        <span className="min-w-0 truncate">{message.body ?? 'Abrir arquivo'}</span>
      </a>
    )
  }

  return (
    <p className="text-sm whitespace-pre-wrap break-words">
      {message.body ?? `[${message.type}]`}
    </p>
  )
}

function getBubbleClassName(message: WhatsAppMessage, fromMe: boolean) {
  const isSticker = message.type === 'sticker' && !!message.mediaUrl
  if (isSticker) return 'overflow-visible bg-transparent p-0'

  return fromMe
    ? 'rounded-md rounded-tr-none bg-primary p-4 overflow-hidden'
    : 'rounded-md rounded-tl-none bg-card p-4 overflow-hidden'
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

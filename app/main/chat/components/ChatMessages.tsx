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

  useEffect(() => {
    if (!previewImage) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPreviewImage(null)
        return
      }

      if (!(event.ctrlKey || event.metaKey)) return

      if (event.key === '+' || event.key === '=' || event.key === 'Add') {
        event.preventDefault()
        setPreviewZoom((current) => Math.min(4, Number((current + 0.2).toFixed(2))))
      }

      if (event.key === '-' || event.key === 'Subtract') {
        event.preventDefault()
        setPreviewZoom((current) => Math.max(0.6, Number((current - 0.2).toFixed(2))))
      }

      if (event.key === '0') {
        event.preventDefault()
        setPreviewZoom(1)
      }
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [previewImage])

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
          <div key={label} className="w-full flex flex-col gap-6">
            <span className="py-1 px-4 self-center bg-card rounded-full text-xs font-semibold">
              {label}
            </span>

            {msgs.map((msg, index) => {
              const timeLabel = new Date(msg.timestamp).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              })
              const nextMessage = msgs[index + 1]
              const showIncomingAvatar = !nextMessage || nextMessage.fromMe

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
                <div key={msg.id} className="message-card flex items-start gap-2 max-w-[60%]">
                  {showIncomingAvatar ? (
                    <UserProfile username={msg.remoteJid.split('@')[0]} avatarUrl={avatarUrl} />
                  ) : (
                    <div aria-hidden className="h-[52px] w-[52px] shrink-0" />
                  )}
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/92 p-6 backdrop-blur-sm"
          onClick={() => setPreviewImage(null)}
        >
          <button
            type="button"
            onClick={() => setPreviewImage(null)}
            className="absolute right-6 top-6 rounded-full border border-white/10 bg-white/8 px-4 py-2 text-sm text-white/80 transition hover:bg-white/12"
          >
            Fechar
          </button>

          <div
            className="max-h-full max-w-full overflow-auto"
            onClick={(event) => event.stopPropagation()}
          >
            <img
              src={previewImage.src}
              alt={previewImage.alt}
              className="max-h-[84vh] max-w-[min(92vw,1080px)] origin-center rounded-2xl object-contain shadow-[0_25px_80px_rgba(0,0,0,0.45)] transition-transform duration-150"
              style={{ transform: `scale(${previewZoom})` }}
              onDoubleClick={() => {
                setPreviewZoom((current) => (current > 1 ? 1 : 2))
              }}
            />
          </div>

          <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/10 bg-black/45 px-4 py-2 text-xs text-white/70 backdrop-blur">
            <span>{Math.round(previewZoom * 100)}%</span>
            <span className="h-1 w-1 rounded-full bg-white/25" />
            <span>Ctrl +/- para zoom</span>
            <span className="h-1 w-1 rounded-full bg-white/25" />
            <span>Duplo clique para alternar</span>
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
            className="max-h-[180px] max-w-[280px] rounded-xl object-cover transition hover:scale-[1.01]"
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
      <div className="min-w-[240px] max-w-[320px] space-y-2">
        <ChatAudioPlayer
          src={mediaUrl}
          mimeType={message.mediaMimeType}
          label="Audio"
          variant="bubble"
          tone={message.fromMe ? 'outgoing' : 'incoming'}
        />
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
  const hasStandaloneMediaBody =
    (message.type === 'sticker' || message.type === 'audio') && !!message.mediaUrl

  if (hasStandaloneMediaBody) return 'overflow-visible bg-transparent p-0'

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

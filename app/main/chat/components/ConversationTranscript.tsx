'use client'

import { CheckCheck, Clock } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { resolveWhatsAppMediaUrl } from '@/lib/whatsapp-client'
import type { WhatsAppMessage } from '@/types/Whatsapp.types'
import ChatAudioPlayer from './ChatAudioPlayer'
import UserProfile from './UserProfile'

type SystemEventPayload = {
  type?:
    | 'conversation_closed'
    | 'conversation_reopened'
    | 'conversation_reopened_inbound'
    | 'conversation_reopened_scheduled'
    | 'scheduled_message_skipped'
    | string
  reason?: string | null
  meta?: Record<string, unknown> | null
}

type ConversationTranscriptProps = {
  conversationId?: string | null
  messages: WhatsAppMessage[]
  isLoadingMessages: boolean
  avatarUrl?: string | null
  incomingAvatarName?: string | null
  emptyStateText?: string
  loadingText?: string
}

export default function ConversationTranscript({
  conversationId,
  messages,
  isLoadingMessages,
  avatarUrl = null,
  incomingAvatarName = null,
  emptyStateText = 'Selecione uma conversa para comecar',
  loadingText = 'Carregando mensagens...',
}: ConversationTranscriptProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const lastConversationRef = useRef<string | null>(null)
  const [previewImage, setPreviewImage] = useState<{ src: string; alt: string } | null>(null)
  const [previewZoom, setPreviewZoom] = useState(1)

  useEffect(() => {
    if (!conversationId || isLoadingMessages || !scrollContainerRef.current) return

    const isConversationChanged = lastConversationRef.current !== conversationId
    const behavior: ScrollBehavior = isConversationChanged ? 'auto' : 'smooth'

    scrollContainerRef.current.scrollTo({
      top: scrollContainerRef.current.scrollHeight,
      behavior,
    })

    lastConversationRef.current = conversationId
  }, [conversationId, isLoadingMessages, messages.length])

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

  if (!conversationId) {
    return (
      <div className="flex flex-1 items-center justify-center opacity-30 text-sm">
        {emptyStateText}
      </div>
    )
  }

  if (isLoadingMessages) {
    return (
      <div className="flex flex-1 items-center justify-center opacity-30 text-sm">
        {loadingText}
      </div>
    )
  }

  const groupedMessages = groupByDate(messages)

  return (
    <>
      <div
        ref={scrollContainerRef}
        className="messages flex flex-1 flex-col items-start gap-2 overflow-x-hidden overflow-y-auto p-3 md:gap-3 md:p-6"
      >
        {groupedMessages.map(({ label, msgs }) => (
          <div key={label} className="flex w-full flex-col gap-4 md:gap-6">
            <span className="self-center rounded-full bg-card px-4 py-1 text-xs font-semibold">
              {label}
            </span>

            {msgs.map((msg, index) => {
              const timeLabel = new Date(msg.timestamp).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              })

              if (msg.type === 'system') {
                const systemEvent = (msg.raw?.systemEvent ?? null) as SystemEventPayload | null

                return (
                  <SystemTimelineCard
                    key={msg.id}
                    message={msg}
                    event={systemEvent}
                    timeLabel={timeLabel}
                  />
                )
              }

              const nextMessage = msgs[index + 1]
              const showIncomingAvatar = !nextMessage || nextMessage.fromMe

              if (msg.fromMe) {
                return (
                  <div
                    key={msg.id}
                    className="message-card flex max-w-[80%] flex-row-reverse gap-2 self-end md:max-w-[60%]"
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
                      <span className="flex items-center gap-1 self-end">
                        <p className="text-xs opacity-70">{timeLabel}</p>
                        <MessageStatusIcon status={msg.status} />
                      </span>
                    </div>
                  </div>
                )
              }

              return (
                <div
                  key={msg.id}
                  className="message-card flex max-w-[80%] items-start gap-2 md:max-w-[60%]"
                >
                  {showIncomingAvatar ? (
                    <UserProfile
                      username={incomingAvatarName ?? msg.remoteJid.split('@')[0]}
                      avatarUrl={avatarUrl}
                      className="h-10 w-10 text-xs md:h-[52px] md:w-[52px] md:text-sm"
                    />
                  ) : (
                    <div aria-hidden className="h-10 w-10 shrink-0 md:h-[52px] md:w-[52px]" />
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
            className="absolute right-6 top-6 cursor-pointer rounded-full border border-white/10 bg-white/8 px-4 py-2 text-sm text-white/80 transition hover:bg-white/12"
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
          className="block cursor-pointer overflow-hidden rounded-xl"
        >
          <img
            src={mediaUrl}
            alt={message.body ?? 'Imagem enviada'}
            className="max-h-[145px] max-w-[210px] rounded-xl object-cover transition hover:scale-[1.01] sm:max-h-[165px] sm:max-w-[240px] md:max-h-[180px] md:max-w-[280px]"
          />
        </button>
        {message.body && <p className="text-sm whitespace-pre-wrap break-words">{message.body}</p>}
      </div>
    )
  }

  if (message.type === 'sticker' && mediaUrl) {
    return <img src={mediaUrl} alt="Figurinha" className="h-32 w-32 object-contain" />
  }

  if (message.type === 'audio' && mediaUrl) {
    return (
      <div className="min-w-[180px] max-w-[230px] space-y-2 sm:min-w-[200px] sm:max-w-[260px] md:min-w-[240px] md:max-w-[320px]">
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

  return <p className="text-sm whitespace-pre-wrap break-words">{message.body ?? `[${message.type}]`}</p>
}

function SystemTimelineCard({
  message,
  event,
  timeLabel,
}: {
  message: WhatsAppMessage
  event: SystemEventPayload | null
  timeLabel: string
}) {
  const title =
    event?.type === 'conversation_closed'
      ? 'Atendimento encerrado'
      : event?.type === 'conversation_reopened_inbound'
        ? 'Atendimento retomado pelo cliente'
        : event?.type === 'conversation_reopened_scheduled'
          ? 'Atendimento reaberto automaticamente'
          : event?.type === 'scheduled_message_skipped'
            ? 'Mensagem programada nao enviada'
            : event?.type === 'conversation_reopened'
              ? 'Atendimento reaberto'
              : 'Atualizacao do atendimento'

  const reason =
    event?.type === 'conversation_closed' && event.reason?.trim()
      ? `Motivo: ${event.reason.trim()}`
      : null
  const detailText =
    event?.type || !message.body || message.body.trim() === title
      ? null
      : message.body

  return (
    <div className="flex w-full justify-center">
      <div className="max-w-[92%] rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center backdrop-blur-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/65">{title}</p>
        {reason ? (
          <p className="mt-1 text-sm text-white/80 whitespace-pre-wrap break-words">{reason}</p>
        ) : detailText ? (
          <p className="mt-1 text-sm text-white/78 whitespace-pre-wrap break-words">{detailText}</p>
        ) : null}
        <p className="mt-2 text-[11px] text-white/45">{timeLabel}</p>
      </div>
    </div>
  )
}

function getBubbleClassName(message: WhatsAppMessage, fromMe: boolean) {
  const hasStandaloneMediaBody =
    (message.type === 'sticker' || message.type === 'audio') && !!message.mediaUrl

  if (hasStandaloneMediaBody) return 'overflow-visible bg-transparent p-0'

  return fromMe
    ? 'overflow-hidden rounded-md rounded-tr-none bg-primary p-4'
    : 'overflow-hidden rounded-md rounded-tl-none bg-card p-4'
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
    groupedByLabel.get(label)?.push(msg)
  }

  groupedByLabel.forEach((msgs, label) => groups.push({ label, msgs }))
  return groups
}

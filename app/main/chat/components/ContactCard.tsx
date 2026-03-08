import { useEffect, useRef, useState, type ReactNode } from 'react'
import UserProfile from './UserProfile'
import { useConversationAvatar } from '@/hooks/useConversationAvatar'

interface ContactProps {
  conversationId: string
  lastMessage: string
  lastMessageIcon?: ReactNode
  isPreviewHighlight?: boolean
  nomeContato: string
  hora: string
  online: boolean
  noRead: boolean
  unreadCount: number
  isActive: boolean
  status: 'PENDING' | 'OPEN' | 'CLOSED' | 'ARCHIVED'
  routingOwnerType?: 'queue' | 'user' | 'ai_agent'
  ownerLabel?: string
  showOwnership?: boolean
  onClick: () => void
}

export default function ContactCard({
  conversationId,
  lastMessage,
  lastMessageIcon,
  isPreviewHighlight = false,
  nomeContato,
  hora,
  online,
  isActive,
  noRead,
  unreadCount,
  status,
  routingOwnerType = 'user',
  ownerLabel = '',
  showOwnership = false,
  onClick,
}: ContactProps) {
  const containerRef = useRef<HTMLLIElement | null>(null)
  const [shouldLoadAvatar, setShouldLoadAvatar] = useState(isActive)
  const avatarUrl = useConversationAvatar(conversationId, {
    enabled: shouldLoadAvatar || isActive,
  })

  useEffect(() => {
    if (isActive) {
      setShouldLoadAvatar(true)
      return
    }

    const element = containerRef.current
    if (!element || shouldLoadAvatar) return

    const observer = new IntersectionObserver(
      (entries) => {
        const isVisible = entries.some((entry) => entry.isIntersecting)
        if (!isVisible) return

        setShouldLoadAvatar(true)
        observer.disconnect()
      },
      {
        rootMargin: '180px 0px',
        threshold: 0.01,
      }
    )

    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [isActive, shouldLoadAvatar])

  return (
    <li
      ref={containerRef}
      onClick={onClick}
      className={`${isActive ? 'bg-white/10' : ''} w-full flex items-center px-3 py-4 gap-2 hover:bg-white/10 cursor-pointer transition-all`}
    >
      <UserProfile online={online} username={nomeContato} avatarUrl={avatarUrl} imageLoading="lazy" />
      <div className="flex flex-col flex-1 gap-1 font-light overflow-hidden">
        <span className="flex justify-between items-center">
          <div className="min-w-0">
            <h4 className="font-medium truncate">{nomeContato || 'Contato'}</h4>
            {showOwnership && status !== 'CLOSED' && ownerLabel ? (
              <p className="truncate text-[11px] text-white/45">{ownerLabel}</p>
            ) : null}
          </div>
          <p className={`text-xs opacity-50 shrink-0 ml-2 ${noRead && 'text-primary opacity-100 font-semibold'}`}>
            {hora}
          </p>
        </span>

        <span className="flex justify-between items-center gap-3">
          <p className={`flex items-center gap-2 text-sm truncate ${isPreviewHighlight ? 'text-emerald-400 opacity-100' : 'opacity-50'}`}>
            {lastMessageIcon ? <span className="shrink-0">{lastMessageIcon}</span> : null}
            <span className="truncate">{lastMessage}</span>
          </p>

          <span className="flex items-center gap-1 shrink-0">
            {showOwnership && status !== 'CLOSED' && routingOwnerType === 'queue' && (
              <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-amber-200">
                Fila
              </span>
            )}
            {showOwnership && status !== 'CLOSED' && routingOwnerType === 'ai_agent' && (
              <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-sky-100">
                IA
              </span>
            )}
            {status === 'CLOSED' && (
              <span className="text-xs opacity-40">Encerrado</span>
            )}
            {noRead && unreadCount > 0 && (
              <div className="flex min-w-5 h-5 px-1 items-center justify-center rounded-full text-xs bg-primary font-semibold">
                {unreadCount > 99 ? '99+' : unreadCount}
              </div>
            )}
          </span>
        </span>
      </div>
    </li>
  )
}

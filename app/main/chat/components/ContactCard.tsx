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
          <h4 className="font-medium truncate">{nomeContato || 'Contato'}</h4>
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

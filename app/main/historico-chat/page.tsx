'use client'

import { CalendarDays, ChevronLeft, ChevronRight, Phone, Search, Shield, UserRound } from 'lucide-react'
import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import ContactCard from '@/app/main/chat/components/ContactCard'
import ConversationTranscript from '@/app/main/chat/components/ConversationTranscript'
import UserProfile from '@/app/main/chat/components/UserProfile'
import { useConversationAvatar } from '@/hooks/useConversationAvatar'
import { useAppShell } from '@/context/app-shell-context'
import { useIsMobile } from '@/hooks/use-mobile'
import { getMe, type AuthMeUser } from '@/lib/auth'
import { getHistoricalConversations, getMessages } from '@/lib/whatsapp-client'
import type { ConversationsPage, WhatsAppConversation, WhatsAppMessage } from '@/types/Whatsapp.types'
import {
  FileAudio,
  FileImage,
  FileText,
  History,
  MessageCircleCode,
  Sticker,
  Video,
} from 'lucide-react'

const PAGE_SIZE = 20

function getTodayInputDate() {
  return new Date().toISOString().slice(0, 10)
}

function normalizeSearchValue(value?: string | null) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function formatPhone(value?: string | null) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length === 13) {
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`
  }
  if (digits.length === 12) {
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`
  }
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  return digits
}

function formatListDate(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  const now = new Date()
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Nao informado'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Nao informado'

  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getConversationReferenceDate(conversation: WhatsAppConversation) {
  return conversation.closedAt ?? conversation.lastMessageAt ?? null
}

function getDayLabel(value?: string | null) {
  if (!value) return 'Sem data'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sem data'

  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  if (date.toDateString() === today.toDateString()) return 'Hoje'
  if (date.toDateString() === yesterday.toDateString()) return 'Ontem'

  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatDuration(totalSeconds?: number | null) {
  if (!totalSeconds || totalSeconds < 1) return '00:00'
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function buildMessagePreview(conversation: WhatsAppConversation) {
  const preview = conversation.lastMessagePreview ?? ''

  if (conversation.lastMessageType === 'audio') {
    return {
      text: `Audio ${formatDuration(conversation.lastMessageDurationSeconds)}`,
      icon: <FileAudio size={14} />,
    }
  }

  if (conversation.lastMessageType === 'image') {
    return { text: 'Imagem', icon: <FileImage size={14} /> }
  }

  if (conversation.lastMessageType === 'sticker') {
    return { text: 'Figurinha', icon: <Sticker size={14} /> }
  }

  if (conversation.lastMessageType === 'document') {
    return { text: preview || 'Arquivo', icon: <FileText size={14} /> }
  }

  if (conversation.lastMessageType === 'video') {
    return { text: 'Video', icon: <Video size={14} /> }
  }

  if (conversation.lastMessageType === 'reaction') {
    return { text: preview || 'Reacao', icon: <MessageCircleCode size={14} /> }
  }

  if (conversation.lastMessageType === 'system') {
    return { text: preview || 'Historico do atendimento', icon: <History size={14} /> }
  }

  return { text: preview || 'Sem mensagens registradas', icon: null }
}

function groupConversationsByDay(conversations: WhatsAppConversation[]) {
  const groups = new Map<string, WhatsAppConversation[]>()

  for (const conversation of conversations) {
    const label = getDayLabel(getConversationReferenceDate(conversation))
    if (!groups.has(label)) groups.set(label, [])
    groups.get(label)?.push(conversation)
  }

  return Array.from(groups.entries()).map(([label, items]) => ({
    label,
    items,
  }))
}

type MetaCardProps = {
  icon: ReactNode
  label: string
  value: string
}

function MetaCard({ icon, label, value }: MetaCardProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/4 px-4 py-3">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-white/45">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-2 text-sm text-white/85">{value}</p>
    </div>
  )
}

export default function HistoricoAtendimentosPage() {
  const router = useRouter()
  const { setHideMobileNav } = useAppShell()
  const isMobile = useIsMobile()
  const [user, setUser] = useState<AuthMeUser | null>(null)
  const [isLoadingUser, setIsLoadingUser] = useState(true)
  const [isLoadingConversations, setIsLoadingConversations] = useState(true)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [dayFilter, setDayFilter] = useState(getTodayInputDate())
  const deferredSearch = useDeferredValue(searchQuery)
  const [page, setPage] = useState(1)
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list')
  const [messages, setMessages] = useState<WhatsAppMessage[]>([])
  const [conversationsPage, setConversationsPage] = useState<ConversationsPage>({
    data: [],
    total: 0,
    page: 1,
    limit: PAGE_SIZE,
  })

  useEffect(() => {
    let isMounted = true

    async function loadUser() {
      try {
        const me = await getMe()
        if (!isMounted) return

        if (!me) {
          router.replace('/')
          return
        }

        if (me.role !== 'ADMIN') {
          router.replace('/main/chat')
          return
        }

        setUser(me)
      } catch (_) {
        if (isMounted) router.replace('/main/chat')
      } finally {
        if (isMounted) setIsLoadingUser(false)
      }
    }

    loadUser()

    return () => {
      isMounted = false
    }
  }, [router])

  useEffect(() => {
    setPage(1)
  }, [dayFilter, deferredSearch])

  useEffect(() => {
    if (!user || user.role !== 'ADMIN') return

    let isMounted = true
    setIsLoadingConversations(true)

    getHistoricalConversations({
      page,
      limit: PAGE_SIZE,
      search: deferredSearch.trim() || undefined,
      day: dayFilter,
    })
      .then((result) => {
        if (!isMounted) return
        setConversationsPage(result)
        if (result.day) {
          setDayFilter(result.day)
        }
      })
      .catch((error) => {
        console.error('[HistoricoAtendimentos] Erro ao carregar historico:', error)
        if (isMounted) {
          setConversationsPage({
            data: [],
            total: 0,
            page,
            limit: PAGE_SIZE,
          })
        }
      })
      .finally(() => {
        if (isMounted) setIsLoadingConversations(false)
      })

    return () => {
      isMounted = false
    }
  }, [dayFilter, deferredSearch, page, user])

  useEffect(() => {
    if (isLoadingConversations) return

    const selectedStillVisible = conversationsPage.data.some(
      (conversation) => conversation.id === selectedConversationId
    )

    if (!conversationsPage.data.length) {
      setSelectedConversationId(null)
      setMessages([])
      return
    }

    if (!selectedStillVisible) {
      if (isMobile) {
        setSelectedConversationId(null)
        setMessages([])
        setMobileView('list')
      } else {
        setSelectedConversationId(conversationsPage.data[0].id)
      }
    }
  }, [conversationsPage.data, isLoadingConversations, isMobile, selectedConversationId])

  useEffect(() => {
    if (!isMobile) {
      setMobileView('chat')
      return
    }

    if (!selectedConversationId) {
      setMobileView('list')
    }
  }, [isMobile, selectedConversationId])

  useEffect(() => {
    const showMobileChat = isMobile && mobileView === 'chat' && !!selectedConversationId
    setHideMobileNav(showMobileChat)
    return () => setHideMobileNav(false)
  }, [isMobile, mobileView, selectedConversationId, setHideMobileNav])

  useEffect(() => {
    if (!selectedConversationId) return

    let isMounted = true
    setIsLoadingMessages(true)

    getMessages(selectedConversationId, { limit: 200 })
      .then((result) => {
        if (isMounted) setMessages(result)
      })
      .catch((error) => {
        console.error('[HistoricoAtendimentos] Erro ao carregar mensagens:', error)
        if (isMounted) setMessages([])
      })
      .finally(() => {
        if (isMounted) setIsLoadingMessages(false)
      })

    return () => {
      isMounted = false
    }
  }, [selectedConversationId])

  const selectedConversation = useMemo(
    () =>
      conversationsPage.data.find((conversation) => conversation.id === selectedConversationId) ?? null,
    [conversationsPage.data, selectedConversationId]
  )

  const groupedConversations = useMemo(
    () => groupConversationsByDay(conversationsPage.data),
    [conversationsPage.data]
  )

  const totalPages = Math.max(1, Math.ceil(conversationsPage.total / PAGE_SIZE))
  const showMobileChat = isMobile && mobileView === 'chat' && !!selectedConversation
  const showMobileList = !isMobile || mobileView === 'list' || !selectedConversation

  if (isLoadingUser) {
    return (
      <main className="flex h-full items-center justify-center rounded-2xl bg-card px-4 text-sm text-white/55">
        Carregando historico de atendimentos...
      </main>
    )
  }

  if (!user || user.role !== 'ADMIN') {
    return (
      <main className="flex h-full items-center justify-center rounded-2xl bg-card px-4 text-sm text-white/55">
        Redirecionando...
      </main>
    )
  }

  return (
    <main className="-mx-4 -mt-4 flex h-[calc(100%+1rem)] w-[calc(100%+2rem)] max-h-screen max-w-none overflow-hidden bg-card md:mx-0 md:mt-0 md:h-full md:w-auto md:rounded-2xl">
      <section
        className={`h-full w-full shrink-0 flex-col overflow-hidden bg-card md:flex md:w-[380px] md:border-r md:border-border/50 ${
          showMobileList ? 'flex' : 'hidden'
        }`}
      >
        <header className="border-b border-border/60 px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-primary">Historico</p>
              <h1 className="mt-1 text-lg font-semibold text-white">Atendimentos encerrados</h1>
            </div>
            <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs text-primary">
              {conversationsPage.total} registros
            </span>
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-3 rounded-2xl bg-background px-4 py-3">
              <Search size={18} className="text-white/45" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
                placeholder="Buscar por nome ou telefone"
              />
            </div>

            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/4 px-4 py-3">
              <CalendarDays size={16} className="text-white/45" />
              <input
                type="date"
                value={dayFilter}
                onChange={(event) => setDayFilter(event.target.value)}
                className="w-full cursor-pointer bg-transparent text-sm text-white outline-none"
              />
            </label>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {isLoadingConversations ? (
            <div className="flex h-full items-center justify-center px-6 text-sm text-white/45">
              Carregando historico...
            </div>
          ) : groupedConversations.length === 0 ? (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-white/45">
              {normalizeSearchValue(searchQuery) || dayFilter
                ? 'Nenhum atendimento encerrado encontrado para esse dia'
                : 'Nenhum atendimento encerrado disponivel'}
            </div>
          ) : (
            <div className="space-y-5 px-2 py-3">
              {groupedConversations.map((group) => (
                <section key={group.label} className="space-y-2">
                  <div className="px-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/38">
                      {group.label}
                    </p>
                  </div>

                  <ul className="flex flex-col">
                    {group.items.map((conversation) => {
                      const preview = buildMessagePreview(conversation)

                      return (
                        <ContactCard
                          key={conversation.id}
                          conversationId={conversation.id}
                          lastMessage={preview.text}
                          lastMessageIcon={preview.icon}
                          nomeContato={
                            (
                              conversation.contact?.name ??
                              conversation.pushName ??
                              formatPhone(conversation.phone || conversation.remoteJid.split('@')[0])
                            ) || 'Contato'
                          }
                          hora={formatListDate(getConversationReferenceDate(conversation))}
                          online={false}
                          noRead={false}
                          unreadCount={0}
                          isActive={conversation.id === selectedConversationId}
                          status={conversation.status}
                          onClick={() => {
                            setSelectedConversationId(conversation.id)
                            if (isMobile) setMobileView('chat')
                          }}
                        />
                      )
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>

        <footer className="border-t border-border/60 px-4 py-3">
          <div className="flex items-center justify-between gap-3 text-sm text-white/65">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1 || isLoadingConversations}
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 px-3 py-2 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={16} />
              Anterior
            </button>

            <span className="text-xs uppercase tracking-[0.16em] text-white/42">
              Pagina {page} de {totalPages}
            </span>

            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page >= totalPages || isLoadingConversations}
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 px-3 py-2 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Proxima
              <ChevronRight size={16} />
            </button>
          </div>
        </footer>
      </section>

      <section
        className={`h-full flex-1 flex-col overflow-hidden bg-card-foreground ${
          showMobileChat || !isMobile ? 'flex' : 'hidden'
        }`}
      >
        {selectedConversation ? (
          <HistoryConversationPanel
            conversation={selectedConversation}
            messages={messages}
            isLoadingMessages={isLoadingMessages}
            showBackButton={isMobile}
            onBack={() => setMobileView('list')}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-white/40">
            Selecione um atendimento encerrado para visualizar o historico completo.
          </div>
        )}
      </section>
    </main>
  )
}

function HistoryConversationPanel({
  conversation,
  messages,
  isLoadingMessages,
  showBackButton,
  onBack,
}: {
  conversation: WhatsAppConversation
  messages: WhatsAppMessage[]
  isLoadingMessages: boolean
  showBackButton: boolean
  onBack: () => void
}) {
  const avatarUrl = useConversationAvatar(conversation.id)
  const displayName =
    (
      conversation.contact?.name ??
      conversation.pushName ??
      formatPhone(conversation.phone || conversation.remoteJid.split('@')[0])
    ) || 'Contato'

  return (
    <>
      <header className="border-b border-white/8 bg-card px-3 py-3 md:px-4">
        <div className="flex items-center gap-3">
          {showBackButton ? (
            <button
              type="button"
              onClick={onBack}
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full transition hover:bg-white/10"
              aria-label="Voltar para historico"
            >
              <ChevronLeft size={20} />
            </button>
          ) : null}

          <UserProfile username={displayName} avatarUrl={avatarUrl} />

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-base font-semibold text-white">{displayName}</h2>
              <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-primary">
                Historico
              </span>
            </div>
            <p className="mt-1 truncate text-sm text-white/52">
              {formatPhone(conversation.phone || conversation.remoteJid.split('@')[0])}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetaCard
            icon={<UserRound size={14} />}
            label="Atendido por"
            value={conversation.assignedUser?.name ?? 'Nao atribuido'}
          />
          <MetaCard
            icon={<Shield size={14} />}
            label="Motivo"
            value={conversation.lastCloseReason ?? 'Nao informado'}
          />
          <MetaCard
            icon={<CalendarDays size={14} />}
            label="Encerrado em"
            value={formatDateTime(conversation.closedAt ?? conversation.lastMessageAt)}
          />
          <MetaCard
            icon={<Phone size={14} />}
            label="Contato"
            value={formatPhone(conversation.phone || conversation.remoteJid.split('@')[0]) || 'Nao informado'}
          />
        </div>
      </header>

      <ConversationTranscript
        conversationId={conversation.id}
        messages={messages}
        isLoadingMessages={isLoadingMessages}
        avatarUrl={avatarUrl}
        incomingAvatarName={displayName}
        emptyStateText="Selecione um atendimento encerrado"
        loadingText="Carregando historico de mensagens..."
      />

      <footer className="border-t border-white/8 bg-card px-4 py-3 text-xs text-white/45">
        Historico em modo leitura. Apenas administradores podem acessar conversas encerradas.
      </footer>
    </>
  )
}

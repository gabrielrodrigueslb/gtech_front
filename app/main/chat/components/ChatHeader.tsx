'use client'

import { ArrowLeftRight, CalendarClock, ChevronLeft, EllipsisVertical, MessageSquareX } from 'lucide-react'
import { useEffect, useState } from 'react'
import UserProfile from './UserProfile'
import ConversationDetailsDrawer from './ConversationDetailsDrawer'
import { useWhatsApp } from '@/context/Whatsappcontext'
import { DEFAULT_WHATSAPP_CLOSE_REASONS, getCloseReasons } from '@/lib/whatsapp-client'
import { useConversationAvatar } from '@/hooks/useConversationAvatar'

type ChatHeaderProps = {
  showBackButton?: boolean
  onBack?: () => void
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

function getContactLabel(phone?: string | null) {
  return formatPhone(phone)
}

function getConversationPhone(phone?: string | null, remoteJid?: string | null) {
  return phone ?? String(remoteJid ?? '').split('@')[0] ?? ''
}

function getDefaultScheduleDateTime() {
  const nextDay = new Date()
  nextDay.setDate(nextDay.getDate() + 1)
  nextDay.setHours(9, 0, 0, 0)

  return {
    date: nextDay.toISOString().slice(0, 10),
    time: `${String(nextDay.getHours()).padStart(2, '0')}:${String(nextDay.getMinutes()).padStart(2, '0')}`,
  }
}

function formatScheduledDateTime(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function extractActionErrorMessage(error: unknown, fallback: string) {
  const typedError = error as {
    response?: { data?: { error?: string; message?: string; details?: string } }
    message?: string
  } | null

  return (
    typedError?.response?.data?.error ??
    typedError?.response?.data?.message ??
    typedError?.response?.data?.details ??
    typedError?.message ??
    fallback
  )
}

export default function ChatHeader({
  showBackButton = false,
  onBack,
}: ChatHeaderProps) {
  const {
    activeConversation,
    closeConversation,
    assignConversation,
    routeConversationToAi,
    returnConversationToQueue,
    saveConversationContact,
    agents,
    currentUserId,
  } = useWhatsApp()
  const avatarUrl = useConversationAvatar(activeConversation?.id ?? null)
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false)
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false)
  const [isDetailsDrawerOpen, setIsDetailsDrawerOpen] = useState(false)
  const [closeReasonOptions, setCloseReasonOptions] = useState(DEFAULT_WHATSAPP_CLOSE_REASONS)
  const [closeReason, setCloseReason] = useState(DEFAULT_WHATSAPP_CLOSE_REASONS[0])
  const [isClosing, setIsClosing] = useState(false)
  const [isTransferring, setIsTransferring] = useState(false)
  const [isAssuming, setIsAssuming] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [shouldScheduleReopen, setShouldScheduleReopen] = useState(false)
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [sendScheduledMessage, setSendScheduledMessage] = useState(false)
  const [scheduledMessage, setScheduledMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadCloseReasons() {
      try {
        const reasons = await getCloseReasons()
        if (!isMounted || reasons.length === 0) return
        setCloseReasonOptions(reasons)
        setCloseReason((current) => current || reasons[0])
      } catch (_) {
        if (isMounted) setCloseReasonOptions(DEFAULT_WHATSAPP_CLOSE_REASONS)
      }
    }

    loadCloseReasons()

    return () => {
      isMounted = false
    }
  }, [])

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
  const routingOwnerType =
    activeConversation.routing?.ownerType ??
    (activeConversation.assignedUserId ? 'user' : 'queue')
  const isWaitingInQueue = routingOwnerType === 'queue' && !activeConversation.assignedUserId
  const isAiOwned = routingOwnerType === 'ai_agent' && !activeConversation.assignedUserId
  const isAssignedToAnotherUser = Boolean(
    activeConversation.assignedUserId &&
      currentUserId &&
      activeConversation.assignedUserId !== currentUserId
  )
  const canAssumeConversation = Boolean(
    currentUserId && !isClosed && !activeConversation.assignedUserId && (isWaitingInQueue || isAiOwned)
  )
  const scheduledReopenLabel = formatScheduledDateTime(activeConversation.scheduledReopenAt)

  const transferTargets = agents.filter((agent) => agent.isOnline && agent.id !== currentUserId)

  function openCloseModal() {
    if (!activeConversation || isClosed) return
    const defaultSchedule = getDefaultScheduleDateTime()
    setCloseReason(closeReasonOptions[0] ?? DEFAULT_WHATSAPP_CLOSE_REASONS[0])
    setShouldScheduleReopen(false)
    setScheduledDate(defaultSchedule.date)
    setScheduledTime(defaultSchedule.time)
    setSendScheduledMessage(false)
    setScheduledMessage('')
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

    const reopenAt =
      shouldScheduleReopen && scheduledDate && scheduledTime
        ? new Date(`${scheduledDate}T${scheduledTime}:00`)
        : null

    if (shouldScheduleReopen && (!reopenAt || Number.isNaN(reopenAt.getTime()) || reopenAt.getTime() <= Date.now())) {
      return
    }

    if (shouldScheduleReopen && sendScheduledMessage && !scheduledMessage.trim()) {
      return
    }

    setIsClosing(true)
    try {
      await closeConversation(
        activeConversation.id,
        reason,
        shouldScheduleReopen && reopenAt
          ? {
              reopenAt: reopenAt.toISOString(),
              message: sendScheduledMessage ? scheduledMessage.trim() : undefined,
              sendMessage: sendScheduledMessage,
            }
          : null
      )
      setIsCloseModalOpen(false)
    } finally {
      setIsClosing(false)
    }
  }

  async function handleTransfer(userId: string) {
    if (!activeConversation || !userId || isClosed) return

    setIsTransferring(true)
    setActionError(null)
    try {
      await assignConversation(activeConversation.id, userId)
      setIsTransferModalOpen(false)
    } catch (error) {
      setActionError(extractActionErrorMessage(error, 'Nao foi possivel transferir o atendimento.'))
    } finally {
      setIsTransferring(false)
    }
  }

  async function handleReturnToQueue() {
    if (!activeConversation || !activeConversation.assignedUserId || isClosed) return

    setIsTransferring(true)
    setActionError(null)
    try {
      await returnConversationToQueue(activeConversation.id)
      setIsTransferModalOpen(false)
    } catch (error) {
      setActionError(
        extractActionErrorMessage(error, 'Nao foi possivel devolver o atendimento para a fila.')
      )
    } finally {
      setIsTransferring(false)
    }
  }

  async function handleRouteToAi() {
    if (!activeConversation || isClosed || isAiOwned) return

    setIsTransferring(true)
    setActionError(null)
    try {
      await routeConversationToAi(activeConversation.id)
      setIsTransferModalOpen(false)
    } catch (error) {
      setActionError(
        extractActionErrorMessage(error, 'Nao foi possivel direcionar o atendimento para a IA.')
      )
    } finally {
      setIsTransferring(false)
    }
  }

  async function handleAssumeConversation() {
    if (!activeConversation || !currentUserId || !canAssumeConversation) return

    setIsAssuming(true)
    setActionError(null)
    try {
      await assignConversation(activeConversation.id, currentUserId)
    } catch (error) {
      setActionError(extractActionErrorMessage(error, 'Nao foi possivel assumir o atendimento.'))
    } finally {
      setIsAssuming(false)
    }
  }

  return (
    <>
      <header className="flex w-full items-center justify-between gap-3 bg-card px-3 py-3 md:px-4">
        <div className="flex items-center gap-3 min-w-0">
          {showBackButton ? (
            <button
              type="button"
              onClick={onBack}
              className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full transition hover:bg-white/10"
              aria-label="Voltar para atendimentos"
            >
              <ChevronLeft size={20} />
            </button>
          ) : null}
          <UserProfile username={name} avatarUrl={avatarUrl} />
          <div className="flex min-w-0 flex-col flex-1 gap-1 font-light overflow-hidden">
            <h4 className="font-medium truncate">{name}</h4>
            <p className="text-xs opacity-50 truncate">
              {getContactLabel(getConversationPhone(activeConversation.phone, activeConversation.remoteJid))}
            </p>
            {(isClosed || scheduledReopenLabel || isWaitingInQueue || isAiOwned) && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {isWaitingInQueue ? (
                  <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-amber-200">
                    Na fila
                  </span>
                ) : null}
                {isAiOwned ? (
                  <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-sky-100">
                    Com IA
                  </span>
                ) : null}
                {isClosed ? (
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-white/58">
                    Encerrado
                  </span>
                ) : null}
                {scheduledReopenLabel ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-primary">
                    <CalendarClock size={12} />
                    Reabrir {scheduledReopenLabel}
                  </span>
                ) : null}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 md:gap-2">
          {canAssumeConversation ? (
            <button
              type="button"
              onClick={handleAssumeConversation}
              disabled={isAssuming}
              className="ml-1 flex cursor-pointer items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-100 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50 md:ml-0"
            >
              <span>{isAssuming ? 'Assumindo...' : 'Assumir atendimento'}</span>
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => setIsDetailsDrawerOpen(true)}
            className="cursor-pointer rounded-xl p-2 transition hover:bg-white/10"
          >
            <EllipsisVertical size={18} />
          </button>

          <button
            type="button"
            onClick={() => setIsTransferModalOpen(true)}
            disabled={isClosed}
            className="cursor-pointer rounded-xl p-2 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowLeftRight size={18} />
          </button>

          {!isClosed ? (
            <button
              onClick={openCloseModal}
              className="ml-1 flex cursor-pointer items-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm transition-opacity hover:opacity-80 md:ml-2 md:p-3"
            >
              <MessageSquareX size={18} />
              <span className="hidden sm:inline">Encerrar Atendimento</span>
            </button>
          ) : (
            <span className="ml-1 rounded-xl border border-white/10 px-3 py-2 text-xs opacity-40 md:ml-2">
              Encerrado
            </span>
          )}
        </div>
      </header>

      {actionError ? (
        <div className="border-b border-rose-500/10 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {actionError}
        </div>
      ) : null}

      <ConversationDetailsDrawer
        isOpen={isDetailsDrawerOpen}
        onClose={() => setIsDetailsDrawerOpen(false)}
        conversation={activeConversation}
        presence={null}
        avatarUrl={avatarUrl}
        onSave={saveConversationContact}
      />

      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-card p-6 shadow-2xl">
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">Transferir atendimento</h3>
              <p className="text-sm opacity-70">
                Escolha outro atendente online, devolva para a fila ou direcione a conversa para a IA.
              </p>
            </div>

            <div className="mt-5 flex flex-col gap-2">
              {isAssignedToAnotherUser ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/70">
                  Este atendimento esta atualmente com{' '}
                  <span className="font-medium text-white">
                    {activeConversation.assignedUser?.name ?? 'outro atendente'}
                  </span>
                  .
                </div>
              ) : null}

              {!activeConversation.assignedUserId && isAiOwned ? (
                <div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 px-4 py-4 text-sm text-sky-100">
                  Este atendimento ja esta sendo conduzido pela IA no momento.
                </div>
              ) : null}

              {activeConversation.assignedUserId ? (
                <button
                  type="button"
                  onClick={handleReturnToQueue}
                  disabled={isTransferring}
                  className="flex items-center justify-between rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-4 text-left transition hover:bg-amber-500/15 disabled:opacity-50 cursor-pointer"
                >
                  <div>
                    <p className="font-medium">Voltar para a fila</p>
                    <p className="text-xs text-white/55">
                      Remove o responsavel atual e deixa o atendimento disponivel para a equipe.
                    </p>
                  </div>
                  <span className="text-xs text-amber-300">Fila</span>
                </button>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/65">
                  {isAiOwned
                    ? 'Este atendimento esta com a IA e sem responsavel humano definido.'
                    : 'Este atendimento ja esta na fila e sem responsavel definido.'}
                </div>
              )}

              {!isAiOwned ? (
                <button
                  type="button"
                  onClick={handleRouteToAi}
                  disabled={isTransferring}
                  className="flex items-center justify-between rounded-2xl border border-sky-500/20 bg-sky-500/10 px-4 py-4 text-left transition hover:bg-sky-500/15 disabled:opacity-50 cursor-pointer"
                >
                  <div>
                    <p className="font-medium">Direcionar para a IA</p>
                    <p className="text-xs text-white/55">
                      A conversa passa a ser conduzida pela IA ate precisar de um humano.
                    </p>
                  </div>
                  <span className="text-xs text-sky-200">IA</span>
                </button>
              ) : null}

              {transferTargets.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/65">
                  Nenhum outro atendente esta online agora.
                </div>
              ) : (
                transferTargets.map((agent) => (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => handleTransfer(agent.id)}
                    disabled={isTransferring}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/3 px-4 py-4 text-left transition hover:bg-white/8 disabled:opacity-50 cursor-pointer"
                  >
                    <div>
                      <p className="font-medium">{agent.name}</p>
                      <p className="text-xs text-white/50">{agent.email}</p>
                    </div>
                    <span className="text-xs text-emerald-400">Online</span>
                  </button>
                ))
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                disabled={isTransferring}
                className="rounded-xl border border-white/10 px-4 py-3 text-sm transition hover:bg-white/5 disabled:opacity-50 cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {isCloseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-card p-6 shadow-2xl">
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">Encerrar atendimento</h3>
              <p className="text-sm opacity-70">
                Informe o motivo do encerramento. Se quiser, ja deixe a reabertura agendada.
              </p>
            </div>

            <div className="mt-5 flex flex-col gap-3">
              <select
                value={closeReason}
                onChange={(e) => setCloseReason(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-background px-4 py-3 text-sm outline-none cursor-pointer"
              >
                {closeReasonOptions.map((option) => (
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

              <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/4 px-4 py-3">
                <input
                  type="checkbox"
                  checked={shouldScheduleReopen}
                  onChange={(event) => setShouldScheduleReopen(event.target.checked)}
                  className="cursor-pointer"
                />
                <div>
                  <p className="text-sm font-medium">Agendar reabertura</p>
                  <p className="text-xs text-white/55">
                    Reabre o atendimento automaticamente em uma data e horario especificos.
                  </p>
                </div>
              </label>

              {shouldScheduleReopen && (
                <div className="space-y-3 rounded-2xl border border-primary/15 bg-primary/8 p-4">
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="date"
                      value={scheduledDate}
                      onChange={(event) => setScheduledDate(event.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-background px-4 py-3 text-sm outline-none cursor-pointer"
                    />
                    <input
                      type="time"
                      value={scheduledTime}
                      onChange={(event) => setScheduledTime(event.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-background px-4 py-3 text-sm outline-none cursor-pointer"
                    />
                  </div>

                  <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-background/50 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={sendScheduledMessage}
                      onChange={(event) => setSendScheduledMessage(event.target.checked)}
                      className="cursor-pointer"
                    />
                    <div>
                      <p className="text-sm font-medium">Enviar mensagem quando reabrir</p>
                      <p className="text-xs text-white/55">
                        A mensagem sera disparada automaticamente na hora da reabertura.
                      </p>
                    </div>
                  </label>

                  {sendScheduledMessage && (
                    <textarea
                      value={scheduledMessage}
                      onChange={(event) => setScheduledMessage(event.target.value)}
                      rows={4}
                      placeholder="Mensagem que sera enviada na reabertura"
                      className="w-full resize-none rounded-xl border border-white/10 bg-background px-4 py-3 text-sm outline-none"
                    />
                  )}
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleCancelClose}
                disabled={isClosing}
                className="rounded-xl border border-white/10 px-4 py-3 text-sm transition hover:bg-white/5 disabled:opacity-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmClose}
                disabled={
                  isClosing ||
                  !closeReason.trim() ||
                  (shouldScheduleReopen &&
                    (!scheduledDate ||
                      !scheduledTime ||
                      new Date(`${scheduledDate}T${scheduledTime}:00`).getTime() <= Date.now() ||
                      (sendScheduledMessage && !scheduledMessage.trim())))
                }
                className="rounded-xl bg-primary px-4 py-3 text-sm font-medium transition hover:opacity-90 disabled:opacity-50 cursor-pointer"
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

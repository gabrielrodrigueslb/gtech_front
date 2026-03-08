'use client'

import {
  FileAudio,
  FileImage,
  FileText,
  Mic,
  Plus,
  SendHorizontal,
  SmilePlus,
  Square,
  Trash2,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useWhatsApp } from '@/context/Whatsappcontext'
import {
  normalizeWhatsAppMediaMimeType,
  sendMediaMessage,
  sendMessage,
} from '@/lib/whatsapp-client'
import { getMe } from '@/lib/auth'
import AudioBars from './AudioBars'
import ChatAudioPlayer from './ChatAudioPlayer'

const QUICK_EMOJIS = [
  '😀', '😁', '😂', '🙂', '😉', '😍', '🥰', '😘',
  '🤔', '😎', '🥳', '🙏', '👏', '💙', '❤️', '🔥',
  '✨', '🎉', '👍', '👀', '😅', '🤝', '💡', '🚀',
]

export default function ChatFooter() {
  const [text, setText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isUploadingMedia, setIsUploadingMedia] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false)
  const [isEmojiMenuOpen, setIsEmojiMenuOpen] = useState(false)
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null)
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingLevel, setRecordingLevel] = useState(0)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [mediaError, setMediaError] = useState<string | null>(null)
  const { activeConversation, activeConversationId, addOutgoingMessage } = useWhatsApp()

  const inputRef = useRef<HTMLInputElement>(null)
  const composerToolsRef = useRef<HTMLDivElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const documentInputRef = useRef<HTMLInputElement>(null)
  const audioInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordingChunksRef = useRef<Blob[]>([])
  const recordingStreamRef = useRef<MediaStream | null>(null)
  const discardRecordingRef = useRef(false)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const analyserFrameRef = useRef<number | null>(null)
  const recordingTimerRef = useRef<number | null>(null)

  const hasText = text.trim().length > 0
  const isBusy = isSending || isUploadingMedia
  const hasRecordedAudio = !!recordedAudioBlob && !!recordedAudioUrl
  const isComposerLocked = isRecording || hasRecordedAudio
  const showComposerTools = !isComposerLocked
  const routingOwnerType =
    activeConversation?.routing?.ownerType ??
    (activeConversation?.assignedUserId ? 'user' : 'queue')
  const isConversationClosed =
    activeConversation?.status === 'CLOSED' || activeConversation?.status === 'ARCHIVED'
  const isConversationInQueue =
    routingOwnerType === 'queue' && !activeConversation?.assignedUserId
  const isConversationWithAi =
    routingOwnerType === 'ai_agent' && !activeConversation?.assignedUserId
  const isConversationAssignedToAnotherUser = Boolean(
    activeConversation?.assignedUserId &&
      currentUserId &&
      activeConversation.assignedUserId !== currentUserId
  )
  const isInputDisabled =
    !activeConversationId ||
    !activeConversation ||
    isConversationClosed ||
    isConversationInQueue ||
    isConversationWithAi ||
    isConversationAssignedToAnotherUser ||
    isBusy ||
    !currentUserId ||
    isRecording

  function formatDuration(totalSeconds: number) {
    return `${String(Math.floor(totalSeconds / 60)).padStart(2, '0')}:${String(
      totalSeconds % 60
    ).padStart(2, '0')}`
  }

  useEffect(() => {
    let isMounted = true

    async function loadCurrentUser() {
      try {
        const me = await getMe()
        if (!isMounted) return
        setCurrentUserId(me?.id ?? null)
      } catch (error) {
        console.error('[ChatFooter] Erro ao carregar usuario autenticado:', error)
        if (isMounted) setCurrentUserId(null)
      }
    }

    loadCurrentUser()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    return () => {
      if (recordedAudioUrl) {
        URL.revokeObjectURL(recordedAudioUrl)
      }
      stopRecordingStream()
    }
  }, [recordedAudioUrl])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!(event.target instanceof Node)) return
      if (!composerToolsRef.current?.contains(event.target)) {
        setIsAttachmentMenuOpen(false)
        setIsEmojiMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!showComposerTools) {
      setIsAttachmentMenuOpen(false)
      setIsEmojiMenuOpen(false)
    }
  }, [showComposerTools])

  function stopRecordingStream() {
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop())
    recordingStreamRef.current = null
    if (analyserFrameRef.current) {
      cancelAnimationFrame(analyserFrameRef.current)
      analyserFrameRef.current = null
    }
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
    analyserRef.current = null
    audioContextRef.current?.close().catch(() => {})
    audioContextRef.current = null
    setRecordingLevel(0)
    setRecordingDuration(0)
  }

  function clearRecordedAudio(shouldFocusInput = true) {
    discardRecordingRef.current = true
    recordingChunksRef.current = []

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    } else {
      stopRecordingStream()
      mediaRecorderRef.current = null
    }

    setIsRecording(false)
    if (recordedAudioUrl) URL.revokeObjectURL(recordedAudioUrl)
    setRecordedAudioBlob(null)
    setRecordedAudioUrl(null)
    if (shouldFocusInput) {
      window.setTimeout(() => inputRef.current?.focus(), 0)
    }
  }

  function insertEmoji(emoji: string) {
    if (isInputDisabled || isComposerLocked) return

    const input = inputRef.current
    if (!input) {
      setText((current) => `${current}${emoji}`)
      return
    }

    const selectionStart = input.selectionStart ?? text.length
    const selectionEnd = input.selectionEnd ?? text.length
    const nextText = `${text.slice(0, selectionStart)}${emoji}${text.slice(selectionEnd)}`

    setText(nextText)
    setIsEmojiMenuOpen(false)

    window.setTimeout(() => {
      input.focus()
      const nextCaretPosition = selectionStart + emoji.length
      input.setSelectionRange(nextCaretPosition, nextCaretPosition)
    }, 0)
  }

  async function handleSend() {
    if (!hasText || !activeConversationId || isSending || !currentUserId) return

    const textToSend = text.trim()
    setText('')
    inputRef.current?.focus()

    setIsSending(true)
    try {
      const msg = await sendMessage(activeConversationId, textToSend, currentUserId)
      addOutgoingMessage(msg)
    } catch (err) {
      console.error('[ChatFooter] Erro ao enviar:', err)
      setText(textToSend)
    } finally {
      setIsSending(false)
    }
  }

  async function handleSendMedia(input: Parameters<typeof sendMediaMessage>[1]) {
    if (!activeConversationId) return

    setIsUploadingMedia(true)
    setMediaError(null)
    setIsAttachmentMenuOpen(false)

    try {
      const message = await sendMediaMessage(activeConversationId, input)
      addOutgoingMessage(message)
    } catch (error) {
      console.error('[ChatFooter] Erro ao enviar midia:', error)
      setMediaError('Nao foi possivel enviar o anexo.')
    } finally {
      setIsUploadingMedia(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  async function fileToDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(new Error('Falha ao ler o arquivo'))
      reader.readAsDataURL(file)
    })
  }

  async function getAudioDurationSeconds(file: Blob) {
    if (!file.type.startsWith('audio/')) return undefined

    return new Promise<number | undefined>((resolve) => {
      const objectUrl = URL.createObjectURL(file)
      const audio = document.createElement('audio')

      const cleanup = () => {
        audio.src = ''
        audio.load()
        URL.revokeObjectURL(objectUrl)
      }

      audio.preload = 'metadata'
      audio.onloadedmetadata = () => {
        const duration = Number.isFinite(audio.duration)
          ? Math.max(1, Math.round(audio.duration))
          : undefined
        cleanup()
        resolve(duration)
      }
      audio.onerror = () => {
        cleanup()
        resolve(undefined)
      }
      audio.src = objectUrl
    })
  }

  async function prepareRecordedAudioForSending(blob: Blob) {
    const mimeType = blob.type || 'audio/webm'
    if (mimeType.startsWith('audio/ogg')) {
      return {
        file: new File([blob], `gravacao-${Date.now()}.ogg`, {
          type: mimeType,
        }),
        ptt: true,
      }
    }

    if (mimeType.startsWith('audio/mp4') || mimeType.includes('aac') || mimeType.includes('m4a')) {
      return {
        file: new File([blob], `gravacao-${Date.now()}.m4a`, {
          type: mimeType,
        }),
        ptt: true,
      }
    }

    return {
      file: new File([blob], `gravacao-${Date.now()}.webm`, {
        type: mimeType,
      }),
      ptt: true,
    }
  }

  async function handleSelectedFile(file: File, forcedType?: 'image' | 'audio' | 'document') {
    const mediaDataUrl = await fileToDataUrl(file)
    const normalizedMimeType = normalizeWhatsAppMediaMimeType(file.type, forcedType)
    const seconds = forcedType === 'audio' ? await getAudioDurationSeconds(file) : undefined

    await handleSendMedia({
      mediaDataUrl,
      mimeType: normalizedMimeType,
      fileName: file.name,
      type: forcedType,
      seconds,
    })
  }

  async function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    await handleSelectedFile(file, 'image')
  }

  async function handleDocumentChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    await handleSelectedFile(file, 'document')
  }

  async function handleAudioFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    await handleSelectedFile(file, 'audio')
  }

  async function startRecording() {
    if (!activeConversationId || !currentUserId || isBusy) return

    try {
      clearRecordedAudio(false)
      discardRecordingRef.current = false
      setMediaError(null)

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      recordingStreamRef.current = stream
      const audioContext = new window.AudioContext()
      const analyser = audioContext.createAnalyser()
      const source = audioContext.createMediaStreamSource(stream)
      analyser.fftSize = 256
      source.connect(analyser)
      audioContextRef.current = audioContext
      analyserRef.current = analyser

      const preferredMimeType =
        MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
          ? 'audio/ogg;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/mp4;codecs=mp4a.40.2')
            ? 'audio/mp4;codecs=mp4a.40.2'
          : MediaRecorder.isTypeSupported('audio/mp4')
            ? 'audio/mp4'
          : MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm')
            ? 'audio/webm'
            : ''

      const recorder = preferredMimeType
        ? new MediaRecorder(stream, { mimeType: preferredMimeType })
        : new MediaRecorder(stream)

      mediaRecorderRef.current = recorder
      recordingChunksRef.current = []

      const meterData = new Uint8Array(analyser.frequencyBinCount)
      const updateMeter = () => {
        analyser.getByteFrequencyData(meterData)
        const average =
          meterData.reduce((sum, value) => sum + value, 0) /
          Math.max(1, meterData.length * 255)
        setRecordingLevel(Math.min(1, average * 1.8))
        analyserFrameRef.current = requestAnimationFrame(updateMeter)
      }

      updateMeter()
      setRecordingDuration(0)
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingDuration((current) => current + 1)
      }, 1000)

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordingChunksRef.current.push(event.data)
      }

      recorder.onstop = () => {
        const shouldDiscard = discardRecordingRef.current
        discardRecordingRef.current = false
        mediaRecorderRef.current = null
        setIsRecording(false)
        stopRecordingStream()

        if (shouldDiscard) {
          setRecordedAudioBlob(null)
          setRecordedAudioUrl(null)
          return
        }

        const blob = new Blob(recordingChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        })
        const audioUrl = URL.createObjectURL(blob)

        setRecordedAudioBlob(blob)
        setRecordedAudioUrl(audioUrl)
      }

      recorder.start()
      setIsRecording(true)
    } catch (error) {
      console.error('[ChatFooter] Erro ao iniciar gravacao:', error)
      setMediaError('Nao foi possivel acessar o microfone.')
      stopRecordingStream()
      setIsRecording(false)
    }
  }

  function stopRecording() {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return
    mediaRecorderRef.current.stop()
  }

  async function handleSendRecordedAudio() {
    if (!recordedAudioBlob) return

    const { file, ptt } = await prepareRecordedAudioForSending(recordedAudioBlob)
    const mediaDataUrl = await fileToDataUrl(file)

    await handleSendMedia({
      mediaDataUrl,
      mimeType: normalizeWhatsAppMediaMimeType(file.type, 'audio'),
      fileName: file.name,
      type: 'audio',
      ptt,
    })

    clearRecordedAudio()
  }

  async function handlePrimaryAction() {
    if (hasText) {
      await handleSend()
      return
    }

    if (isRecording) {
      stopRecording()
      return
    }

    await startRecording()
  }

  return (
    <footer className="flex w-full flex-col gap-3 bg-card px-3 py-2">
      {mediaError && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {mediaError}
        </div>
      )}

      {isConversationInQueue && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Este atendimento esta na fila. Assuma o atendimento no cabecalho para responder.
        </div>
      )}

      {isConversationWithAi && (
        <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
          Este atendimento esta com a IA. Assuma no cabecalho se quiser continuar manualmente.
        </div>
      )}

      {isConversationAssignedToAnotherUser && (
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75">
          Este atendimento esta com{' '}
          <span className="font-medium text-white">
            {activeConversation?.assignedUser?.name ?? 'outro atendente'}
          </span>
          . A conversa fica em modo leitura enquanto nao estiver com voce.
        </div>
      )}

      <div className="flex w-full items-center gap-3">
        <div ref={composerToolsRef} className="relative flex h-8 shrink-0 items-center gap-2">
          {showComposerTools ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setIsEmojiMenuOpen(false)
                  setIsAttachmentMenuOpen((current) => !current)
                }}
                disabled={
                  !activeConversationId ||
                  isBusy ||
                  isConversationClosed ||
                  isConversationInQueue ||
                  isConversationWithAi ||
                  isConversationAssignedToAnotherUser
                }
                className="cursor-pointer rounded-sm p-1 transition-all hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus />
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAttachmentMenuOpen(false)
                  setIsEmojiMenuOpen((current) => !current)
                }}
                disabled={
                  !activeConversationId ||
                  isConversationClosed ||
                  isConversationInQueue ||
                  isConversationWithAi ||
                  isConversationAssignedToAnotherUser
                }
                className="cursor-pointer rounded-sm p-1 transition-all hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <SmilePlus />
              </button>

              {isAttachmentMenuOpen && (
                <div className="absolute bottom-14 left-0 z-30 w-56 rounded-2xl border border-white/10 bg-card p-2 shadow-xl">
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-sm transition hover:bg-white/5"
                  >
                    <FileImage size={18} /> Enviar imagem
                  </button>
                  <button
                    type="button"
                    onClick={() => documentInputRef.current?.click()}
                    className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-sm transition hover:bg-white/5"
                  >
                    <FileText size={18} /> Enviar arquivo
                  </button>
                  <button
                    type="button"
                    onClick={() => audioInputRef.current?.click()}
                    className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-sm transition hover:bg-white/5"
                  >
                    <FileAudio size={18} /> Enviar audio
                  </button>
                </div>
              )}

              {isEmojiMenuOpen && (
                <div className="absolute bottom-14 left-12 z-30 w-[280px] rounded-2xl border border-white/10 bg-card p-3 shadow-xl">
                  <p className="px-1 pb-2 text-xs uppercase tracking-[0.16em] text-white/45">Emojis</p>
                  <div className="grid grid-cols-8 gap-1">
                    {QUICK_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => insertEmoji(emoji)}
                        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-lg transition hover:bg-white/8"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="w-[52px] shrink-0" aria-hidden="true" />
          )}
        </div>

        <div className="flex min-w-0 flex-1 items-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
          {isRecording ? (
            <div className="flex w-full items-center gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Mic size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">Gravando audio</p>
                    <p className="text-xs text-white/55">{formatDuration(recordingDuration)}</p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-primary/30 px-3 py-1 text-[11px] font-medium text-primary">
                    <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                    Capturando
                  </span>
                </div>
                <AudioBars
                  progress={recordingLevel}
                  liveLevel={recordingLevel}
                  isActive
                  className="mt-2"
                />
              </div>
            </div>
          ) : hasRecordedAudio ? (
            <div className="w-full min-w-0">
              <ChatAudioPlayer
                src={recordedAudioUrl!}
                mimeType={recordedAudioBlob?.type || 'audio/webm'}
                label="Previa do audio"
                variant="inline"
              />
            </div>
          ) : (
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              type="text"
              disabled={isInputDisabled}
              className="h-12 w-full bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none disabled:opacity-40 flex-1"
              placeholder={
                !activeConversationId
                  ? 'Selecione uma conversa'
                  : isConversationClosed
                    ? 'Atendimento encerrado. Historico em modo leitura'
                  : isConversationInQueue
                    ? 'Assuma o atendimento para responder'
                  : isConversationWithAi
                    ? 'A IA esta conduzindo este atendimento'
                  : isConversationAssignedToAnotherUser
                    ? `Este atendimento esta com ${activeConversation?.assignedUser?.name ?? 'outro atendente'}`
                  : !currentUserId
                      ? 'Carregando usuario...'
                      : 'Escreva sua mensagem'
              }
            />
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 ">
          {isRecording ? (
            <button
              type="button"
              onClick={stopRecording}
              className="inline-flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-primary text-white transition hover:opacity-90"
              title="Finalizar gravacao"
            >
              <Square size={18} />
            </button>
          ) : hasRecordedAudio ? (
            <>
              <button
                type="button"
                onClick={() => clearRecordedAudio()}
                className="inline-flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border border-white/10 text-white transition hover:bg-white/5"
                title="Excluir audio"
              >
                <Trash2 size={18} />
              </button>
              <button
                type="button"
                onClick={handleSendRecordedAudio}
                disabled={isUploadingMedia}
                className="inline-flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-primary text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                title="Enviar audio"
              >
                <SendHorizontal size={18} />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handlePrimaryAction}
              disabled={
                !activeConversationId ||
                isBusy ||
                !currentUserId ||
                isConversationClosed ||
                isConversationInQueue ||
                isConversationWithAi ||
                isConversationAssignedToAnotherUser
              }
              className="flex size-12 cursor-pointer items-center justify-center rounded-full bg-primary p-1 transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {hasText ? <SendHorizontal /> : <Mic />}
            </button>
          )}
        </div>
      </div>

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={handleImageChange}
      />
      <input
        ref={documentInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,application/*"
        hidden
        onChange={handleDocumentChange}
      />
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        hidden
        onChange={handleAudioFileChange}
      />
    </footer>
  )
}

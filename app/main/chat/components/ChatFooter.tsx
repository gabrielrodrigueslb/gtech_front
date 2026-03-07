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
import { sendMediaMessage, sendMessage } from '@/lib/Whatsapp'
import { getMe } from '@/lib/auth'
import AudioBars from './AudioBars'
import ChatAudioPlayer from './ChatAudioPlayer'

export default function ChatFooter() {
  const [text, setText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isUploadingMedia, setIsUploadingMedia] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false)
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null)
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingLevel, setRecordingLevel] = useState(0)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [mediaError, setMediaError] = useState<string | null>(null)
  const { activeConversationId, addOutgoingMessage } = useWhatsApp()

  const inputRef = useRef<HTMLInputElement>(null)
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
  const isInputDisabled = !activeConversationId || isBusy || !currentUserId || isRecording

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

  function clearRecordedAudio() {
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

  async function blobToArrayBuffer(blob: Blob) {
    return await blob.arrayBuffer()
  }

  function encodeWav(audioBuffer: AudioBuffer) {
    const numberOfChannels = audioBuffer.numberOfChannels
    const sampleRate = audioBuffer.sampleRate
    const format = 1
    const bitDepth = 16
    const samples = audioBuffer.length
    const blockAlign = numberOfChannels * (bitDepth / 8)
    const buffer = new ArrayBuffer(44 + samples * blockAlign)
    const view = new DataView(buffer)

    function writeString(offset: number, value: string) {
      for (let i = 0; i < value.length; i += 1) {
        view.setUint8(offset + i, value.charCodeAt(i))
      }
    }

    writeString(0, 'RIFF')
    view.setUint32(4, 36 + samples * blockAlign, true)
    writeString(8, 'WAVE')
    writeString(12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, format, true)
    view.setUint16(22, numberOfChannels, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * blockAlign, true)
    view.setUint16(32, blockAlign, true)
    view.setUint16(34, bitDepth, true)
    writeString(36, 'data')
    view.setUint32(40, samples * blockAlign, true)

    const channelData = Array.from({ length: numberOfChannels }, (_, channel) =>
      audioBuffer.getChannelData(channel)
    )

    let offset = 44
    for (let i = 0; i < samples; i += 1) {
      for (let channel = 0; channel < numberOfChannels; channel += 1) {
        const sample = Math.max(-1, Math.min(1, channelData[channel][i]))
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
        offset += 2
      }
    }

    return new Blob([buffer], { type: 'audio/wav' })
  }

  async function prepareRecordedAudioForSending(blob: Blob) {
    const mimeType = blob.type || 'audio/webm'
    if (mimeType.includes('ogg') || mimeType.includes('opus')) {
      return {
        file: new File([blob], `gravacao-${Date.now()}.ogg`, {
          type: mimeType,
        }),
        ptt: true,
      }
    }

    const audioContext = new window.AudioContext()
    try {
      const arrayBuffer = await blobToArrayBuffer(blob)
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0))
      const wavBlob = encodeWav(audioBuffer)
      return {
        file: new File([wavBlob], `gravacao-${Date.now()}.wav`, {
          type: 'audio/wav',
        }),
        ptt: false,
      }
    } catch (error) {
      return {
        file: new File([blob], `gravacao-${Date.now()}.webm`, {
          type: mimeType,
        }),
        ptt: false,
      }
    } finally {
      await audioContext.close().catch(() => {})
    }
  }

  async function handleSelectedFile(file: File, forcedType?: 'image' | 'audio' | 'document') {
    const mediaDataUrl = await fileToDataUrl(file)

    await handleSendMedia({
      mediaDataUrl,
      mimeType: file.type,
      fileName: file.name,
      type: forcedType,
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
      clearRecordedAudio()
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
        MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
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
      mimeType: file.type,
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
    <footer className="w-full bg-card flex flex-col px-3 py-2 gap-3">
      {recordedAudioUrl && (
        <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
          <p className="text-sm font-medium">Audio gravado</p>
          <ChatAudioPlayer
            src={recordedAudioUrl}
            mimeType={recordedAudioBlob?.type || 'audio/webm'}
            label="Previa da gravacao"
            variant="panel"
          />
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={clearRecordedAudio}
              className="rounded-xl border border-white/10 px-4 py-2 text-sm transition hover:bg-white/5"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSendRecordedAudio}
              disabled={isUploadingMedia}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-medium transition hover:opacity-90 disabled:opacity-50"
            >
              {isUploadingMedia ? 'Enviando...' : 'Enviar audio'}
            </button>
          </div>
        </div>
      )}

      {isRecording && (
        <div className="flex flex-col gap-3 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Gravando audio</p>
              <p className="text-xs text-white/55">
                {String(Math.floor(recordingDuration / 60)).padStart(2, '0')}:
                {String(recordingDuration % 60).padStart(2, '0')}
              </p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 px-3 py-1 text-xs font-medium text-primary">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              Capturando
            </span>
          </div>

          <AudioBars progress={recordingLevel} liveLevel={recordingLevel} isActive className="mt-1" />
        </div>
      )}

      {mediaError && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {mediaError}
        </div>
      )}

      <div className="w-full flex gap-4 items-center">
        <div className="relative flex gap-2">
          <button
            type="button"
            onClick={() => setIsAttachmentMenuOpen((current) => !current)}
            disabled={!activeConversationId || isBusy}
            className="p-1 rounded-sm transition-all cursor-pointer hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus />
          </button>
          <button className="p-1 rounded-sm transition-all cursor-pointer hover:bg-white/20">
            <SmilePlus />
          </button>

          {isAttachmentMenuOpen && (
            <div className="absolute bottom-14 left-0 z-30 w-56 rounded-2xl border border-white/10 bg-card p-2 shadow-xl">
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm transition hover:bg-white/5"
              >
                <FileImage size={18} /> Enviar imagem
              </button>
              <button
                type="button"
                onClick={() => documentInputRef.current?.click()}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm transition hover:bg-white/5"
              >
                <FileText size={18} /> Enviar arquivo
              </button>
              <button
                type="button"
                onClick={() => audioInputRef.current?.click()}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm transition hover:bg-white/5"
              >
                <FileAudio size={18} /> Enviar audio
              </button>
            </div>
          )}
        </div>

        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          type="text"
          disabled={isInputDisabled}
          className="bg-white/5 rounded-md flex-1 px-6 py-4 text-sm border focus:outline-none disabled:opacity-40"
          placeholder={
            isRecording
              ? 'Gravando audio... clique no botao para finalizar'
              : !activeConversationId
                ? 'Selecione uma conversa'
                : !currentUserId
                  ? 'Carregando usuario...'
                  : 'Escreva sua mensagem'
          }
        />

        <button
          type="button"
          onClick={handlePrimaryAction}
          disabled={!activeConversationId || isBusy || !currentUserId || !!recordedAudioBlob}
          className="p-1 size-12 flex items-center justify-center rounded-full transition-all cursor-pointer hover:bg-white/20 bg-primary disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {hasText ? (
            <SendHorizontal />
          ) : isRecording ? (
            <Square />
          ) : (
            <Mic />
          )}
        </button>

        {(isRecording || recordedAudioBlob) && (
          <button
            type="button"
            onClick={clearRecordedAudio}
            className="p-1 size-12 flex items-center justify-center rounded-full transition-all cursor-pointer hover:bg-white/20 border border-white/10"
          >
            <Trash2 size={18} />
          </button>
        )}
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

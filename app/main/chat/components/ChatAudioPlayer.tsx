'use client'

import { Pause, Play } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import AudioBars from './AudioBars'

type ChatAudioPlayerVariant = 'bubble' | 'panel' | 'inline'
type ChatAudioPlayerTone = 'incoming' | 'outgoing' | 'neutral'

type ChatAudioPlayerProps = {
  src: string
  mimeType?: string | null
  label?: string
  variant?: ChatAudioPlayerVariant
  tone?: ChatAudioPlayerTone
}

type PlayerTheme = {
  outer: string
  shell: string
  button: string
  icon: string
  time: string
  activeBar: string
  inactiveBar: string
  label: string
}

function formatTime(totalSeconds: number) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '00:00'

  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function getTheme(variant: ChatAudioPlayerVariant, tone: ChatAudioPlayerTone): PlayerTheme {
  if (variant === 'panel') {
    return {
      outer: 'rounded-2xl border border-white/10 bg-white/[0.03] p-4',
      shell: 'flex items-center gap-3 rounded-full border border-white/10 bg-black/10 px-3.5 py-2.5 sm:px-4 sm:py-3',
      button:
        'h-9 w-9 border border-primary/25 bg-primary/15 text-primary hover:bg-primary/20 sm:h-11 sm:w-11',
      icon: 'text-primary',
      time: 'text-xs font-medium text-white/65 sm:text-sm',
      activeBar: 'bg-primary',
      inactiveBar: 'bg-white/16',
      label: 'mb-3 text-[10px] font-medium uppercase tracking-[0.18em] text-white/35',
    }
  }

  if (variant === 'inline') {
    return {
      outer: 'w-full',
      shell: 'flex items-center gap-2.5 rounded-full border border-white/10 bg-black/10 px-3 py-2 sm:gap-3 sm:px-3.5 sm:py-2.5',
      button:
        'h-[34px] w-[34px] border border-primary/25 bg-primary/15 text-primary hover:bg-primary/20 sm:h-10 sm:w-10',
      icon: 'text-primary',
      time: 'text-xs font-medium text-white/60',
      activeBar: 'bg-primary',
      inactiveBar: 'bg-white/18',
      label: 'sr-only',
    }
  }

  if (tone === 'outgoing') {
    return {
      outer: 'w-full',
      shell:
        'flex items-center gap-2.5 rounded-full bg-primary px-3 py-2.5 text-white shadow-[0_10px_24px_rgba(0,153,255,0.16)] sm:gap-3 sm:px-4 sm:py-3',
      button: 'h-9 w-9 bg-white/14 text-white hover:bg-white/18 sm:h-11 sm:w-11',
      icon: 'text-white',
      time: 'text-xs font-medium text-white/90 sm:text-sm',
      activeBar: 'bg-white',
      inactiveBar: 'bg-white/30',
      label: 'sr-only',
    }
  }

  return {
    outer: 'w-full',
    shell: 'flex items-center gap-2.5 rounded-full border border-white/10 bg-card px-3 py-2.5 text-white sm:gap-3 sm:px-4 sm:py-3',
    button: 'h-9 w-9 border border-primary/20 bg-primary/12 text-primary hover:bg-primary/18 sm:h-11 sm:w-11',
    icon: 'text-primary',
    time: 'text-xs font-medium text-white/70 sm:text-sm',
    activeBar: 'bg-primary',
    inactiveBar: 'bg-white/16',
    label: 'sr-only',
  }
}

export default function ChatAudioPlayer({
  src,
  mimeType = 'audio/ogg',
  label = 'Mensagem de audio',
  variant = 'bubble',
  tone = 'neutral',
}: ChatAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const syncTime = () => setCurrentTime(audio.currentTime || 0)
    const syncDuration = () => setDuration(audio.duration || 0)
    const handlePause = () => setIsPlaying(false)
    const handleEnded = () => {
      setIsPlaying(false)
      setCurrentTime(0)
    }

    audio.addEventListener('timeupdate', syncTime)
    audio.addEventListener('loadedmetadata', syncDuration)
    audio.addEventListener('durationchange', syncDuration)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('ended', handleEnded)

    return () => {
      audio.pause()
      audio.removeEventListener('timeupdate', syncTime)
      audio.removeEventListener('loadedmetadata', syncDuration)
      audio.removeEventListener('durationchange', syncDuration)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('ended', handleEnded)
    }
  }, [src])

  const progress = useMemo(() => {
    if (!duration) return 0
    return Math.max(0, Math.min(currentTime / duration, 1))
  }, [currentTime, duration])

  const theme = getTheme(variant, tone)
  const timeLabel =
    variant === 'panel' ? `${formatTime(currentTime)} / ${formatTime(duration)}` : formatTime(duration)

  async function togglePlayback() {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
      return
    }

    try {
      await audio.play()
      setIsPlaying(true)
    } catch (error) {
      setIsPlaying(false)
    }
  }

  function handleSeek(event: React.ChangeEvent<HTMLInputElement>) {
    const audio = audioRef.current
    if (!audio || !duration) return

    const nextProgress = Number(event.target.value) / 1000
    const nextTime = duration * nextProgress
    audio.currentTime = nextTime
    setCurrentTime(nextTime)
  }

  return (
    <div className={theme.outer}>
      <audio ref={audioRef} preload="metadata">
        <source src={src} type={mimeType ?? 'audio/ogg'} />
      </audio>

      <p className={theme.label}>{label}</p>

      <div className={theme.shell}>
        <button
          type="button"
          onClick={togglePlayback}
          className={`flex shrink-0 cursor-pointer items-center justify-center rounded-full transition ${theme.button}`}
          aria-label={isPlaying ? 'Pausar audio' : 'Reproduzir audio'}
        >
          {isPlaying ? (
            <Pause size={18} className={theme.icon} />
          ) : (
            <Play size={18} className={`${theme.icon} translate-x-px`} />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <div className="relative min-w-0 flex-1">
              <AudioBars
                progress={progress}
                isActive={isPlaying}
                liveLevel={isPlaying ? 0.35 : 0}
                className="h-7 sm:h-8"
                barClassName="w-[2px] sm:w-[4px]"
                activeBarClassName={theme.activeBar}
                inactiveBarClassName={theme.inactiveBar}
              />
              <input
                type="range"
                min={0}
                max={1000}
                step={1}
                value={Math.round(progress * 1000)}
                onChange={handleSeek}
                className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
                aria-label={label}
              />
            </div>

            <span className={`shrink-0 tabular-nums ${theme.time}`}>{timeLabel}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import { Pause, Play } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import AudioBars from './AudioBars'

type ChatAudioPlayerProps = {
  src: string
  mimeType?: string | null
  label?: string
  variant?: 'bubble' | 'panel'
}

function formatTime(totalSeconds: number) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '00:00'

  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export default function ChatAudioPlayer({
  src,
  mimeType = 'audio/ogg',
  label = 'Mensagem de audio',
  variant = 'bubble',
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
    const handleEnded = () => {
      setIsPlaying(false)
      setCurrentTime(0)
    }

    audio.addEventListener('timeupdate', syncTime)
    audio.addEventListener('loadedmetadata', syncDuration)
    audio.addEventListener('durationchange', syncDuration)
    audio.addEventListener('ended', handleEnded)

    return () => {
      audio.pause()
      audio.removeEventListener('timeupdate', syncTime)
      audio.removeEventListener('loadedmetadata', syncDuration)
      audio.removeEventListener('durationchange', syncDuration)
      audio.removeEventListener('ended', handleEnded)
    }
  }, [src])

  const progress = useMemo(() => {
    if (!duration) return 0
    return Math.max(0, Math.min(currentTime / duration, 1))
  }, [currentTime, duration])

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

  const isPanel = variant === 'panel'

  return (
    <div
      className={
        isPanel
          ? 'rounded-2xl border border-white/10 bg-black/15 px-4 py-3'
          : 'rounded-xl px-0 py-1'
      }
    >
      <audio ref={audioRef} preload="metadata">
        <source src={src} type={mimeType ?? 'audio/ogg'} />
      </audio>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlayback}
          className={`flex shrink-0 items-center justify-center rounded-full text-white transition hover:opacity-90 ${
            isPanel ? 'h-11 w-11 bg-primary' : 'h-10 w-10 bg-black/20 ring-1 ring-white/10'
          }`}
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} className="translate-x-[1px]" />}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p
              className={`truncate text-xs font-medium uppercase tracking-[0.18em] ${
                isPanel ? 'text-white/45' : 'text-white/50'
              }`}
            >
              {label}
            </p>
            <span className="shrink-0 text-xs text-white/55">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <AudioBars
            progress={progress}
            isActive={isPlaying}
            liveLevel={isPlaying ? 0.45 : 0}
            className="mt-3"
          />

          <input
            type="range"
            min={0}
            max={1000}
            step={1}
            value={Math.round(progress * 1000)}
            onChange={handleSeek}
            className={`mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full accent-primary ${
              isPanel ? 'bg-white/10' : 'bg-white/8'
            }`}
          />
        </div>
      </div>
    </div>
  )
}

'use client'

type AudioBarsProps = {
  progress?: number
  isActive?: boolean
  liveLevel?: number
  className?: string
}

const BAR_HEIGHTS = [8, 14, 11, 18, 10, 22, 13, 19, 9, 16, 12, 20, 11, 17, 8, 15]

export default function AudioBars({
  progress = 0,
  isActive = false,
  liveLevel = 0,
  className = '',
}: AudioBarsProps) {
  const normalizedProgress = Math.max(0, Math.min(progress, 1))
  const activeBars = Math.max(1, Math.round(normalizedProgress * BAR_HEIGHTS.length))
  const liveBoost = Math.max(0, Math.min(liveLevel, 1))

  return (
    <div className={`flex h-8 items-end gap-1 ${className}`}>
      {BAR_HEIGHTS.map((height, index) => {
        const isPlayed = index < activeBars
        const dynamicHeight = isActive
          ? Math.max(8, Math.round(height + liveBoost * 18 - (index % 3) * 2))
          : height

        return (
          <span
            key={`${height}-${index}`}
            className={`block w-1 rounded-full transition-all duration-150 ${
              isPlayed ? 'bg-primary' : 'bg-white/20'
            } ${isActive ? 'opacity-100' : 'opacity-80'}`}
            style={{ height: `${dynamicHeight}px` }}
          />
        )
      })}
    </div>
  )
}

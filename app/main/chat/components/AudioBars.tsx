'use client'

type AudioBarsProps = {
  progress?: number
  isActive?: boolean
  liveLevel?: number
  className?: string
  barClassName?: string
  activeBarClassName?: string
  inactiveBarClassName?: string
}

const BAR_HEIGHTS = [8, 14, 11, 18, 10, 22, 13, 19, 9, 16, 12, 20, 11, 17, 8, 15]

export default function AudioBars({
  progress = 0,
  isActive = false,
  liveLevel = 0,
  className = '',
  barClassName = 'w-[3px]',
  activeBarClassName = 'bg-primary',
  inactiveBarClassName = 'bg-white/20',
}: AudioBarsProps) {
  const normalizedProgress = Math.max(0, Math.min(progress, 1))
  const activeBars =
    normalizedProgress > 0
      ? Math.max(1, Math.round(normalizedProgress * BAR_HEIGHTS.length))
      : isActive
        ? 1
        : 0
  const liveBoost = Math.max(0, Math.min(liveLevel, 1))

  return (
    <div className={`flex h-8 items-end gap-[3px] ${className}`}>
      {BAR_HEIGHTS.map((height, index) => {
        const isPlayed = index < activeBars
        const dynamicHeight = isActive
          ? Math.max(8, Math.round(height + liveBoost * 18 - (index % 3) * 2))
          : height

        return (
          <span
            key={`${height}-${index}`}
            className={`block shrink-0 rounded-full transition-[height,opacity,background-color] duration-150 ${
              isPlayed ? activeBarClassName : inactiveBarClassName
            } ${barClassName} ${isActive ? 'opacity-100' : 'opacity-85'}`}
            style={{ height: `${dynamicHeight}px` }}
          />
        )
      })}
    </div>
  )
}

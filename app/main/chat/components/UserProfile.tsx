
interface UserProfileProps {
  online?: boolean
  avatarUrl?: string | null
  username: string
  className?: string
  imageLoading?: 'eager' | 'lazy'
}

function getInitials(username: string) {
  const parts = username
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (parts.length === 0) return 'US'
  if (parts.length === 1) return parts[0].slice(0, 2)
  return `${parts[0][0]}${parts[1][0]}`
}

export default function UserProfile({
  online,
  avatarUrl,
  username,
  className = '',
  imageLoading = 'eager',
}: UserProfileProps) {
  const iniciaisContato = getInitials(username).toUpperCase()
  return (
    <div
      id="user-photo"
      className={`relative flex h-[52px] w-[52px] shrink-0 items-center justify-center overflow-hidden rounded-full border-1 border-border bg-background text-sm font-medium uppercase ${className}`}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={username}
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
          loading={imageLoading}
          decoding="async"
        />
      ) : (
        iniciaisContato
      )}
    </div>
  )
}

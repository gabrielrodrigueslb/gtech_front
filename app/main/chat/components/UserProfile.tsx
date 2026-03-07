
interface UserProfileProps {
  online?: boolean
  avatarUrl?: string | null
  username: string
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

export default function UserProfile({ online, avatarUrl, username }: UserProfileProps) {
  const iniciaisContato = getInitials(username).toUpperCase()
  return (
    <div
      id="user-photo"
      className="shrink-0 w-[52px] h-[52px] bg-background rounded-full relative items-center justify-center flex font-medium text-sm uppercase border-border border-1 overflow-hidden"
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={username}
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        iniciaisContato
      )}
      {online && (
        <span className="size-4 block right-0 bottom-0 border-2 rounded-full bg-green-500 absolute animate-pulse animation-duration-1.7" />
      )}
    </div>
  )
}

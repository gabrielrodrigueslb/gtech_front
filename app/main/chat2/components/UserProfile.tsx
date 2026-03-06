
interface UserProfileProps {
  online?: boolean;
  username: string
}

export default function UserProfile({ online, username }: UserProfileProps) {

    
  const iniciaisContato = username.slice(0,2)
  return (
    <div
      id="user-photo"
      className="w-[52px] h-[52px] bg-background rounded-full relative items-center justify-center flex font-medium text-sm uppercase border-border border-1"
    >
      {iniciaisContato || 'US'}
      {online && (
        <span className="size-4 block right-0 bottom-0 border-2 rounded-full bg-green-500 absolute animate-pulse animation-duration-1.7" />
      )}
    </div>
  );
}

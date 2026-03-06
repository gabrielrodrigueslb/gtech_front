import UserProfile from './UserProfile';

interface ContactProps{
    lastMessage: string
    nomeContato: string
    hora: string
    online:boolean
    noRead: boolean
    isActive:boolean
}

export default function ContactCard({lastMessage, nomeContato, hora, online, isActive, noRead}:ContactProps) {

  return (
    <li className={`${isActive && 'bg-white/10'} w-full flex items-center px-3 py-4 gap-2`}>
      <UserProfile online={online} username='Gabriel'/>
      <div className="flex flex-col flex-1 gap-1 font-light overflow-hidden">
        <span className="flex justify-between items-center">
          <h4 className="font-medium">{nomeContato || 'Contato'}</h4>
          <p className="text-xs opacity-50">{hora || '00:00'}</p>
        </span>

        <span className="flex justify-between items-center gap-3">
          <p className="opacity-50 text-sm truncate">
            {lastMessage || ''}
          </p>

          {noRead && (
            <div className=" flex max-w-10 max-h-10 items-center justify-center w-full rounded-full text-sm bg-primary">
              5
            </div>
          )}
        </span>
      </div>
    </li>
  );
}

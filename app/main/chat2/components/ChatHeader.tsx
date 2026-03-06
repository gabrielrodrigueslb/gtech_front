
import { ArrowLeftRight, EllipsisVertical, MessageSquareX } from 'lucide-react';
import UserProfile from './UserProfile';

export default function ChatHeader() {
  return (
    <header className="w-full bg-card py-3 px-4 flex justify-between items-center">
      <div className="flex items-center gap-3">
        <UserProfile online={true} username='Gabriel'/>
        <div className="flex flex-col flex-1 gap-1 font-light overflow-hidden max-w-xs">
          <span className="flex flex-col gap-1">
            <h4 className="font-medium truncate">Gabriel</h4>
            <p className="text-xs opacity-50">Digitando...</p>
          </span>
        </div>
      </div>

      <div>
        <ul className='flex gap-2 items-center'>
            <li className='p-1 rounded-sm transition-all cursor-pointer hover:bg-white/20'><EllipsisVertical size={20}/></li>
            <li className='p-1 rounded-sm transition-all cursor-pointer hover:bg-white/20'><ArrowLeftRight size={20}/></li>

            <button className='flex gap-2 text-sm p-3 bg-primary rounded-md ml-2 border-l-border cursor-pointer hover:opacity-80 transition-opacity'><MessageSquareX size={20}/> Encerrar Atendimento</button>


        </ul>
      </div>
    </header>
  );
}

'use client';

import { Search } from 'lucide-react';
import { useState } from 'react';
import ContactList from './components/ContactList';
import ChatHeader from './components/ChatHeader';
import ChatFooter from './components/ChatFooter';
import ChatMessages from './components/ChatMessages';
import NewConversationButton from './components/NewConversationButton';
import { WhatsAppProvider, useWhatsApp } from '@/context/Whatsappcontext';

export default function ChatPage() {
  return (
    <WhatsAppProvider>
      <ChatPageInner />
    </WhatsAppProvider>
  );
}

function ChatPageInner() {
  const { conversations, currentUserId } = useWhatsApp();
  const [queueFilter, setQueueFilter] = useState<'mine' | 'unassigned'>('mine');
  const [searchQuery, setSearchQuery] = useState('');
  const myCount = conversations.filter(
    (conversation) => conversation.assignedUserId === currentUserId,
  ).length;
  const unassignedCount = conversations.filter(
    (conversation) => !conversation.assignedUserId,
  ).length;

  return (
    <main className="bg-card max-w-screen max-h-screen h-full flex rounded-2xl overflow-hidden">
      <section
        id="contact-list"
        className="w-[360px] shrink-0 h-full bg-card flex flex-col overflow-hidden border-border/50 border-r"
      >
        <div className="mx-3 my-4 grid grid-cols-2 gap-2 ">
          <button
            type="button"
            onClick={() => setQueueFilter('mine')}
            className={`rounded-2xl p-2 text-xs font-medium transition cursor-pointer ${
              queueFilter === 'mine'
                ? 'bg-primary text-white'
                : 'border border-white/10 bg-background/40 text-white/70 hover:bg-white/5'
            }`}
          >
            Atendimentos ({myCount})
          </button>
          <button
            type="button"
            onClick={() => setQueueFilter('unassigned')}
            className={`rounded-2xl p-2 text-xs font-medium transition cursor-pointer ${
              queueFilter === 'unassigned'
                ? 'bg-primary text-white'
                : 'border border-white/10 bg-background/40 text-white/70 hover:bg-white/5'
            }`}
          >
            Fila ({unassignedCount})
          </button>
        </div>
        <div className='flex mb-4 mx-3 gap-3'>
          

        <div className="flex bg-background px-4 py-2 rounded-2xl gap-2 items-center flex-1">
          <Search className="cursor-pointer" />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full text-sm focus:outline-none"
            type="text"
            placeholder="Pesquise ou inicie um novo chat"
          />
        </div>
        <NewConversationButton />
        </div>

        

        

        <ContactList filter={queueFilter} searchQuery={searchQuery} />
      </section>

      <section
        id="chat"
        className="flex-1 h-full bg-card-foreground max-w-screen justify-between max-h-screen flex flex-col overflow-hidden"
      >
        <ChatHeader />
        <ChatMessages />
        <ChatFooter />
      </section>
    </main>
  );
}

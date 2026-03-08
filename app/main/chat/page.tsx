'use client';

import { Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import ContactList from './components/ContactList';
import ChatHeader from './components/ChatHeader';
import ChatFooter from './components/ChatFooter';
import ChatMessages from './components/ChatMessages';
import NewConversationButton from './components/NewConversationButton';
import { useAppShell } from '@/context/app-shell-context';
import { WhatsAppProvider, useWhatsApp } from '@/context/Whatsappcontext';
import { useIsMobile } from '@/hooks/use-mobile';

export default function ChatPage() {
  return (
    <WhatsAppProvider>
      <ChatPageInner />
    </WhatsAppProvider>
  );
}

function ChatPageInner() {
  const { setHideMobileNav } = useAppShell();
  const { conversations, currentUserId, activeConversationId } = useWhatsApp();
  const isMobile = useIsMobile();
  const [queueFilter, setQueueFilter] = useState<'mine' | 'unassigned'>('mine');
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
  const previousActiveConversationRef = useRef<string | null>(null);
  const myCount = conversations.filter(
    (conversation) => conversation.assignedUserId === currentUserId,
  ).length;
  const unassignedCount = conversations.filter(
    (conversation) => !conversation.assignedUserId,
  ).length;

  useEffect(() => {
    if (!isMobile) {
      setMobileView('chat');
      previousActiveConversationRef.current = activeConversationId;
      return;
    }

    if (!activeConversationId) {
      setMobileView('list');
      previousActiveConversationRef.current = null;
      return;
    }

    if (previousActiveConversationRef.current !== activeConversationId) {
      setMobileView('chat');
    }

    previousActiveConversationRef.current = activeConversationId;
  }, [activeConversationId, isMobile]);

  const showMobileChat = isMobile && mobileView === 'chat' && !!activeConversationId;
  const showMobileList = !isMobile || mobileView === 'list' || !activeConversationId;

  useEffect(() => {
    setHideMobileNav(showMobileChat)
    return () => setHideMobileNav(false)
  }, [setHideMobileNav, showMobileChat])

  return (
    <main className="-mx-4 -mt-4 flex h-[calc(100%+1rem)] w-[calc(100%+2rem)] max-h-screen max-w-none overflow-hidden bg-card md:mx-0 md:mt-0 md:h-full md:w-auto md:max-w-screen md:rounded-2xl">
      <section
        id="contact-list"
        className={`h-full w-full shrink-0 flex-col overflow-hidden bg-card md:flex md:w-[360px] md:border-r md:border-border/50 ${
          showMobileList ? 'flex' : 'hidden'
        }`}
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

        

        

        <ContactList
          filter={queueFilter}
          searchQuery={searchQuery}
          onConversationOpen={() => setMobileView('chat')}
        />
      </section>

      <section
        id="chat"
        className={`h-full max-h-screen max-w-screen flex-1 flex-col justify-between overflow-hidden bg-card-foreground ${
          showMobileChat || !isMobile ? 'flex' : 'hidden'
        }`}
      >
        <ChatHeader
          showBackButton={isMobile}
          onBack={() => setMobileView('list')}
        />
        <ChatMessages />
        <ChatFooter />
      </section>
    </main>
  );
}

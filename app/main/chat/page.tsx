import { CirclePlus, Search } from 'lucide-react'
import ContactList from './components/ContactList'
import ChatHeader from './components/ChatHeader'
import ChatFooter from './components/ChatFooter'
import ChatMessages from './components/ChatMessages'
import { WhatsAppProvider } from '@/context/Whatsappcontext'

export default function ChatPage() {
  return (
    <WhatsAppProvider>
      <ChatPageInner />
    </WhatsAppProvider>
  )
}

function ChatPageInner() {
  return (
    <main className="bg-card max-w-screen max-h-screen h-full flex rounded-2xl overflow-hidden">
      <section
        id="contact-list"
        className="w-[320px] shrink-0 h-full bg-card flex flex-col overflow-hidden border-border/50 border-r"
      >
        <div className="flex mt-3 mx-3 bg-background px-4 py-2 rounded-2xl gap-2 items-center">
          <Search className="cursor-pointer" />
          <input
            className="w-full text-sm focus:outline-none"
            type="text"
            placeholder="Pesquise ou inicie um novo chat"
          />
        </div>

        <button className="bg-primary m-3 font-semibold flex gap-2 items-center justify-center py-3 rounded-xl cursor-pointer hover:opacity-80 transition-opacity">
          <CirclePlus /> Novo Atendimento
        </button>

        <ContactList />
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
  )
}

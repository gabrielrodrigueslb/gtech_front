import { CheckCheck, Search } from 'lucide-react';
import ContactList from './components/ContactList';
import ChatHeader from './components/ChatHeader';
import ChatFooter from './components/ChatFooter';
import UserProfile from './components/UserProfile';

export default function page() {
  return (
    <>
      <main className="bg-card max-w-screen max-h-screen h-full flex rounded-2xl overflow-hidden">
        <section
          id="contact-list"
          className="w-[320px] shrink-0 h-full bg-card flex flex-col overflow-hidden border-border/50 border-r"
        >
          <div className="flex m-3 bg-background px-4 py-2 rounded-2xl gap-2 items-center">
            <Search className="cursor-pointer" />
            <input
              className="w-full text-sm"
              type="text"
              placeholder="Pesquise ou inicie um novo chat"
            />
          </div>

          <ContactList />

          {/* lista de contatos */}
        </section>

        <section
          id="chat"
          className="flex-1 h-full bg-card-foreground max-w-screen justify-between max-h-screen flex flex-col overflow-hidden"
        >
          <ChatHeader />
          <div className="messages flex-1 overflow-x-hidden overflow-y-auto flex p-6 items-start flex-col gap-3">
            <span className="py-1 px-4 self-center-safe bg-card rounded-full text-xs font-semibold">
              Hoje
            </span>
            <div className="message-card flex gap-2">
              <UserProfile username="Gabriel" />
              <div className="message flex flex-col gap-1.5">
                <span className="rounded-md rounded-tl-none bg-card p-5 max-w-md overflow-hidden w-full">
                  <p className="text-sm break-words">
                    Esse é um exemplo de mensage
                  </p>
                </span>
                <p className="text-xs  opacity-70">19:00</p>
              </div>
            </div>
            <div className="message-card flex flex-row-reverse gap-2 self-end-safe">
              <UserProfile username="Gabriel" />
              <div className="message flex flex-col gap-1.5">
                <span className="rounded-md rounded-tr-none bg-primary p-5 max-w-md overflow-hidden w-full">
                  <p className="text-sm break-words">
                    Esse é um exemplo de mensagem sua
                  </p>
                </span>
                <span className="flex self-end-safe items-center gap-1">
                  <p className="text-xs  opacity-70">19:00</p>
                  <CheckCheck className="text-primary/80" size={12} />
                </span>
              </div>
            </div>
          </div>
          <ChatFooter />
        </section>
      </main>
    </>
  );
}

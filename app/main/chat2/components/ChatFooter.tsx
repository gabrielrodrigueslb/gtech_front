'use client';
import { Mic, Plus, SendHorizontal, SmilePlus } from 'lucide-react';
import { useState } from 'react';

export default function ChatFooter() {
  const [value, setValue] = useState(false);

  function handleChange(input:any) {
    const text = input.target.value;
    setValue(text.trim().length > 0);
  }

  return (
    <footer className="w-full bg-card flex px-3 py-2 gap-4 items-center">
      <span className="flex gap-2">
        <button className="p-1 rounded-sm transition-all cursor-pointer hover:bg-white/20">
          <Plus />
        </button>
        <button className="p-1 rounded-sm transition-all cursor-pointer hover:bg-white/20">
          <SmilePlus />
        </button>
      </span>
      <input
        id="messageInput"
        onChange={handleChange}
        type="text"
        className="bg-white/5 rounded-md flex-1 px-6 py-4 text-sm border focus:outline-none"
        placeholder="Escreva sua mensagem"
        alt="Campo de mensagem"
      />
      <button className="p-1 size-12 flex items-center justify-center rounded-full transition-all cursor-pointer hover:bg-white/20 bg-primary">
        {value == true ? <SendHorizontal /> : <Mic />}
      </button>
    </footer>
  );
}

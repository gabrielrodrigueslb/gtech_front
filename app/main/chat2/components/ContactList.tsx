import React from 'react';
import ContactCard from './ContactCard';

export default function ContactList() {
  return (
    <ul className="flex-col flex w-full h-full  overflow-y-auto">
      <ContactCard
        lastMessage="Teste mensagem"
        nomeContato="Gabriel"
        hora="18:00"
        isActive={true}
        online={true}
        noRead={false}
      />
      <ContactCard
        noRead={true}
        lastMessage="Teste mensagem 2"
        nomeContato="João"
        hora="19:00"
        online={false}
        isActive={false}
      />
      <ContactCard
      noRead={false}
      lastMessage="Teste mensagem 3"
        nomeContato="Maria"
        hora="14:00"
        online={false}
        isActive={false}
      />
    </ul>
  );
}

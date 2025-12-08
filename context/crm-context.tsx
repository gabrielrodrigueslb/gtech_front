'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

export interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  status: 'lead' | 'prospect' | 'customer' | 'inactive';
  avatar?: string;
  createdAt: Date;
  notes?: string;
}

export interface Deal {
  id: string;
  title: string;
  value: number;
  stage: string;
  funnelId: string;
  contactId: string;
  probability: number;
  expectedClose: Date;
  createdAt: Date;
  description?: string;
  notes?: string;
  ownerId?: string;
  owner?: { id: string; name: string };
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate: Date;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in-progress' | 'completed';
  contactId?: string;
  dealId?: string;
  createdAt: Date;
}

export interface Stage {
  id: string;
  name: string;
  color: string;
  order: number;
}

export interface Funnel {
  id: string;
  name: string;
  stages: Stage[];
  createdAt: Date;
}

// Interfaces atualizadas para permitir IDs externos (do backend)
interface CRMContextType {
  contacts: Contact[];
  deals: Deal[];
  tasks: Task[];
  funnels: Funnel[];

  // Mudamos de Omit<T, "id"> para Partial<T> para permitir passar o ID se ele já existir
  addContact: (contact: Partial<Contact> & { name: string }) => void;
  updateContact: (id: string, contact: Partial<Contact>) => void;
  deleteContact: (id: string) => void;

  addDeal: (deal: Partial<Deal> & { title: string }) => void;
  updateDeal: (id: string, deal: Partial<Deal>) => void;
  deleteDeal: (id: string) => void;
  moveDeal: (id: string, stageId: string, funnelId: string) => void;

  addTask: (task: Partial<Task> & { title: string }) => void;
  updateTask: (id: string, task: Partial<Task>) => void;
  deleteTask: (id: string) => void;

  addFunnel: (funnel: Partial<Funnel> & { name: string }) => void;
  updateFunnel: (id: string, funnel: Partial<Funnel>) => void;
  deleteFunnel: (id: string) => void;
}

const CRMContext = createContext<CRMContextType | undefined>(undefined);

// Iniciando vazios para que apenas os dados do Backend apareçam
const initialFunnels: Funnel[] = [];
const initialContacts: Contact[] = [];
const initialDeals: Deal[] = [];
const initialTasks: Task[] = [];

export function CRMProvider({ children }: { children: ReactNode }) {
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [deals, setDeals] = useState<Deal[]>(initialDeals);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [funnels, setFunnels] = useState<Funnel[]>(initialFunnels);

  // --- FUNÇÕES DE ADICIONAR COM VERIFICAÇÃO DE ID ---

  const addContact = (contactData: Partial<Contact> & { name: string }) => {
    const newContact = {
      ...contactData,
      id: contactData.id || Date.now().toString(),
      createdAt: contactData.createdAt || new Date(),
      status: contactData.status || 'lead',
      email: contactData.email || '',
      phone: contactData.phone || '',
      company: contactData.company || '',
    } as Contact;

    // Evita duplicidade se o ID já existir no estado
    if (!contacts.some((c) => c.id === newContact.id)) {
      setContacts((prev) => [...prev, newContact]);
    }
  };

  const updateContact = (id: string, data: Partial<Contact>) => {
    setContacts(contacts.map((c) => (c.id === id ? { ...c, ...data } : c)));
  };

  const deleteContact = (id: string) => {
    setContacts(contacts.filter((c) => c.id !== id));
  };

  const addDeal = (dealData: Partial<Deal> & { title: string }) => {
    const newDeal = {
      ...dealData,
      id: dealData.id || Date.now().toString(),
      createdAt: dealData.createdAt || new Date(),
      value: dealData.value || 0,
      stage: dealData.stage || 'lead',
      funnelId: dealData.funnelId || '1',
      contactId: dealData.contactId || '',
      probability: dealData.probability || 0,
      expectedClose: dealData.expectedClose || new Date(),
      // Garante que o owner venha junto se existir
      ownerId: dealData.ownerId,
      owner: dealData.owner,
    } as Deal;

    // --- CORREÇÃO AQUI ---
    // Usamos 'setDeals((prev) => ...)' para acessar o valor mais recente do estado
    // Isso impede duplicatas mesmo se o useEffect rodar duas vezes rápido
    setDeals((prev) => {
      // Se já existe um deal com esse ID, retornamos a lista sem alterações
      if (prev.some((d) => d.id === newDeal.id)) {
        return prev;
      }
      // Se não existe, adicionamos o novo
      return [...prev, newDeal];
    });
  };

  const updateDeal = (id: string, data: Partial<Deal>) => {
    setDeals(deals.map((d) => (d.id === id ? { ...d, ...data } : d)));
  };

  const deleteDeal = (id: string) => {
    setDeals(deals.filter((d) => d.id !== id));
  };

  const moveDeal = (id: string, stageId: string, funnelId: string) => {
    setDeals(
      deals.map((d) => (d.id === id ? { ...d, stage: stageId, funnelId } : d)),
    );
  };

  const addTask = (taskData: Partial<Task> & { title: string }) => {
    const newTask = {
      ...taskData,
      id: taskData.id || Date.now().toString(),
      createdAt: taskData.createdAt || new Date(),
      priority: taskData.priority || 'medium',
      status: taskData.status || 'pending',
      dueDate: taskData.dueDate || new Date(),
    } as Task;

    if (!tasks.some((t) => t.id === newTask.id)) {
      setTasks((prev) => [...prev, newTask]);
    }
  };

  const updateTask = (id: string, data: Partial<Task>) => {
    setTasks(tasks.map((t) => (t.id === id ? { ...t, ...data } : t)));
  };

  const deleteTask = (id: string) => {
    setTasks(tasks.filter((t) => t.id !== id));
  };

  const addFunnel = (funnelData: Partial<Funnel> & { name: string }) => {
    const newFunnel = {
      ...funnelData,
      id: funnelData.id || Date.now().toString(),
      createdAt: funnelData.createdAt || new Date(),
      stages: funnelData.stages || [],
    } as Funnel;

    // A MUDANÇA ESTÁ AQUI: Verificamos dentro do callback 'prev'
    setFunnels((prev) => {
      // Se já existir um funil com esse ID na lista, retornamos a lista sem alterações
      if (prev.some((f) => f.id === newFunnel.id)) {
        return prev;
      }
      // Se não existir, adicionamos o novo
      return [...prev, newFunnel];
    });
  };

  const updateFunnel = (id: string, data: Partial<Funnel>) => {
    setFunnels(funnels.map((f) => (f.id === id ? { ...f, ...data } : f)));
  };

  const deleteFunnel = (id: string) => {
    setFunnels(funnels.filter((f) => f.id !== id));
  };

  return (
    <CRMContext.Provider
      value={{
        contacts,
        deals,
        tasks,
        funnels,
        addContact,
        updateContact,
        deleteContact,
        addDeal,
        updateDeal,
        deleteDeal,
        moveDeal,
        addTask,
        updateTask,
        deleteTask,
        addFunnel,
        updateFunnel,
        deleteFunnel,
      }}
    >
      {children}
    </CRMContext.Provider>
  );
}

export function useCRM() {
  const context = useContext(CRMContext);
  if (!context) throw new Error('useCRM must be used within CRMProvider');
  return context;
}

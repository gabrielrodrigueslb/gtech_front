import { api } from './api';

export interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  segment?: string;
  status?: "lead" | "prospect" | "customer" | "inactive";
  createdAt?: string;
  notes?: string;
}

// Buscar todos os contatos
export async function getContacts() {
  const { data } = await api.get('/contacts');
  return data;
}

// Criar contato
export async function createContact(data: Partial<Contact>) {
  const { data: response } = await api.post('/contacts/createContact', data);
  return response;
}

// Atualizar contato
export async function updateContact(id: string, data: Partial<Contact>) {
  const { data: response } = await api.put(`/contacts/${id}`, data);
  return response;
}

// Deletar contato
export async function deleteContact(id: string) {
  await api.delete(`/contacts/${id}`);
}
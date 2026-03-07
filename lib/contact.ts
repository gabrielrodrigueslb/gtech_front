import { api } from './api';

export interface Contact {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  segment?: string;
  status?: "lead" | "prospect" | "customer" | "inactive";
  createdAt?: string;
  notes?: string | null;
  tags?: string[];
}

// Buscar todos os contatos
export async function getContacts() {
  const { data } = await api.get('/contacts');
  return data;
}

export async function getContactById(id: string) {
  const { data } = await api.get(`/contacts/${id}`);
  return data as Contact;
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

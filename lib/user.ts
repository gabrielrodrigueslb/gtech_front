import { api } from './api';

export interface User {
  id: string;
  name: string;
  email: string;
}

// Busca todos os usuários para preencher o select de responsáveis
export async function getUsers() {
  const { data } = await api.get('/user/getUsers');
  return data;
}
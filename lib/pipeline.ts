import { api } from './api';

export interface Pipeline {
  id: string;
  name: string;
  stages?: any[]; // Adicionamos stages opcional na tipagem
}

// Buscar todos os pipelines
export async function getPipelines() {
  const { data } = await api.get('/crm/getPipelines');
  return data;
}

// ATUALIZADO: Agora aceita stages opcional
export async function createPipeline(name: string, stages?: { name: string, color?: string }[]) {
  // Enviamos o objeto completo para o backend
  const { data } = await api.post('/crm/createPipeline', { name, stages });
  return data;
}

export async function updatePipeline(id: string, name: string, funnelStages: { id?: string; name: string; color: string; }[]) {
  const { data } = await api.put(`/crm/updatePipeline/${id}`, { name });
  return data;
}

export async function deletePipeline(id: string) {
  const { data } = await api.delete(`/crm/deletePipeline/${id}`);
  return data;
}
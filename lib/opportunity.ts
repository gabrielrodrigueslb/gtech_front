import { api } from './api';

export interface Opportunity {
  id: string;
  title: string;
  description?: string;
  value: number;
  amount?: number;
  probability: number;
  clientRole?: string;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  enderecoCliente?: string;
  redesSocial1?: string;
  redesSocial2?: string;
  linksExtras?: string[];
  stageId?: string;
  stage?: { id: string; name: string; color: string };
  pipelineId: string;
  contactNumber?: string;
  website?: string;
  address?: string;
  contactId?: string;
  contacts?: { id: string; name: string }[];

  // --- NOVOS CAMPOS ADICIONADOS ---
  ownerId?: string; // ID do responsável
  owner?: { id: string; name: string }; // Objeto para exibir o avatar
  // --------------------------------

  expectedClose?: string;
  dueDate?: string;
  createdAt?: string | Date;
}

// Buscar oportunidades por Pipeline (Funil)
export async function getOpportunities(pipelineId: string) {
  const { data } = await api.get(`/opportunities/pipeline/${pipelineId}`);
  return data;
}

// Criar nova oportunidade
export async function createOpportunity(data: {
  title: string;
  description?: string;
  amount: number;
  probability: number;
  pipelineId: string;
  stageId: string;
  contactId?: string;
  clientRole?: string;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  enderecoCliente?: string;
  redesSocial1?: string;
  redesSocial2?: string;
  linksExtras?: string[];
  contactNumber?: string;

  website?: string;
  address?: string;
  dueDate?: string;
  ownerId?: string; // <--- ADICIONADO AQUI TAMBÉM
}) {
  const { data: response } = await api.post(
    '/opportunities/createOpportunity',
    data,
  );
  return response;
}

// Atualizar oportunidade
export async function updateOpportunity(
  id: string,
  data: Partial<Opportunity> & { stageId?: string },
) {
  const { data: response } = await api.put(`/opportunities/${id}`, data);
  return response;
}

// Deletar oportunidade
export async function deleteOpportunity(id: string) {
  await api.delete(`/opportunities/${id}`);
}

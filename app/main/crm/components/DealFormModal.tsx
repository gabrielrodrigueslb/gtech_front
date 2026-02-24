'use client';

import React, { useState, useEffect } from 'react';
import {
  createOpportunity,
  updateOpportunity as updateOpportunityService,
  deleteOpportunity as deleteOpportunityService,
} from '@/lib/opportunity';
import { FaTrash } from 'react-icons/fa';
import { formatPhoneNumber } from '@/lib/utils';
import { useCRM, type Deal } from '@/context/crm-context';
import { type User } from '@/lib/user';
import { type Contact as ContactType } from '@/lib/contact';

type DealFormModalProps = {
  isOpen: boolean;
  onClose: () => void;
  editingDeal: Deal | null;
  activeFunnelId: string | null;
  initialStageId?: string; // ID da primeira etapa (para novos deals)
  users: User[];
  availableContacts: ContactType[];
};

export default function DealFormModal({
  isOpen,
  onClose,
  editingDeal,
  activeFunnelId,
  initialStageId,
  users,
  availableContacts,
}: DealFormModalProps) {
  const { addDeal, updateDeal, deleteDeal } = useCRM();

  // Estado inicial do formulário
  const initialFormState = {
    title: '',
    description: '',
    value: 0,
    contactId: '',
    contactNumber: '',
    website: '',
    address: '',
    clientRole: '',
    clientName: '',
    clientPhone: '',
    clientEmail: '',
    enderecoCliente: '',
    redesSocial1: '',
    redesSocial2: '',
    linksExtras: [] as string[],
    ownerId: '',
    probability: 50,
    expectedClose: new Date().toISOString().split('T')[0],
  };

  const [formData, setFormData] = useState(initialFormState);

  // Efeito para popular ou limpar o formulário ao abrir/fechar ou trocar o deal
  useEffect(() => {
    if (isOpen) {
      if (editingDeal) {
        const rawNumber = editingDeal.contactNumber ?? '';
        setFormData({
          title: editingDeal.title,
          description: editingDeal.description || '',
          value: editingDeal.value,
          contactId: editingDeal.contactId,
          ownerId: editingDeal.ownerId || editingDeal.owner?.id || '',
          probability: editingDeal.probability,
          expectedClose: new Date(editingDeal.expectedClose)
            .toISOString()
            .split('T')[0],
          contactNumber: rawNumber ? formatPhoneNumber(rawNumber) : '',
          website: editingDeal.website ?? '',
          address: editingDeal.address ?? '',
          clientRole: editingDeal.clientRole ?? '',
          clientName: editingDeal.clientName ?? '',
          clientPhone: editingDeal.clientPhone ?? '',
          clientEmail: editingDeal.clientEmail ?? '',
          enderecoCliente: editingDeal.enderecoCliente ?? '',
          redesSocial1: editingDeal.redesSocial1 ?? '',
          redesSocial2: editingDeal.redesSocial2 ?? '',
          linksExtras: editingDeal.linksExtras ?? [],
        });
      } else {
        setFormData(initialFormState);
      }
    }
  }, [isOpen, editingDeal]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!activeFunnelId || (!editingDeal && !initialStageId)) {
      alert('Erro: Funil ou Estágio não identificados.');
      return;
    }

    try {
      if (editingDeal) {
        // --- ATUALIZAR ---
        await updateOpportunityService(editingDeal.id, {
          title: formData.title,
          description: formData.description,
          amount: Number(formData.value),
          probability: Number(formData.probability),
          website: formData.website,
          contactNumber: formData.contactNumber.replace(/\D/g, ''),
          address: formData.address,
          clientRole: formData.clientRole,
          clientName: formData.clientName,
          clientPhone: formData.clientPhone,
          clientEmail: formData.clientEmail,
          enderecoCliente: formData.enderecoCliente,
          redesSocial1: formData.redesSocial1,
          redesSocial2: formData.redesSocial2,
          linksExtras: formData.linksExtras,
          dueDate: formData.expectedClose,
          contactId: formData.contactId,
          ownerId: formData.ownerId,
          stageId: editingDeal.stage,
          pipelineId: editingDeal.funnelId,
        });

        updateDeal(editingDeal.id, {
          title: formData.title,
          description: formData.description,
          value: Number(formData.value),
          probability: Number(formData.probability),
          contactId: formData.contactId,
          website: formData.website,
          contactNumber: formData.contactNumber.replace(/\D/g, ''),
          address: formData.address,
          clientRole: formData.clientRole,
          clientName: formData.clientName,
          clientPhone: formData.clientPhone,
          clientEmail: formData.clientEmail,
          enderecoCliente: formData.enderecoCliente,
          redesSocial1: formData.redesSocial1,
          redesSocial2: formData.redesSocial2,
          linksExtras: formData.linksExtras,
          expectedClose: new Date(formData.expectedClose),
          ownerId: formData.ownerId,
        } as any);
      } else {
        // --- CRIAR ---
        const newOpp = await createOpportunity({
          title: formData.title,
          description: formData.description,
          amount: Number(formData.value),
          probability: Number(formData.probability),
          website: formData.website,
          contactNumber: formData.contactNumber.replace(/\D/g, ''),
          address: formData.address,
          clientRole: formData.clientRole,
          clientName: formData.clientName,
          clientPhone: formData.clientPhone,
          clientEmail: formData.clientEmail,
          enderecoCliente: formData.enderecoCliente,
          redesSocial1: formData.redesSocial1,
          redesSocial2: formData.redesSocial2,
          linksExtras: formData.linksExtras,
          dueDate: formData.expectedClose,
          contactId: formData.contactId,
          ownerId: formData.ownerId,
          stageId: initialStageId!,
          pipelineId: activeFunnelId,
        });

        addDeal({
          id: newOpp.id,
          title: newOpp.title,
          description: newOpp.description,
          value: newOpp.amount,
          probability: newOpp.probability,
          contactId: newOpp.contacts?.[0]?.id || formData.contactId,
          ownerId: newOpp.owner?.id || formData.ownerId,
          website: newOpp.website,
          contactNumber: newOpp.contactNumber,
          address: newOpp.address,
          clientRole: newOpp.clientRole,
          clientName: newOpp.clientName,
          clientPhone: newOpp.clientPhone,
          clientEmail: newOpp.clientEmail,
          enderecoCliente: newOpp.enderecoCliente,
          redesSocial1: newOpp.redesSocial1,
          redesSocial2: newOpp.redesSocial2,
          linksExtras: newOpp.linksExtras,
          stage: newOpp.stageId,
          funnelId: newOpp.pipelineId,
          expectedClose: new Date(newOpp.dueDate),
          createdAt: new Date(),
        } as any);
      }
      onClose();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao salvar oportunidade');
    }
  };

  const handleDelete = async () => {
    if (!editingDeal) return;
    if (!confirm('Tem certeza que deseja excluir esta oportunidade?')) return;
    try {
      await deleteOpportunityService(editingDeal.id);
      deleteDeal(editingDeal.id);
      onClose();
    } catch (error) {
      console.error(error);
      alert('Erro ao excluir.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-xl rounded-2xl shadow-2xl border border-border overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <h2 className="text-xl font-bold">
            {editingDeal ? 'Editar Oportunidade' : 'Nova Oportunidade'}
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground cursor-pointer"
          >
            ✕
          </button>
        </div>
        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-4 max-h-[70vh] overflow-y-auto scrollbar-thin"
        >
          {/* TÍTULO */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-muted-foreground">
              Título da Oportunidade
            </label>
            <input
              type="text"
              className="w-full bg-muted/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              placeholder="Ex: Projeto de Consultoria"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              required
            />
          </div>

          {/* VALOR E PROBABILIDADE */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-muted-foreground">
                Valor (R$)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  R$
                </span>
                <input
                  type="string"
                  className="w-full bg-muted/50 border border-border rounded-xl pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  value={Number(formData.value)}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      value: Number(e.target.value),
                    })
                  }
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-muted-foreground">
                Probabilidade (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                className="w-full bg-muted/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                value={formData.probability}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    probability: Number(e.target.value),
                  })
                }
              />
            </div>
          </div>

          {/* CONTATO E RESPONSÁVEL */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-muted-foreground">
                Contato
              </label>
              <select
                className="w-full bg-muted/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all cursor-pointer"
                value={formData.contactId}
                onChange={(e) =>
                  setFormData({ ...formData, contactId: e.target.value })
                }
              >
                <option value="">Selecione um contato</option>
                {availableContacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-muted-foreground">
                Responsável
              </label>
              <select
                className="w-full bg-muted/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all cursor-pointer"
                value={formData.ownerId}
                onChange={(e) =>
                  setFormData({ ...formData, ownerId: e.target.value })
                }
                required
              >
                <option value="">Selecione um usuário</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* DATA FECHAMENTO */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-muted-foreground">
              Data Prevista de Fechamento
            </label>
            <input
              type="date"
              className="w-full bg-muted/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all cursor-pointer"
              value={formData.expectedClose}
              onChange={(e) =>
                setFormData({ ...formData, expectedClose: e.target.value })
              }
              required
            />
          </div>

          {/* DESCRIÇÃO */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-muted-foreground">
              Descrição
            </label>
            <textarea
              className="w-full bg-muted/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all min-h-[100px] resize-none"
              placeholder="Detalhes sobre a negociação..."
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
            />
          </div>

          {/* DADOS DO CLIENTE */}
          <div className="pt-2 border-t border-border/60">
            <h3 className="text-xs font-bold uppercase text-muted-foreground mb-3">
              Dados do Cliente
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">
                  Nome do Cliente
                </label>
                <input
                  type="text"
                  className="w-full bg-muted/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  value={formData.clientName}
                  onChange={(e) =>
                    setFormData({ ...formData, clientName: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">
                  Cargo do Cliente
                </label>
                <input
                  type="text"
                  className="w-full bg-muted/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  value={formData.clientRole}
                  onChange={(e) =>
                    setFormData({ ...formData, clientRole: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">
                  Telefone do Cliente
                </label>
                <input
                  type="text"
                  className="w-full bg-muted/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  value={formData.clientPhone}
                  onChange={(e) =>
                    setFormData({ ...formData, clientPhone: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">
                  Email do Cliente
                </label>
                <input
                  type="email"
                  className="w-full bg-muted/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  value={formData.clientEmail}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      clientEmail: e.target.value,
                    })
                  }
                />
              </div>
            </div>
            <div className="space-y-2 mt-4">
              <label className="text-xs font-bold uppercase text-muted-foreground">
                Endereço do Cliente
              </label>
              <input
                type="text"
                className="w-full bg-muted/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                value={formData.enderecoCliente}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    enderecoCliente: e.target.value,
                  })
                }
              />
            </div>
          </div>

          {/* REDES SOCIAIS */}
          <div className="pt-2 border-t border-border/60">
            <h3 className="text-xs font-bold uppercase text-muted-foreground mb-3">
              Redes Sociais
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">
                  Rede Social 1
                </label>
                <input
                  type="text"
                  className="w-full bg-muted/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  value={formData.redesSocial1}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      redesSocial1: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">
                  Rede Social 2
                </label>
                <input
                  type="text"
                  className="w-full bg-muted/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  value={formData.redesSocial2}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      redesSocial2: e.target.value,
                    })
                  }
                />
              </div>
            </div>
          </div>

          {/* LINKS EXTRAS */}
          <div className="pt-2 border-t border-border/60">
            <h3 className="text-xs font-bold uppercase text-muted-foreground mb-3">
              Links Úteis
            </h3>
            <textarea
              className="w-full bg-muted/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all min-h-[120px] resize-none"
              placeholder="https://exemplo.com&#10;https://outro-link.com"
              value={formData.linksExtras.join('\n')}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  linksExtras: e.target.value
                    .split('\n')
                    .map((item) => item.trim())
                    .filter(Boolean),
                })
              }
            />
          </div>

          {/* BOTÕES DE AÇÃO */}
          <div className="pt-4 flex items-center gap-3">
            {editingDeal && (
              <button
                type="button"
                onClick={handleDelete}
                className="p-2.5 text-destructive hover:bg-destructive/10 rounded-xl transition-colors cursor-pointer"
                title="Excluir"
              >
                <FaTrash size={18} />
              </button>
            )}
            <button
              type="button"
              className="flex-1 px-6 py-2.5 border border-border rounded-xl font-medium hover:bg-muted transition-all cursor-pointer"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl font-bold hover:opacity-90 transition-all shadow-lg shadow-primary/20 cursor-pointer"
            >
              {editingDeal ? 'Salvar Alterações' : 'Criar Oportunidade'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

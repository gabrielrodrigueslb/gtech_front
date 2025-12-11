'use client';

import type React from 'react';
import { useState, useEffect } from 'react';
import {
  getPipelines,
  createPipeline as createPipelineService,
} from '@/lib/pipeline';
import {
  createOpportunity,
  getOpportunities,
  updateOpportunity as updateOpportunityService,
  deleteOpportunity as deleteOpportunityService,
} from '@/lib/opportunity';
import { getUsers, type User } from '@/lib/user';
import { getContacts, type Contact as ContactType } from '@/lib/contact'; //
import { useCRM, type Deal } from '@/context/crm-context';

export default function Deals() {
  const {
    deals,
    funnels, // Mantemos funnels do contexto para sincronia visual
    addDeal,
    updateDeal,
    deleteDeal,
    moveDeal,
    addFunnel,
  } = useCRM();

  // --- ESTADOS GERAIS ---
  const [activeFunnelId, setActiveFunnelId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [showFunnelModal, setShowFunnelModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);

  // --- DADOS REAIS (VINDOS DA API) ---
  const [users, setUsers] = useState<User[]>([]);
  const [availableContacts, setAvailableContacts] = useState<ContactType[]>([]); // Contatos reais

  // --- DRAG AND DROP (KANBAN CARDS) ---
  const [draggedDeal, setDraggedDeal] = useState<string | null>(null);
  const [dragSource, setDragSource] = useState<{
    stageId: string;
    funnelId: string;
  } | null>(null);

  // --- ESTADOS DO FORMULÁRIO DE OPORTUNIDADE (DEAL) ---
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    value: 0,
    contactId: '',
    ownerId: '',
    probability: 50,
    expectedClose: '',
  });

  // --- ESTADOS DO MODAL DE FUNIL (PIPELINE) ---
  const [funnelName, setFunnelName] = useState('');
  const [funnelStages, setFunnelStages] = useState<
    { name: string; color: string }[]
  >([
    { name: 'Lead', color: '#F59E0B' },
    { name: 'Negociação', color: '#8B5CF6' },
    { name: 'Fechado', color: '#10B981' },
  ]);

  const [draggedStageIndex, setDraggedStageIndex] = useState<number | null>(
    null,
  );
  const [newStageName, setNewStageName] = useState('');
  const [newStageColor, setNewStageColor] = useState('#6366F1');

  const PRESET_COLORS = [
    '#F59E0B',
    '#3B82F6',
    '#10B981',
    '#8B5CF6',
    '#06B6D4',
    '#EC4899',
    '#6366F1',
  ];

  // --------------------------------------------------------
  // 1. CARREGAMENTO INICIAL (PARALELO: FUNIS, USERS, CONTACTS)
  // --------------------------------------------------------
  useEffect(() => {
    async function loadAllData() {
      setIsLoading(true);
      try {
        // Busca tudo de uma vez para performance
        const [funnelsData, usersData, contactsData] = await Promise.all([
          getPipelines(),
          getUsers(),
          getContacts(),
        ]);

        // Define estados locais de dados auxiliares
        setUsers(usersData || []);
        setAvailableContacts(contactsData || []);

        // Processa Funis
        let initialFunnelId = '';
        if (funnelsData && funnelsData.length > 0) {
          console.log('Dados carregados:', { funnels: funnelsData.length, contacts: contactsData?.length });
          
          funnelsData.forEach((pipeline: any) => {
            const exists = funnels.find((f) => f.id === pipeline.id);
            if (!exists) {
              addFunnel({
                id: pipeline.id,
                name: pipeline.name,
                stages: pipeline.stages || [],
              });
            }
          });
          initialFunnelId = funnelsData[0].id;
          setActiveFunnelId(initialFunnelId);
        }

        // Se tivermos um funil, buscamos as oportunidades dele IMEDIATAMENTE
        if (initialFunnelId) {
          const remoteDeals = await getOpportunities(initialFunnelId);
          processRemoteDeals(remoteDeals);
        }

      } catch (error: any) {
        if (
          error.response &&
          (error.response.status === 403 || error.response.status === 401)
        ) {
          return;
        }
        console.error('Erro no carregamento inicial:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --------------------------------------------------------
  // 2. TROCA DE FUNIL (Busca apenas oportunidades)
  // --------------------------------------------------------
  const processRemoteDeals = (remoteDeals: any[]) => {
    remoteDeals.forEach((d: any) => {
      const exists = deals.find((localDeal) => localDeal.id === d.id);
      if (!exists) {
        addDeal({
          id: d.id,
          title: d.title,
          description: d.description,
          value: d.amount || 0,
          probability: d.probability,
          contactId: d.contacts?.[0]?.id || '',
          ownerId: d.owner?.id,
          owner: d.owner,
          stage: d.stageId || d.stage?.id,
          funnelId: d.pipelineId,
          expectedClose: d.dueDate ? new Date(d.dueDate) : new Date(),
          createdAt: new Date(d.createdAt),
        } as any);
      }
    });
  };

  useEffect(() => {
    async function fetchDealsOnTabChange() {
      if (!activeFunnelId || isLoading) return;

      try {
        const remoteDeals = await getOpportunities(activeFunnelId);
        processRemoteDeals(remoteDeals);
      } catch (error) {
        console.error('Erro ao buscar oportunidades:', error);
      }
    }

    fetchDealsOnTabChange();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFunnelId]);

  const activeFunnel = funnels.find((f) => f.id === activeFunnelId);
  const funnelDeals = deals.filter((d) => d.funnelId === activeFunnelId);

  // --------------------------------------------------------
  // HELPER UI
  // --------------------------------------------------------
  const renderUserAvatar = (name: string, size = 'w-6 h-6', textSize = 'text-xs') => {
    const initial = name ? name[0].toUpperCase() : '?';
    return (
      <div className={`${size} bg-amber-400 rounded-full flex items-center justify-center font-bold text-white shrink-0 ${textSize}`} title={name}>
        {initial}
      </div>
    );
  };

  // --------------------------------------------------------
  // MANIPULADORES (HANDLERS)
  // --------------------------------------------------------
  const handleAddStage = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!newStageName.trim()) return;
    setFunnelStages([...funnelStages, { name: newStageName, color: newStageColor }]);
    setNewStageName('');
    setNewStageColor(PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]);
  };

  const handleRemoveStage = (index: number) => {
    const newStages = [...funnelStages];
    newStages.splice(index, 1);
    setFunnelStages(newStages);
  };

  const handleStageDragStart = (index: number) => setDraggedStageIndex(index);
  const handleStageDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleStageDrop = (targetIndex: number) => {
    if (draggedStageIndex === null || draggedStageIndex === targetIndex) return;
    const newStages = [...funnelStages];
    const itemToMove = newStages[draggedStageIndex];
    newStages.splice(draggedStageIndex, 1);
    newStages.splice(targetIndex, 0, itemToMove);
    setFunnelStages(newStages);
    setDraggedStageIndex(null);
  };

  const handleFunnelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!funnelName.trim()) return alert('Nome do funil é obrigatório');
    if (funnelStages.length === 0) return alert('Adicione pelo menos uma etapa');

    try {
      const newPipeline = await createPipelineService(funnelName, funnelStages);
      addFunnel({
        id: newPipeline.id,
        name: newPipeline.name,
        stages: newPipeline.stages,
      });
      setShowFunnelModal(false);
      setFunnelName('');
      setFunnelStages([{ name: 'Lead', color: '#F59E0B' }, { name: 'Fechado', color: '#10B981' }]);
      setActiveFunnelId(newPipeline.id);
      alert('Funil criado com sucesso!');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao criar funil');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentStageId = activeFunnel?.stages[0]?.id;

    if (!activeFunnelId || (!editingDeal && !currentStageId)) {
      alert('Erro: Funil ou Estágio não identificados.');
      return;
    }

    try {
      if (editingDeal) {
        await updateOpportunityService(editingDeal.id, {
          title: formData.title,
          description: formData.description,
          amount: Number(formData.value),
          probability: Number(formData.probability),
          dueDate: formData.expectedClose,
          contactId: formData.contactId,
          ownerId: formData.ownerId,
        });

        const newOwner = users.find((u) => u.id === formData.ownerId);

        updateDeal(editingDeal.id, {
          title: formData.title,
          description: formData.description,
          value: Number(formData.value),
          probability: Number(formData.probability),
          contactId: formData.contactId,
          expectedClose: new Date(formData.expectedClose),
          // @ts-ignore
          ownerId: formData.ownerId,
          owner: newOwner,
        });
      } else {
        const newDeal = await createOpportunity({
          title: formData.title,
          description: formData.description,
          amount: Number(formData.value),
          probability: Number(formData.probability),
          pipelineId: activeFunnelId,
          stageId: currentStageId!,
          contactId: formData.contactId,
          dueDate: formData.expectedClose,
          ownerId: formData.ownerId,
        });

        const ownerObj = users.find((u) => u.id === newDeal.ownerId);

        addDeal({
          id: newDeal.id,
          title: newDeal.title,
          description: newDeal.description,
          value: newDeal.amount,
          probability: newDeal.probability,
          contactId: newDeal.contacts?.[0]?.id || formData.contactId,
          stage: newDeal.stageId || currentStageId,
          funnelId: newDeal.pipelineId,
          expectedClose: new Date(newDeal.dueDate),
          createdAt: new Date(),
          // @ts-ignore
          ownerId: newDeal.ownerId,
          owner: ownerObj || newDeal.owner,
        } as any);
      }
      setShowModal(false);
    } catch (error: any) {
      console.error(error);
      alert(error.response?.data?.error || 'Erro ao salvar oportunidade');
    }
  };

  const handleDragStart = (dealId: string, stageId: string) => {
    setDraggedDeal(dealId);
    setDragSource({ stageId, funnelId: activeFunnelId });
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };
  const handleDrop = async (targetStageId: string) => {
    if (draggedDeal && dragSource) {
      moveDeal(draggedDeal, targetStageId, activeFunnelId);
      try {
        await updateOpportunityService(draggedDeal, { stageId: targetStageId });
      } catch (error) {
        console.error('Erro ao mover card:', error);
      }
      setDraggedDeal(null);
      setDragSource(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir?')) return;
    try {
      await deleteOpportunityService(id);
      deleteDeal(id);
      setShowDetailsModal(false);
      setShowModal(false);
    } catch (error) {
      console.error(error);
      alert('Erro ao excluir.');
    }
  };

  const getStageDeals = (stageId: string) => funnelDeals.filter((d) => d.stage === stageId);
  const getStageTotal = (stageId: string) => getStageDeals(stageId).reduce((acc, d) => acc + d.value, 0);

  const openModal = (deal?: Deal) => {
    if (deal) {
      setEditingDeal(deal);
      setFormData({
        title: deal.title,
        description: deal.description || '',
        value: deal.value,
        contactId: deal.contactId,
        // @ts-ignore
        ownerId: deal.ownerId || deal.owner?.id || '',
        probability: deal.probability,
        expectedClose: new Date(deal.expectedClose).toISOString().split('T')[0],
      });
    } else {
      setEditingDeal(null);
      setFormData({
        title: '',
        description: '',
        value: 0,
        contactId: '',
        ownerId: '',
        probability: 50,
        expectedClose: '',
      });
    }
    setShowModal(true);
  };

  const openDetailsModal = (deal: Deal) => {
    setSelectedDeal(deal);
    setShowDetailsModal(true);
  };

  const openEditModal = (deal: Deal) => {
    openModal(deal);
    setShowDetailsModal(false);
  };

  // --- RENDER ---
  return (
    <div className='w-full'>
      <header className="mb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div><h1 className="text-4xl font-bold mb-2">CRM</h1></div>
        </div>
        <div className="pipeline-buttons flex sm:flex-row flex-col gap-2 justify-between pb-2 w-full">
          <div className="flex gap-2">
            <select
              className="pipeline-options px-4 py-3 bg-(--color-card) text-md border-(--color-border) border-2 rounded-xl cursor-pointer outline-0 font-bold"
              name="Pipelines"
              id="pipelines"
              value={activeFunnelId}
              onChange={(e) => setActiveFunnelId(e.target.value)}
            >
              {funnels.map((funnel) => (
                <option
                  key={funnel.id}
                  value={funnel.id}
                  className="cursor-pointer bg-gray-700"
                >
                  {funnel.name}
                </option>
              ))}
            </select>
            <button onClick={() => setShowFunnelModal(true)} className="new-pipeline px-4 py-2 rounded-lg font-medium bg-secondary text-foreground hover:bg-muted transition-all whitespace-nowrap">
              + Novo Funil
            </button>
          </div>
          <button className="btn btn-primary whitespace-nowrap" onClick={() => openModal()}>
            + Nova Oportunidade
          </button>
        </div>
      </header>

      {/* --- KANBAN BOARD --- */}
      {isLoading && (!funnels || funnels.length === 0) ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-2 text-muted-foreground">Carregando CRM...</span>
        </div>
      ) : activeFunnel ? (
        <div className="flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-260px)]">
          {activeFunnel.stages.map((stage) => {
            const stageDealsList = getStageDeals(stage.id);
            const stageTotal = getStageTotal(stage.id);
            return (
              <div key={stage.id} className="kanban-column shrink-0 w-80 flex flex-col"
                onDragOver={handleDragOver} onDrop={() => handleDrop(stage.id)}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                    <h3 className="font-semibold">{stage.name}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-background text-muted-foreground">{stageDealsList.length}</span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-4">R$ {stageTotal.toLocaleString()}</p>
                <div className="flex flex-col gap-3 overflow-y-auto pr-2 pb-10 flex-1">
                  {stageDealsList.map((deal) => {
                    // USA O AVAILABLE CONTACTS (API) AO INVÉS DO CONTEXTO ANTIGO
                    const contact = availableContacts.find((c) => c.id === deal.contactId);
                    // @ts-ignore
                    const ownerName = deal.owner?.name;

                    return (
                      <div key={deal.id} className={`kanban-card group ${draggedDeal === deal.id ? 'opacity-50' : ''}`}
                        draggable onDragStart={() => handleDragStart(deal.id, stage.id)} onClick={() => openDetailsModal(deal)}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-medium text-sm line-clamp-2 flex-1">{deal.title}</h4>
                          {ownerName && <div className="ml-2">{renderUserAvatar(ownerName, 'w-6 h-6', 'text-[10px]')}</div>}
                        </div>
                        <p className="text-lg font-bold mb-3" style={{ color: stage.color }}>R$ {deal.value.toLocaleString()}</p>
                        <div className="flex items-center justify-between text-xs mb-3 text-muted-foreground">
                          <span className="truncate">{contact?.name || 'Sem contato'}</span>
                          <span className="font-medium">{deal.probability}%</span>
                        </div>
                        <div className="progress-bar">
                          <div className="progress-fill" style={{ width: `${deal.probability}%`, backgroundColor: stage.color }} />
                        </div>
                        {deal.description && <p className="text-xs text-muted-foreground mt-2 line-clamp-1">{deal.description}</p>}
                      </div>
                    );
                  })}
                  {stageDealsList.length === 0 && (
                    <div className="flex items-center justify-center h-24 rounded-lg border-2 border-dashed border-border text-muted-foreground text-sm">Arraste aqui</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex justify-center items-center h-64 text-muted-foreground">Nenhum funil encontrado. Crie um para começar.</div>
      )}

      {/* --- MODAL DETALHES --- */}
      {showDetailsModal && selectedDeal && (
        <div className="modal-overlay" onClick={() => setShowDetailsModal(false)}>
          <div className="modal max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold">{selectedDeal.title}</h2>
                <p className="text-sm text-muted-foreground mt-1">{activeFunnel?.stages.find((s) => s.id === selectedDeal.stage)?.name || 'Sem estágio'}</p>
              </div>
              <button className="text-muted-foreground hover:text-foreground transition-colors text-2xl select-none cursor-pointer" onClick={() => setShowDetailsModal(false)}>✕</button>
            </div>
            <div className="space-y-6">
              {/* @ts-ignore */}
              {selectedDeal.owner && (
                <div className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg border border-border">
                  {/* @ts-ignore */}
                  {renderUserAvatar(selectedDeal.owner.name, 'w-8 h-8', 'text-sm')}
                  <div>
                    <p className="text-xs text-muted-foreground font-bold uppercase">Responsável</p>
                    {/* @ts-ignore */}
                    <p className="text-sm font-medium">{selectedDeal.owner.name}</p>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-secondary p-4 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1 font-medium">VALOR</p>
                  <p className="text-2xl font-bold">R$ {selectedDeal.value.toLocaleString()}</p>
                </div>
                <div className="bg-secondary p-4 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1 font-medium">PROBABILIDADE</p>
                  <div className="flex items-center gap-2"><p className="text-2xl font-bold">{selectedDeal.probability}%</p></div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-2 font-medium">CONTATO</p>
                  <p className="text-sm font-medium">{availableContacts.find((c) => c.id === selectedDeal.contactId)?.name || 'Sem contato'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2 font-medium">PREVISÃO</p>
                  <p className="text-sm font-medium">{new Date(selectedDeal.expectedClose).toLocaleDateString('pt-BR')}</p>
                </div>
              </div>
              {selectedDeal.description && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2 font-medium">DESCRIÇÃO</p>
                  <p className="text-sm text-foreground bg-secondary p-3 rounded-lg">{selectedDeal.description}</p>
                </div>
              )}
              <div className="flex gap-3 pt-4 border-t">
                <button className="btn btn-secondary flex-1" onClick={() => setShowDetailsModal(false)}>Fechar</button>
                <button className="btn btn-primary flex-1" onClick={() => openEditModal(selectedDeal)}>Editar</button>
                <button className="btn btn-ghost text-destructive" onClick={() => handleDelete(selectedDeal.id)}>Excluir</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL EDITAR/CRIAR OPORTUNIDADE --- */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">{editingDeal ? 'Editar Oportunidade' : 'Nova Oportunidade'}</h2>
              {editingDeal && <button className="btn btn-ghost text-destructive" onClick={() => handleDelete(editingDeal.id)}>Excluir</button>}
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div><label className="block text-sm font-medium mb-2">Título</label><input type="text" className="input" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} required /></div>
              <div><label className="block text-sm font-medium mb-2">Descrição</label><textarea className="input" rows={3} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-2">Valor (R$)</label><input type="number" className="input" value={formData.value} onChange={(e) => setFormData({ ...formData, value: Number(e.target.value) })} required /></div>
                <div><label className="block text-sm font-medium mb-2">Probabilidade (%)</label><input type="number" min="0" max="100" className="input" value={formData.probability} onChange={(e) => setFormData({ ...formData, probability: Number(e.target.value) })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Contato</label>
                  {/* USA OS CONTATOS REAIS DA API */}
                  <select className="input" value={formData.contactId} onChange={(e) => setFormData({ ...formData, contactId: e.target.value })}>
                    <option value="">Selecione um contato</option>
                    {availableContacts.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Responsável</label>
                  <select className="input" value={formData.ownerId} onChange={(e) => setFormData({ ...formData, ownerId: e.target.value })}>
                    <option value="">Selecione o dono</option>
                    {users.map((u) => (<option key={u.id} value={u.id}>{u.name}</option>))}
                  </select>
                </div>
              </div>
              <div><label className="block text-sm font-medium mb-2">Previsão de Fechamento</label><input type="date" className="input" value={formData.expectedClose} onChange={(e) => setFormData({ ...formData, expectedClose: e.target.value })} required /></div>
              <div className="flex gap-3 mt-4">
                <button type="button" className="btn btn-secondary flex-1" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary flex-1">{editingDeal ? 'Salvar' : 'Criar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL NOVO FUNIL --- */}
      {showFunnelModal && (
        <div className="modal-overlay" onClick={() => setShowFunnelModal(false)}>
          <div className="modal max-w-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">Novo Funil de Vendas</h2>
            <form onSubmit={handleFunnelSubmit} className="flex flex-col gap-6">
              <div><label className="block text-sm font-medium mb-2">Nome do Funil</label><input type="text" className="input w-full" value={funnelName} onChange={(e) => setFunnelName(e.target.value)} placeholder="Ex: Vendas Enterprise" required /></div>
              <div className="bg-secondary/30 p-4 rounded-xl border border-border">
                <label className="block text-sm font-bold mb-3">Configurar Etapas</label>
                <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
                  {funnelStages.map((stage, index) => (
                    <div key={index} draggable onDragStart={() => handleStageDragStart(index)} onDragOver={handleStageDragOver} onDrop={() => handleStageDrop(index)} className={`flex items-center gap-3 bg-background p-2 rounded-lg border shadow-sm cursor-move transition-all ${draggedStageIndex === index ? 'opacity-50 border-dashed border-primary' : 'hover:border-primary/50'}`}>
                      <span className="text-muted-foreground/50 text-xs select-none">⋮⋮</span>
                      <div className="w-4 h-4 rounded-full shrink-0 border border-gray-200" style={{ backgroundColor: stage.color }} />
                      <span className="flex-1 font-medium text-sm select-none">{stage.name}</span>
                      <button type="button" onClick={(e) => { e.stopPropagation(); handleRemoveStage(index); }} className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors cursor-pointer">✕</button>
                    </div>
                  ))}
                  {funnelStages.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">Nenhuma etapa definida. Adicione abaixo.</p>}
                </div>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <input type="text" className="input h-9 text-sm" placeholder="Nome da etapa (ex: Proposta)" value={newStageName} onChange={(e) => setNewStageName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddStage(e as any); }}} />
                  </div>
                  <div className="flex gap-1 bg-background p-1 rounded-lg border items-center">
                    {PRESET_COLORS.slice(0, 3).map((color) => (
                      <button key={color} type="button" onClick={() => setNewStageColor(color)} className={`w-5 h-5 rounded-full transition-transform ${newStageColor === color ? 'scale-125 ring-2 ring-offset-1 ring-primary' : 'opacity-70 hover:opacity-100'}`} style={{ backgroundColor: color }} />
                    ))}
                    <input type="color" value={newStageColor} onChange={(e) => setNewStageColor(e.target.value)} className="w-6 h-6 rounded-full overflow-hidden cursor-pointer border-0 p-0 ml-1" />
                  </div>
                  <button type="button" onClick={handleAddStage} className="h-9 px-3 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">+</button>
                </div>
              </div>
              <div className="flex gap-3 mt-2 border-t pt-4">
                <button type="button" className="btn btn-secondary flex-1" onClick={() => setShowFunnelModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary flex-1">Salvar Funil</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
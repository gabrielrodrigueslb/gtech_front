'use client';

import type React from 'react';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  createPipeline as createPipelineService,
  updatePipeline as updatePipelineService,
  deletePipeline as deletePipelineService,
} from '@/lib/pipeline';
import {
  createOpportunity,
  getOpportunities,
  updateOpportunity as updateOpportunityService,
  deleteOpportunity as deleteOpportunityService,
} from '@/lib/opportunity';
import {
  FaRegUser,
  FaPlus,
  FaEllipsisV,
  FaTrash,
  FaEdit,
  FaChevronDown,
  FaExclamationTriangle,
} from 'react-icons/fa';
import { FaRegAddressCard } from 'react-icons/fa6';

import { GrView } from 'react-icons/gr';
import { getUsers, type User } from '@/lib/user';
import { getContacts, type Contact as ContactType } from '@/lib/contact';
import { formatPhoneNumber } from '@/lib/utils';
import { useCRM, type Deal } from '@/context/crm-context';
import { useFunnel } from '@/context/funnel-context';
import DetailsModal from './components/detailsModal';

type DetailsFormData = {
  title: string;
  description: string;
  value: number;
  contactId: string;
  contactNumber: string;
  website: string;
  address: string;
  clientRole: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  enderecoCliente: string;
  redesSocial1: string;
  redesSocial2: string;
  linksExtras: string[];
  ownerId: string;
  probability: number;
  expectedClose: string;
  stageId: string;
};

export default function Deals() {
  const {
    deals,
    addDeal,
    updateDeal,
    deleteDeal,
    moveDeal,
  } = useCRM();

  const {
    funnels,
    activeFunnel,
    activeFunnelId,
    setActiveFunnelId,
    isLoadingFunnels,
    addFunnel,
    updateFunnel,
    deleteFunnel,
  } = useFunnel();

  // --- ESTADOS GERAIS ---
  const [isLoading, setIsLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [showFunnelModal, setShowFunnelModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showDeleteFunnelModal, setShowDeleteFunnelModal] = useState(false);
  const [funnelToDelete, setFunnelToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [editingFunnelId, setEditingFunnelId] = useState<string | null>(null);

  const boardRef = useRef<HTMLDivElement | null>(null);
  const autoScrollRef = useRef<number | null>(null);

  const SCROLL_EDGE_SIZE = 80; // px de distÃ¢ncia da borda
  const SCROLL_SPEED = 12; // velocidade do scroll

  // --- DADOS REAIS ---
  const [users, setUsers] = useState<User[]>([]);
  const [availableContacts, setAvailableContacts] = useState<ContactType[]>([]);

  // --- DRAG AND DROP ---
  const [draggedDeal, setDraggedDeal] = useState<string | null>(null);
  const [dragSource, setDragSource] = useState<{
    stageId: string;
    funnelId: string;
  } | null>(null);

  const handleAutoScroll = (e: React.DragEvent) => {
    if (!boardRef.current) return;

    const container = boardRef.current;
    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX;

    // Cancela scroll anterior
    if (autoScrollRef.current) {
      cancelAnimationFrame(autoScrollRef.current);
      autoScrollRef.current = null;
    }

    // Borda esquerda
    if (mouseX < rect.left + SCROLL_EDGE_SIZE) {
      autoScrollRef.current = requestAnimationFrame(() => {
        container.scrollLeft -= SCROLL_SPEED;
      });
    }

    // Borda direita
    else if (mouseX > rect.right - SCROLL_EDGE_SIZE) {
      autoScrollRef.current = requestAnimationFrame(() => {
        container.scrollLeft += SCROLL_SPEED;
      });
    }
  };

  // --- ESTADOS DO FORMULÃRIO ---
  const [formData, setFormData] = useState({
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
    expectedClose: '',
  });

  const openModal = (deal?: Deal) => {
    if (deal) {
      setEditingDeal(deal);
      const rawNumber = deal.contactNumber ?? '';
      setFormData({
        title: deal.title,
        description: deal.description || '',
        value: deal.value,
        contactId: deal.contactId,
        ownerId: deal.ownerId || deal.owner?.id || '',
        probability: deal.probability,
        expectedClose: new Date(deal.expectedClose).toISOString().split('T')[0],
        contactNumber: rawNumber ? formatPhoneNumber(rawNumber) : '',
        website: deal.website ?? '',
        address: deal.address ?? '',
        clientRole: deal.clientRole ?? '',
        clientName: deal.clientName ?? '',
        clientPhone: deal.clientPhone ?? '',
        clientEmail: deal.clientEmail ?? '',
        enderecoCliente: deal.enderecoCliente ?? '',
        redesSocial1: deal.redesSocial1 ?? '',
        redesSocial2: deal.redesSocial2 ?? '',
        linksExtras: deal.linksExtras ?? [],
      });
    } else {
      setEditingDeal(null);
      setFormData({
        title: '',
        description: '',
        value: 0,
        contactId: '',
        website: '',
        contactNumber: '',
        address: '',
        clientRole: '',
        clientName: '',
        clientPhone: '',
        clientEmail: '',
        enderecoCliente: '',
        redesSocial1: '',
        redesSocial2: '',
        linksExtras: [],
        ownerId: '',
        probability: 50,
        expectedClose: new Date().toISOString().split('T')[0],
      });
    }
    setShowModal(true);
  };

  // --- ESTADOS DO FUNIL ---
  const [funnelName, setFunnelName] = useState('');
  const [funnelStages, setFunnelStages] = useState<
    { id?: string; name: string; color: string }[]
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
  const [isFunnelMenuOpen, setIsFunnelMenuOpen] = useState(false);
  const funnelMenuRef = useRef<HTMLDivElement>(null);

  const PRESET_COLORS = [
    '#F59E0B',
    '#3B82F6',
    '#10B981',
    '#8B5CF6',
    '#06B6D4',
    '#EC4899',
    '#6366F1',
  ];
  // --- CARREGAMENTO INICIAL ---
  useEffect(() => {
    async function loadAllData() {
      setIsLoading(true);
      try {
        const [usersData, contactsData] = await Promise.all([
          getUsers(),
          getContacts(),
        ]);

        setUsers(usersData || []);
        setAvailableContacts(contactsData || []);
      } catch (error: any) {
        console.error('Erro no carregamento inicial:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadAllData();
  }, []);

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
          website: d.website,
          contactNumber: d.contactNumber,
          address: d.address,
          clientRole: d.clientRole,
          clientName: d.clientName,
          clientPhone: d.clientPhone,
          clientEmail: d.clientEmail,
          enderecoCliente: d.enderecoCliente,
          redesSocial1: d.redesSocial1,
          redesSocial2: d.redesSocial2,
          linksExtras: d.linksExtras,
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
  }, [activeFunnelId, isLoading]);

  // Fechar menu ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        funnelMenuRef.current &&
        !funnelMenuRef.current.contains(event.target as Node)
      ) {
        setIsFunnelMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const funnelDeals = useMemo(
    () => deals.filter((d) => d.funnelId === activeFunnelId),
    [deals, activeFunnelId],
  );

  const getStageDeals = useCallback(
    (stageId: string) => funnelDeals.filter((d) => d.stage === stageId),
    [funnelDeals],
  );
  const getStageTotal = useCallback(
    (stageId: string) =>
      getStageDeals(stageId).reduce((acc, d) => acc + d.value, 0),
    [getStageDeals],
  );

  // --- HANDLERS (PIPELINE) ---
  const handleAddStage = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!newStageName.trim()) return;
    setFunnelStages([
      ...funnelStages,
      { name: newStageName, color: newStageColor },
    ]);
    setNewStageName('');
    setNewStageColor(
      PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)],
    );
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
    if (!funnelName.trim()) return alert('Nome do funil Ã© obrigatÃ³rio');
    if (funnelStages.length === 0)
      return alert('Adicione pelo menos uma etapa');

    try {
      if (editingFunnelId) {
        // Correção: updatePipelineService espera (id, name, stages)
        const updatedPipeline = await updatePipelineService(
          editingFunnelId,
          funnelName,
          funnelStages,
        );
        // Correção: updateFunnel espera (id, funnel)
        updateFunnel(editingFunnelId, {
          id: updatedPipeline.id,
          name: updatedPipeline.name,
          stages: updatedPipeline.stages || [],
        });
      } else {
        const newPipeline = await createPipelineService(
          funnelName,
          funnelStages,
        );
        addFunnel({
          id: newPipeline.id,
          name: newPipeline.name,
          stages: newPipeline.stages || [],
        });
        setActiveFunnelId(newPipeline.id);
      }
      setShowFunnelModal(false);
      resetFunnelForm();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao salvar funil');
    }
  };

  const resetFunnelForm = () => {
    setFunnelName('');
    setFunnelStages([
      { name: 'Lead', color: '#F59E0B' },
      { name: 'Negociação', color: '#8B5CF6' },
      { name: 'Fechado', color: '#10B981' },
    ]);
    setEditingFunnelId(null);
  };

  const openEditFunnel = (funnel: any) => {
    setEditingFunnelId(funnel.id);
    setFunnelName(funnel.name);
    setFunnelStages(funnel.stages || []);
    setShowFunnelModal(true);
    setIsFunnelMenuOpen(false);
  };

  const confirmDeleteFunnel = (funnel: any) => {
    setFunnelToDelete(funnel);
    setShowDeleteFunnelModal(true);
    setIsFunnelMenuOpen(false);
  };

  const handleDeleteFunnel = async () => {
    if (!funnelToDelete) return;
    try {
      await deletePipelineService(funnelToDelete.id);
      deleteFunnel(funnelToDelete.id);
      setShowDeleteFunnelModal(false);
      setFunnelToDelete(null);
    } catch (error) {
      alert('Erro ao excluir funil');
    }
  };

  // --- HANDLERS (OPPORTUNITY) ---
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
          stageId: currentStageId!,
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
      setShowModal(false);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao salvar oportunidade');
    }
  };

  const handleDragStart = (dealId: string, stageId: string) => {
    setDraggedDeal(dealId);
    setDragSource({ stageId, funnelId: activeFunnelId });
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleDrop = async (targetStageId: string) => {
    if (autoScrollRef.current) {
      cancelAnimationFrame(autoScrollRef.current);
      autoScrollRef.current = null;
    }

    if (!draggedDeal || !dragSource || dragSource.stageId === targetStageId) {
      setDraggedDeal(null);
      setDragSource(null);
      return;
    }

    const dealId = draggedDeal;

    moveDeal(dealId, targetStageId);
    setDraggedDeal(null);
    setDragSource(null);

    try {
      await updateOpportunityService(dealId, { stageId: targetStageId });
    } catch (error) {
      alert('Erro ao sincronizar movimento.');
    }
  };

  const handleDelete = async () => {
    if (!editingDeal) return;
    if (!confirm('Tem certeza que deseja excluir esta oportunidade?')) return;
    try {
      await deleteOpportunityService(editingDeal.id);
      deleteDeal(editingDeal.id);
      setShowModal(false);
    } catch (error) {
      console.error(error);
      alert('Erro ao excluir.');
    }
  };

  const openDetailsModal = (deal: Deal) => {
    setSelectedDeal(deal);
    setShowDetailsModal(true);
  };

  const closeDetailsModal = () => setShowDetailsModal(false);

  const handleSaveDetails = async (data: DetailsFormData) => {
    if (!selectedDeal) return;
    try {
      await updateOpportunityService(selectedDeal.id, {
        title: data.title,
        description: data.description,
        amount: Number(data.value),
        probability: Number(data.probability),
        website: data.website,
        contactNumber: data.contactNumber.replace(/\D/g, ''),
        address: data.address,
        clientRole: data.clientRole,
        clientName: data.clientName,
        clientPhone: data.clientPhone,
        clientEmail: data.clientEmail,
        enderecoCliente: data.enderecoCliente,
        redesSocial1: data.redesSocial1,
        redesSocial2: data.redesSocial2,
        linksExtras: data.linksExtras,
        dueDate: data.expectedClose,
        contactId: data.contactId,
        ownerId: data.ownerId,
        stageId: data.stageId || selectedDeal.stage,
        pipelineId: selectedDeal.funnelId,
      });

      const updatedOwner = users.find((u) => u.id === data.ownerId);
      const updatedDeal: Partial<Deal> = {
        title: data.title,
        description: data.description,
        value: Number(data.value),
        probability: Number(data.probability),
        contactId: data.contactId,
        contactNumber: data.contactNumber.replace(/\D/g, ''),
        website: data.website,
        address: data.address,
        clientRole: data.clientRole,
        clientName: data.clientName,
        clientPhone: data.clientPhone,
        clientEmail: data.clientEmail,
        enderecoCliente: data.enderecoCliente,
        redesSocial1: data.redesSocial1,
        redesSocial2: data.redesSocial2,
        linksExtras: data.linksExtras,
        expectedClose: new Date(data.expectedClose),
        ownerId: data.ownerId,
        owner: updatedOwner
          ? { id: updatedOwner.id, name: updatedOwner.name }
          : data.ownerId
            ? { id: data.ownerId, name: selectedDeal.owner?.name || '' }
            : undefined,
        stage: data.stageId || selectedDeal.stage,
      };

      updateDeal(selectedDeal.id, updatedDeal);
      setSelectedDeal((prev) => (prev ? { ...prev, ...updatedDeal } : prev));
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao salvar oportunidade');
      throw error;
    }
  };

  const renderUserAvatar = (
    name: string,
    size = 'w-8 h-8',
    textSize = 'text-xs',
  ) => {
    const initial = name ? name[0].toUpperCase() : '?';
    return (
      <div
        className={`${size} bg-primary/10 text-primary rounded-full flex items-center justify-center font-bold shrink-0 ${textSize} border border-primary/20`}
        title={name}
      >
        {initial}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background text-foreground">
      {/* --- HEADER --- */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 shrink-0 ">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-lg">
            <FaRegAddressCard className="text-primary text-2xl" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              CRM Kanban
            </h1>
            <p className="text-sm text-muted-foreground">
              Gerencie suas oportunidades de vendas
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* --- CUSTOM FUNNEL SELECTOR --- */}
          <div className="relative" ref={funnelMenuRef}>
            <button
              onClick={() => setIsFunnelMenuOpen(!isFunnelMenuOpen)}
              className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-2 shadow-sm hover:bg-muted/50 transition-all min-w-[200px] justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                <span className="text-sm font-bold truncate text-white/80">
                  {activeFunnel?.name || 'Selecionar Funil'}
                </span>
              </div>
              <FaChevronDown
                size={12}
                className={`text-muted-foreground transition-transform ${
                  isFunnelMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isFunnelMenuOpen && (
              <div className="absolute top-full left-0 mt-2 w-72 bg-card-hover rounded-xl shadow-xl z-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 bg-card text-muted">
                <div className="p-2 max-h-80 overflow-y-auto scrollbar-thin">
                  {funnels.map((funnel) => (
                    <div
                      key={funnel.id}
                      className={`group flex items-center justify-between p-2 rounded-lg transition-colors cursor-pointer ${
                        activeFunnelId === funnel.id ? 'bg-primary/5' : ''
                      }`}
                      onClick={() => {
                        setActiveFunnelId(funnel.id);
                        setIsFunnelMenuOpen(false);
                      }}
                    >
                      <div className="flex items-center  gap-3 overflow-hidden">
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center ${
                            activeFunnelId === funnel.id
                              ? 'bg-primary text-white'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {activeFunnelId === funnel.id ? (
                            <div></div>
                          ) : (
                            <div className="w-1.5 h-1.5 rounded-full bg-current" />
                          )}
                        </div>
                        <span
                          className={`text-sm font-medium truncate ${
                            activeFunnelId === funnel.id
                              ? 'text-primary font-bold'
                              : ''
                          }`}
                        >
                          {funnel.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditFunnel(funnel);
                          }}
                          className="p-1.5 hover:bg-primary/10 text-muted-foreground hover:text-primary rounded-md transition-colors cursor-pointer"
                          title="Editar"
                        >
                          <FaEdit size={12} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            confirmDeleteFunnel(funnel);
                          }}
                          className="p-1.5 hover:bg-destructive/10 text-muted-foreground rounded-md transition-colors cursor-pointer  hover:text-red-400"
                          title="Excluir"
                        >
                          <FaTrash size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-2 bg-muted/20">
                  <button
                    onClick={() => {
                      setShowFunnelModal(true);
                      resetFunnelForm();
                      setIsFunnelMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold text-primary hover:bg-primary/5 rounded-lg transition-colors cursor-pointer"
                  >
                    <FaPlus size={10} />
                    CRIAR NOVO FUNIL
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-all shadow-sm cursor-pointer"
            onClick={() => openModal()}
          >
            <FaPlus size={14} />
            <span>Nova Oportunidade</span>
          </button>
        </div>
      </header>

      {/* --- KANBAN BOARD --- */}
      <main className="flex-1 overflow-hidden min-h-0 relative">
        { (isLoading || isLoadingFunnels) && (!funnels || funnels.length === 0) ? (
          <div className="absolute inset-0 flex flex-col justify-center items-center backdrop-blur-sm z-10">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mb-4"></div>
            <span className="text-muted-foreground font-medium">
              Carregando seu CRM...
            </span>
          </div>
        ) : activeFunnel ? (
          <div
            ref={boardRef}
            className="flex h-full gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent scrollbar-background-transparent "
            onDragOver={handleAutoScroll}
          >
            {activeFunnel.stages.map((stage) => {
              const stageDealsList = getStageDeals(stage.id);
              const stageTotal = getStageTotal(stage.id);
              return (
                <div
                  key={stage.id}
                  className="flex flex-col w-80 min-w-[20rem] bg-card rounded-xl border border-border overflow-hidden "
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(stage.id)}
                >
                  <div className="p-4 border-b border-muted-foreground/20 bg-card/10 backdrop-blur-sm sticky top-0 z-10 rounded-t-3xl">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full shadow-sm"
                          style={{ backgroundColor: stage.color }}
                        />
                        <h3 className="font-bold text-sm uppercase tracking-wider text-muted">
                          {stage.name}
                        </h3>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                        {stageDealsList.length}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-muted-foreground">
                      {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      }).format(stageTotal)}
                    </p>
                  </div>

                  <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-none">
                    {stageDealsList.map((deal) => {
                      const contact = availableContacts.find(
                        (c) => c.id === deal.contactId,
                      );
                      const ownerName = deal.owner?.name;
                      return (
                        <div
                          key={deal.id}
                          className={`group bg-card hover:bg-card/80 border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer relative overflow-hidden ${
                            draggedDeal === deal.id ? 'opacity-40 scale-95' : ''
                          }`}
                          draggable
                          onDragStart={() => handleDragStart(deal.id, stage.id)}
                          onClick={() => openDetailsModal(deal)}
                        >
                          <div
                            className="absolute top-0 left-0 h-1 transition-all duration-500"
                            style={{
                              width: `100%`,
                              backgroundColor: stage.color,
                            }}
                          />
                          <div className="flex justify-between items-start gap-2 mb-3">
                            <h4 className="font-semibold text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors select-none">
                              {deal.title}
                            </h4>
                            <button className="text-muted-foreground/40 hover:text-foreground p-1 -mr-1 transition-colors cursor-pointer">
                              <FaEllipsisV size={12} />
                            </button>
                          </div>
                          <div className="flex items-baseline gap-1 mb-4 select-none">
                            <span className="text-xs text-muted-foreground font-medium">
                              R$
                            </span>
                            <span className="text-lg font-bold tracking-tight">
                              {deal.value.toLocaleString('pt-BR')}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2 mt-auto select-none">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <div className="bg-muted p-1 rounded text-muted-foreground">
                                <FaRegUser size={10} />
                              </div>
                              <span className="text-[11px] font-medium text-muted-foreground truncate select-none">
                                {contact?.name || 'Sem contato'}
                              </span>
                            </div>
                            {ownerName &&
                              renderUserAvatar(
                                ownerName,
                                'w-6 h-6',
                                'text-[10px]',
                              )}
                          </div>
                        </div>
                      );
                    })}
                    {stageDealsList.length === 0 && (
                      <div className="flex flex-col items-center justify-center h-32 rounded-xl border-2 border-dashed border-border text-muted-foreground/50 transition-colors hover:border-primary/20 hover:text-primary/30">
                        <FaPlus size={20} className="mb-2 opacity-20" />
                        <span className="text-xs font-medium">
                          Arraste ou crie aqui
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground bg-muted/10 rounded-2xl border-2 border-dashed">
            <div className="bg-muted p-4 rounded-full mb-4">
              <FaRegAddressCard size={40} className="opacity-20" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              Nenhum funil encontrado
            </h3>
            <p className="text-sm mb-6">
              Crie seu primeiro funil de vendas para começar a gerenciar leads.
            </p>
            <button
              onClick={() => {
                setShowFunnelModal(true);
                resetFunnelForm();
              }}
              className="bg-primary text-primary-foreground px-6 py-2 rounded-lg font-medium hover:opacity-90 transition-all"
            >
              Criar Funil
            </button>
          </div>
        )}
      </main>

      {/* --- MODAL CONFIRMAÇÃO EXCLUSÃO FUNIL --- */}
      {showDeleteFunnelModal && funnelToDelete && (
        <div className="fixed inset-0 z-110 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mx-auto mb-4">
                <FaExclamationTriangle size={32} />
              </div>
              <h2 className="text-xl font-bold mb-2">Excluir Funil?</h2>
              <p className="text-muted-foreground text-sm mb-6">
                VocÃª está prestes a excluir o funil{' '}
                <span className="font-bold text-foreground">
                  "{funnelToDelete.name}"
                </span>
                . Esta ação não pode ser desfeita e todas as etapas serão
                removidas.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteFunnelModal(false)}
                  className="flex-1 px-4 py-2.5 border border-border rounded-xl font-medium hover:bg-muted transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteFunnel}
                  className="flex-1 px-4 py-2.5 bg-destructive text-destructive-foreground rounded-xl font-bold hover:opacity-90 transition-all shadow-lg border border-border shadow-destructive/20 cursor-pointer hover:bg-red-400"
                >
                  Sim, Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL FUNIL (CRIAR/EDITAR) --- */}
      {showFunnelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-muted-foreground flex items-center justify-between">
              <h2 className="text-xl font-bold">
                {editingFunnelId ? 'Editar Funil' : 'Novo Funil'}
              </h2>
              <button
                onClick={() => setShowFunnelModal(false)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleFunnelSubmit} className="p-6 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">
                  Nome do Funil
                </label>
                <input
                  type="text"
                  className="w-full bg-muted/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  placeholder="Ex: Vendas Enterprise"
                  value={funnelName}
                  onChange={(e) => setFunnelName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold uppercase text-muted-foreground">
                  Etapas do Processo
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2 scrollbar-thin">
                  {funnelStages.map((stage, index) => (
                    <div
                      key={index}
                      draggable
                      onDragStart={() => handleStageDragStart(index)}
                      onDragOver={handleStageDragOver}
                      onDrop={() => handleStageDrop(index)}
                      className="flex items-center gap-3 bg-muted/30 p-2.5 rounded-xl border border-border group cursor-move"
                    >
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: stage.color }}
                      />
                      <span className="flex-1 text-sm font-medium">
                        {stage.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveStage(index)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-all cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 pt-2">
                  <input
                    type="text"
                    className="flex-1 bg-muted/50 border border-border rounded-lg px-3 py-1.5 text-sm outline-none focus:border-primary transition-all"
                    placeholder="Nova etapa..."
                    value={newStageName}
                    onChange={(e) => setNewStageName(e.target.value)}
                  />
                  <div className="flex gap-1 items-center bg-muted/50 border rounded-lg px-2">
                    {PRESET_COLORS.slice(0, 3).map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setNewStageColor(color)}
                        className={`w-4 h-4 rounded-full transition-transform ${
                          newStageColor === color
                            ? 'scale-125 ring-1 ring-primary'
                            : 'opacity-50'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={handleAddStage}
                    className="bg-primary text-primary-foreground w-8 h-8 rounded-lg flex items-center justify-center hover:opacity-90 transition-all cursor-pointer"
                  >
                    <FaPlus size={12} />
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  className="flex-1 px-4 py-2 border border-border rounded-xl font-medium hover:bg-muted transition-all cursor-pointer"
                  onClick={() => setShowFunnelModal(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-xl font-bold hover:opacity-90 transition-all cursor-pointer"
                >
                  {editingFunnelId ? 'Salvar Alterações' : 'Criar Funil'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- OUTROS MODAIS --- */}
      {showDetailsModal && selectedDeal && (
        <DetailsModal
          selectedDeal={selectedDeal}
          availableContacts={availableContacts}
          availableUsers={users}
          onClose={closeDetailsModal}
          onSave={handleSaveDetails}
        />
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-xl rounded-2xl shadow-2xl border border-border overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h2 className="text-xl font-bold">
                {editingDeal ? 'Editar Oportunidade' : 'Nova Oportunidade'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form
              onSubmit={handleSubmit}
              className="p-6 space-y-4 max-h-[70vh] overflow-y-auto scrollbar-thin"
            >
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">
                  Tí­tulo da Oportunidade
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

              <div className="pt-2 border-t border-border/60">
                <h3 className="text-xs font-bold uppercase text-muted-foreground mb-3">
                  Links Úteis
                </h3>
                <textarea
                  className="w-full bg-muted/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all min-h-[120px] resize-none"
                  placeholder="https://exemplo.com\nhttps://outro-link.com"
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
                  onClick={() => setShowModal(false)}
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
      )}
    </div>
  );
}

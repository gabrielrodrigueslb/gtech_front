'use client';

import type React from 'react';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';

// --- SERVIÇOS ---
import { deletePipeline as deletePipelineService } from '@/lib/pipeline';
import {
  getOpportunities,
  updateOpportunity as updateOpportunityService,
  deleteOpportunity as deleteOpportunityService,
} from '@/lib/opportunity';
import { getUsers, type User } from '@/lib/user';
import { getContacts, type Contact as ContactType } from '@/lib/contact';

// --- ÍCONES ---
import {
  FaPlus,
  FaTrash,
  FaEdit,
  FaChevronDown,
  FaExclamationTriangle,
} from 'react-icons/fa';
import { FaRegAddressCard } from 'react-icons/fa6';

// --- CONTEXTOS ---
import { useCRM, type Deal } from '@/context/crm-context';
import { useFunnel } from '@/context/funnel-context';

// --- COMPONENTES MODAIS (Refatorados) ---
import DetailsModal from './components/detailsModal';
import DealFormModal from './components/DealFormModal';
import FunnelFormModal from './components/FunnelFormModal';
import { CrmKanbanBoard } from './components/CrmKanbanBoard';

// Tipo auxiliar para compatibilidade com o DetailsModal existente
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
  const { deals, addDeal, updateDeal, deleteDeal, moveDeal } = useCRM();

  const {
    funnels,
    activeFunnel,
    activeFunnelId,
    setActiveFunnelId,
    isLoadingFunnels,
    deleteFunnel,
  } = useFunnel();

  // --- ESTADOS GERAIS ---
  const [isLoading, setIsLoading] = useState(true);

  // Modais
  const [showModal, setShowModal] = useState(false); // Modal de Deal (Criar/Editar)
  const [showFunnelModal, setShowFunnelModal] = useState(false); // Modal de Funil (Criar/Editar)
  const [showDetailsModal, setShowDetailsModal] = useState(false); // Modal de Detalhes (Visualizar)
  const [showDeleteFunnelModal, setShowDeleteFunnelModal] = useState(false); // Modal de Confirmação (Excluir Funil)
  const [showDeleteDealModal, setShowDeleteDealModal] = useState(false); // Modal de Confirmação (Excluir Oportunidade)

  // Seleções
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [editingFunnel, setEditingFunnel] = useState<{
    id: string;
    name: string;
    stages: any[];
  } | null>(null);
  const [funnelToDelete, setFunnelToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Refs de UI
  const boardRef = useRef<HTMLDivElement | null>(null);
  const autoScrollRef = useRef<number | null>(null);
  const funnelMenuRef = useRef<HTMLDivElement>(null);
  const [isFunnelMenuOpen, setIsFunnelMenuOpen] = useState(false);

  const SCROLL_EDGE_SIZE = 80;
  const SCROLL_SPEED = 12;

  // --- DADOS REAIS ---
  const [users, setUsers] = useState<User[]>([]);
  const [availableContacts, setAvailableContacts] = useState<ContactType[]>([]);

  // --- DRAG AND DROP (Deal) ---
  const [draggedDeal, setDraggedDeal] = useState<string | null>(null);
  const [dragSource, setDragSource] = useState<{
    stageId: string;
    funnelId: string;
  } | null>(null);

  // --- EFEITOS DE CARREGAMENTO ---
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

  // --- MEMOS E CALLBACKS ---
  const funnelDeals = useMemo(
    () => deals.filter((d) => d.funnelId === activeFunnelId),
    [deals, activeFunnelId]
  );
  const contactNameById = useMemo(
    () => new Map(availableContacts.map((contact) => [contact.id, contact.name])),
    [availableContacts]
  );
  const getContactName = useCallback(
    (contactId: string) => contactNameById.get(contactId),
    [contactNameById]
  );

  // --- HANDLERS: FUNIL (Abrir Modais) ---
  const openCreateFunnel = () => {
    setEditingFunnel(null);
    setShowFunnelModal(true);
    setIsFunnelMenuOpen(false);
  };

  const openEditFunnel = (funnel: any) => {
    setEditingFunnel(funnel);
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

  // --- HANDLERS: DEAL (Drag & Scroll) ---
  const handleAutoScroll = (e: React.DragEvent) => {
    if (!boardRef.current) return;
    const container = boardRef.current;
    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX;

    if (autoScrollRef.current) {
      cancelAnimationFrame(autoScrollRef.current);
      autoScrollRef.current = null;
    }

    if (mouseX < rect.left + SCROLL_EDGE_SIZE) {
      autoScrollRef.current = requestAnimationFrame(() => {
        container.scrollLeft -= SCROLL_SPEED;
      });
    } else if (mouseX > rect.right - SCROLL_EDGE_SIZE) {
      autoScrollRef.current = requestAnimationFrame(() => {
        container.scrollLeft += SCROLL_SPEED;
      });
    }
  };

  const handleDragStart = (dealId: string, stageId: string) => {
    setDraggedDeal(dealId);
    setDragSource({ stageId, funnelId: activeFunnelId });
  };

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

  // --- HANDLERS: DEAL (Abrir/Salvar Detalhes) ---
  const openModalDeal = (deal?: Deal) => {
    setEditingDeal(deal || null);
    setShowModal(true);
  };

  const openDetailsModal = (deal: Deal) => {
    setSelectedDeal(deal);
    setShowDetailsModal(true);
  };

  const closeDetailsModal = () => {
    setShowDetailsModal(false);
    setShowDeleteDealModal(false);
  };

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

  const handleRequestDeleteDetails = () => {
    setShowDeleteDealModal(true);
  };

  const handleDeleteDetails = async () => {
    if (!selectedDeal) return;
    try {
      await deleteOpportunityService(selectedDeal.id);
      deleteDeal(selectedDeal.id);
      setShowDetailsModal(false);
      setSelectedDeal(null);
      setShowDeleteDealModal(false);
    } catch (error) {
      console.error(error);
      alert('Erro ao excluir.');
    }
  };

  const renderUserAvatar = (
    name: string,
    size = 'w-8 h-8',
    textSize = 'text-xs'
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
    <div className="flex flex-col h-full w-full max-w-full min-w-0 overflow-hidden bg-background text-foreground">
      {/* --- HEADER --- */}
      <header className="w-full max-w-full min-w-0 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="bg-primary/10 p-2 rounded-lg">
            <FaRegAddressCard className="text-primary text-2xl" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              CRM Kanban
            </h1>
            <p className="text-sm text-muted-foreground">
              Gerencie suas oportunidades de vendas
            </p>
          </div>
        </div>

        <div className="flex flex-wrap md:flex-nowrap items-center gap-3 md:ml-auto shrink-0">
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
                      <div className="flex items-center gap-3 overflow-hidden">
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
                          className="p-1.5 hover:bg-destructive/10 text-muted-foreground rounded-md transition-colors cursor-pointer hover:text-red-400"
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
                    onClick={openCreateFunnel}
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
            onClick={() => openModalDeal()}
          >
            <FaPlus size={14} />
            <span>Nova Oportunidade</span>
          </button>
        </div>
      </header>

      {/* --- KANBAN BOARD --- */}
      <main className="flex-1 w-full max-w-full overflow-hidden min-h-0 min-w-0 relative">
        {(isLoading || isLoadingFunnels) &&
        (!funnels || funnels.length === 0) ? (
          <div className="absolute inset-0 flex flex-col justify-center items-center backdrop-blur-sm z-10">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mb-4"></div>
            <span className="text-muted-foreground font-medium">
              Carregando seu CRM...
            </span>
          </div>
        ) : activeFunnel ? (
          <CrmKanbanBoard
            stages={activeFunnel.stages}
            deals={funnelDeals}
            boardRef={boardRef}
            draggedDealId={draggedDeal}
            onBoardDragOver={handleAutoScroll}
            onColumnDragOver={(e) => e.preventDefault()}
            onColumnDrop={handleDrop}
            onDealDragStart={handleDragStart}
            onDealClick={openDetailsModal}
            getContactName={getContactName}
            renderUserAvatar={renderUserAvatar}
          />
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
              onClick={openCreateFunnel}
              className="bg-primary text-primary-foreground px-6 py-2 rounded-lg font-medium hover:opacity-90 transition-all"
            >
              Criar Funil
            </button>
          </div>
        )}
      </main>

      {/* --- MODAIS DE NEGÓCIO --- */}
      <DealFormModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        editingDeal={editingDeal}
        activeFunnelId={activeFunnelId}
        initialStageId={activeFunnel?.stages[0]?.id}
        users={users}
        availableContacts={availableContacts}
      />

      {showDetailsModal && selectedDeal && (
        <DetailsModal
          selectedDeal={selectedDeal}
          availableContacts={availableContacts}
          availableUsers={users}
          onClose={closeDetailsModal}
          onSave={handleSaveDetails}
          onRequestDelete={handleRequestDeleteDetails}
        />
      )}

      {/* --- MODAIS DE FUNIL --- */}
      <FunnelFormModal
        isOpen={showFunnelModal}
        onClose={() => setShowFunnelModal(false)}
        funnelToEdit={editingFunnel}
      />

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
                Você está prestes a excluir o funil{' '}
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

      {/* --- MODAL CONFIRMAÇÃO EXCLUSÃO OPORTUNIDADE --- */}
      {showDeleteDealModal && selectedDeal && (
        <div className="fixed inset-0 z-110 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mx-auto mb-4">
                <FaExclamationTriangle size={32} />
              </div>
              <h2 className="text-xl font-bold mb-2">Excluir Oportunidade?</h2>
              <p className="text-muted-foreground text-sm mb-6">
                Você está prestes a excluir a oportunidade{' '}
                <span className="font-bold text-foreground">
                  "{selectedDeal.title}"
                </span>
                . Esta ação não pode ser desfeita.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteDealModal(false)}
                  className="flex-1 px-4 py-2.5 border border-border rounded-xl font-medium hover:bg-muted transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteDetails}
                  className="flex-1 px-4 py-2.5 bg-destructive text-destructive-foreground rounded-xl font-bold hover:opacity-90 transition-all shadow-lg border border-border shadow-destructive/20 cursor-pointer hover:bg-red-400"
                >
                  Sim, Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

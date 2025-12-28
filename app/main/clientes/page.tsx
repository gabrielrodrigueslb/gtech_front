'use client';

import type React from 'react';
import { useState, useEffect, useMemo } from 'react';
import {
  FaBuilding,
  FaPlus,
  FaTrash,
  FaEdit,
  FaSearch,
  FaCheckCircle,
  FaClock,
  FaExclamationCircle,
  FaFileInvoiceDollar,
  FaChevronRight,
} from 'react-icons/fa';
import { getContacts, type Contact as ContactType } from '@/lib/contact';
import Link from 'next/link';

// --- TIPOS ---
interface Payment {
  id: string;
  amount: number;
  dueDate: string;
  status: 'pago' | 'aberto' | 'atrasado';
  description: string;
}

interface Client {
  id: string;
  companyName: string;
  cnpj: string;
  segment: string;
  contactId: string; // Referência ao contato (dono)
  project: string;
  plan: string;
  status: 'ativo' | 'inativo' | 'em_implantacao';
  payments: Payment[];
  createdAt: string;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [contacts, setContacts] = useState<ContactType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('todos');

  // Modais
  const [showClientModal, setShowClientModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  // Formulário
  const [formData, setFormData] = useState({
    companyName: '',
    cnpj: '',
    segment: '',
    contactId: '',
    project: '',
    plan: '',
    status: 'ativo' as 'ativo' | 'inativo' | 'em_implantacao',
  });

  // --- CARREGAMENTO ---
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const contactsData = await getContacts();
        setContacts(contactsData || []);

        // Simulação de dados de clientes (em um cenário real, viria de uma API)
        const mockClients: Client[] = [
          {
            id: '1',
            companyName: 'Tech Solutions Ltda',
            cnpj: '12.345.678/0001-90',
            segment: 'Tecnologia',
            contactId: contactsData?.[0]?.id || '',
            project: 'Implementação ERP',
            plan: 'Premium Mensal',
            status: 'ativo',
            createdAt: new Date().toISOString(),
            payments: [
              {
                id: 'p1',
                amount: 1500,
                dueDate: '2023-12-01',
                status: 'pago',
                description: 'Mensalidade Dezembro',
              },
              {
                id: 'p2',
                amount: 1500,
                dueDate: '2024-01-01',
                status: 'aberto',
                description: 'Mensalidade Janeiro',
              },
            ],
          },
          {
            id: '2',
            companyName: 'Padaria Central',
            cnpj: '98.765.432/0001-10',
            segment: 'Alimentação',
            contactId: contactsData?.[1]?.id || '',
            project: 'Consultoria Financeira',
            plan: 'Basic Anual',
            status: 'em_implantacao',
            createdAt: new Date().toISOString(),
            payments: [
              {
                id: 'p3',
                amount: 5000,
                dueDate: '2023-11-15',
                status: 'pago',
                description: 'Taxa Setup',
              },
              {
                id: 'p4',
                amount: 800,
                dueDate: '2023-12-15',
                status: 'atrasado',
                description: 'Mensalidade Dezembro',
              },
            ],
          },
        ];
        setClients(mockClients);
      } catch (error) {
        console.error('Erro ao carregar clientes:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  // --- FILTROS ---
  const filteredClients = useMemo(() => {
    return clients.filter((client) => {
      const matchesSearch =
        client.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.cnpj.includes(searchTerm);
      const matchesStatus =
        filterStatus === 'todos' || client.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [clients, searchTerm, filterStatus]);

  // --- HANDLERS ---
  const handleSaveClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingClient) {
      setClients(
        clients.map((c) =>
          c.id === editingClient.id ? { ...c, ...formData } : c,
        ),
      );
    } else {
      const newClient: Client = {
        id: Math.random().toString(36).substr(2, 9),
        ...formData,
        payments: [],
        createdAt: new Date().toISOString(),
      };
      setClients([...clients, newClient]);
    }
    setShowClientModal(false);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      companyName: '',
      cnpj: '',
      segment: '',
      contactId: '',
      project: '',
      plan: '',
      status: 'ativo',
    });
    setEditingClient(null);
  };

  const openEditModal = (client: Client) => {
    setEditingClient(client);
    setFormData({
      companyName: client.companyName,
      cnpj: client.cnpj,
      segment: client.segment,
      contactId: client.contactId,
      project: client.project,
      plan: client.plan,
      status: client.status,
    });
    setShowClientModal(true);
  };

  const handleDeleteClient = (id: string) => {
    if (confirm('Deseja realmente excluir este cliente?')) {
      setClients(clients.filter((c) => c.id !== id));
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      ativo: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
      inativo: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
      em_implantacao: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    };
    const labels = {
      ativo: 'Ativo',
      inativo: 'Inativo',
      em_implantacao: 'Em Implantação',
    };
    return (
      <span
        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
          styles[status as keyof typeof styles]
        }`}
      >
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  const getPaymentStatusIcon = (status: string) => {
    switch (status) {
      case 'pago':
        return <FaCheckCircle className="text-emerald-500" />;
      case 'aberto':
        return <FaClock className="text-amber-500" />;
      case 'atrasado':
        return <FaExclamationCircle className="text-rose-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background text-foreground p-6">
      {/* --- HEADER --- */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-3 rounded-xl">
            <FaBuilding className="text-primary text-2xl" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Gestão de Clientes
            </h1>
            <p className="text-sm text-muted-foreground">
              Empresas, projetos e controle financeiro
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs" />
            <input
              type="text"
              placeholder="Buscar empresa ou CNPJ..."
              className="pl-9 pr-4 py-2 bg-card border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none w-64 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <select
            className="bg-card border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="todos">Todos os Status</option>
            <option value="ativo">Ativos</option>
            <option value="em_implantacao">Em Implantação</option>
            <option value="inativo">Inativos</option>
          </select>

          <button
            onClick={() => {
              resetForm();
              setShowClientModal(true);
            }}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-all shadow-sm"
          >
            <FaPlus size={14} />
            <span>Novo Cliente</span>
          </button>
        </div>
      </header>

      {/* --- CLIENTS TABLE --- */}
      <main className="flex-1 overflow-hidden bg-card border border-border rounded-2xl shadow-sm flex flex-col">
        <div className="overflow-x-auto flex-1 scrollbar-thin">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-muted/50 backdrop-blur-md z-10">
              <tr>
                <th className="p-4 text-[10px] font-bold uppercase text-muted-foreground tracking-widest border-b">
                  Empresa / CNPJ
                </th>
                <th className="p-4 text-[10px] font-bold uppercase text-muted-foreground tracking-widest border-b">
                  Contato Principal
                </th>
                <th className="p-4 text-[10px] font-bold uppercase text-muted-foreground tracking-widest border-b">
                  Projeto / Plano
                </th>
                <th className="p-4 text-[10px] font-bold uppercase text-muted-foreground tracking-widest border-b">
                  Status
                </th>
                <th className="p-4 text-[10px] font-bold uppercase text-muted-foreground tracking-widest border-b">
                  Financeiro
                </th>
                <th className="p-4 text-[10px] font-bold uppercase text-muted-foreground tracking-widest border-b text-right">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filteredClients.map((client) => {
                const contact = contacts.find((c) => c.id === client.contactId);
                const pendingPayments = client.payments.filter(
                  (p) => p.status !== 'pago',
                ).length;

                return (
                  <tr
                    key={client.id}
                    className="hover:bg-muted/20 transition-colors group"
                  >
                    <td className="p-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-sm group-hover:text-primary transition-colors">
                          {client.companyName}
                        </span>
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {client.cnpj}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold">
                          {contact?.name?.[0] || '?'}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-medium">
                            {contact?.name || 'Não atrelado'}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {client.segment}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold">
                          {client.project}
                        </span>
                        <span className="text-[10px] text-primary font-bold">
                          {client.plan}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">{getStatusBadge(client.status)}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div
                          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold ${
                            pendingPayments > 0
                              ? 'bg-amber-500/10 text-amber-600'
                              : 'bg-emerald-500/10 text-emerald-600'
                          }`}
                        >
                          <FaFileInvoiceDollar size={10} />
                          {pendingPayments > 0
                            ? `${pendingPayments} Pendente(s)`
                            : 'Em dia'}
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/main/clientes/${client.id}`}
                          className="p-2 hover:bg-primary/10 text-muted-foreground hover:text-primary rounded-lg transition-all"
                          title="Ver Detalhes"
                        >
                          <FaChevronRight size={12} />
                        </Link>
                        <button
                          onClick={() => openEditModal(client)}
                          className="p-2 hover:bg-primary/10 text-muted-foreground hover:text-primary rounded-lg transition-all"
                        >
                          <FaEdit size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteClient(client.id)}
                          className="p-2 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-lg transition-all"
                        >
                          <FaTrash size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredClients.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="p-12 text-center text-muted-foreground"
                  >
                    <div className="flex flex-col items-center gap-2 opacity-50">
                      <FaBuilding size={40} />
                      <p className="font-medium">Nenhum cliente encontrado</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

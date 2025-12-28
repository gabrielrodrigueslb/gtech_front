'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  FaBuilding,
  FaArrowLeft,
  FaCheckCircle,
  FaClock,
  FaExclamationCircle,
  FaMoneyBillWave,
  FaUserTie,
  FaProjectDiagram,
  FaFileContract
} from 'react-icons/fa';

// --- TIPOS (Mesmos da listagem para manter consistência) ---
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
  contactId: string;
  project: string;
  plan: string;
  status: 'ativo' | 'inativo' | 'em_implantacao';
  payments: Payment[];
  createdAt: string;
}

// --- SIMULAÇÃO DE BANCO DE DADOS (API) ---
// Em um app real, isso viria de uma chamada fetch() ao backend
const getClientById = async (id: string): Promise<Client | undefined> => {
  // Simulando delay de rede
  await new Promise(resolve => setTimeout(resolve, 500));

  const mockClients: Client[] = [
    {
      id: '1',
      companyName: 'Tech Solutions Ltda',
      cnpj: '12.345.678/0001-90',
      segment: 'Tecnologia',
      contactId: 'c1',
      project: 'Implementação ERP',
      plan: 'Premium Mensal',
      status: 'ativo',
      createdAt: new Date().toISOString(),
      payments: [
        { id: 'p1', amount: 1500, dueDate: '2023-12-01', status: 'pago', description: 'Mensalidade Dezembro' },
        { id: 'p2', amount: 1500, dueDate: '2024-01-01', status: 'aberto', description: 'Mensalidade Janeiro' },
      ]
    },
    {
      id: '2',
      companyName: 'Padaria Central',
      cnpj: '98.765.432/0001-10',
      segment: 'Alimentação',
      contactId: 'c2',
      project: 'Consultoria Financeira',
      plan: 'Basic Anual',
      status: 'em_implantacao',
      createdAt: new Date().toISOString(),
      payments: [
        { id: 'p3', amount: 5000, dueDate: '2023-11-15', status: 'pago', description: 'Taxa Setup' },
        { id: 'p4', amount: 800, dueDate: '2023-12-15', status: 'atrasado', description: 'Mensalidade Dezembro' },
      ]
    }
  ];

  return mockClients.find(client => client.id === id);
};

// --- COMPONENTE PRINCIPAL ---
export default function ClientDetails() {
  const params = useParams();
  const router = useRouter();
  const [client, setClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Busca os dados quando a página carrega
  useEffect(() => {
    async function loadData() {
      if (!params?.id) return;
      
      setIsLoading(true);
      try {
        const data = await getClientById(params.id as string);
        setClient(data || null);
      } catch (error) {
        console.error("Erro ao buscar cliente", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [params?.id]);

  // Helpers de UI
  const getStatusBadge = (status: string) => {
    const styles = {
      ativo: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
      inativo: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
      em_implantacao: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    };
    const labels = { ativo: 'Ativo', inativo: 'Inativo', em_implantacao: 'Em Implantação' };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase border ${styles[status as keyof typeof styles] || ''}`}>
        {labels[status as keyof typeof labels] || status}
      </span>
    );
  };

  const getPaymentIcon = (status: string) => {
    switch (status) {
      case 'pago': return <FaCheckCircle className="text-emerald-500" />;
      case 'aberto': return <FaClock className="text-amber-500" />;
      case 'atrasado': return <FaExclamationCircle className="text-rose-500" />;
      default: return null;
    }
  };

  // --- RENDERIZAÇÃO ---

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-background text-foreground">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="h-12 w-12 bg-muted rounded-full"></div>
          <p className="text-muted-foreground">Carregando detalhes...</p>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-background text-foreground p-6">
        <h2 className="text-2xl font-bold mb-2">Cliente não encontrado</h2>
        <p className="text-muted-foreground mb-6">O ID solicitado não existe na base de dados.</p>
        <Link href="/clientes" className="bg-primary text-primary-foreground px-4 py-2 rounded-lg">
          Voltar para Lista
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background text-foreground p-6">
      
      {/* --- HEADER --- */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 shrink-0">
        <div className="flex items-center gap-4">
            <button 
                onClick={() => router.back()} 
                className="p-2 hover:bg-muted rounded-full transition-colors"
                title="Voltar"
            >
                <FaArrowLeft className="text-muted-foreground" />
            </button>
            <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-3 rounded-xl">
                    <FaBuilding className="text-primary text-2xl" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">{client.companyName}</h1>
                    <p className="text-sm text-muted-foreground">{client.cnpj} • {client.segment}</p>
                </div>
            </div>
        </div>

        <div className="flex items-center gap-3">
            {getStatusBadge(client.status)}
            <button className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90">
                Editar Cliente
            </button>
        </div>
      </header>

      {/* --- CONTEÚDO PRINCIPAL (GRID) --- */}
      <main className="flex-1 overflow-y-auto pr-2 grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLUNA ESQUERDA: Detalhes do Projeto */}
        <div className="lg:col-span-2 space-y-6">
            
            {/* Cards de Resumo */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-card border border-border p-4 rounded-xl shadow-sm flex items-center gap-4">
                    <div className="bg-blue-500/10 p-3 rounded-lg text-blue-500"><FaProjectDiagram size={20}/></div>
                    <div>
                        <p className="text-xs text-muted-foreground uppercase font-bold">Projeto</p>
                        <p className="font-semibold text-sm">{client.project}</p>
                    </div>
                </div>
                <div className="bg-card border border-border p-4 rounded-xl shadow-sm flex items-center gap-4">
                    <div className="bg-purple-500/10 p-3 rounded-lg text-purple-500"><FaFileContract size={20}/></div>
                    <div>
                        <p className="text-xs text-muted-foreground uppercase font-bold">Plano</p>
                        <p className="font-semibold text-sm">{client.plan}</p>
                    </div>
                </div>
                <div className="bg-card border border-border p-4 rounded-xl shadow-sm flex items-center gap-4">
                    <div className="bg-orange-500/10 p-3 rounded-lg text-orange-500"><FaUserTie size={20}/></div>
                    <div>
                        <p className="text-xs text-muted-foreground uppercase font-bold">Responsável</p>
                        <p className="font-semibold text-sm">Verificar ID {client.contactId}</p>
                    </div>
                </div>
            </div>

            {/* Histórico Financeiro */}
            <section className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-border flex justify-between items-center bg-muted/30">
                    <h3 className="font-bold flex items-center gap-2">
                        <FaMoneyBillWave className="text-emerald-500" />
                        Histórico Financeiro
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-muted/50 text-muted-foreground text-[10px] uppercase font-bold">
                            <tr>
                                <th className="p-3">Descrição</th>
                                <th className="p-3">Vencimento</th>
                                <th className="p-3">Valor</th>
                                <th className="p-3 text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {client.payments.map(pay => (
                                <tr key={pay.id} className="hover:bg-muted/20">
                                    <td className="p-3 font-medium">{pay.description}</td>
                                    <td className="p-3 text-muted-foreground">
                                        {new Date(pay.dueDate).toLocaleDateString('pt-BR')}
                                    </td>
                                    <td className="p-3 font-mono">
                                        R$ {pay.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-3 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <span className="text-xs capitalize">{pay.status}</span>
                                            {getPaymentIcon(pay.status)}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {client.payments.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="p-6 text-center text-muted-foreground">Nenhum pagamento registrado</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>

        {/* COLUNA DIREITA: Informações Adicionais */}
        <div className="space-y-6">
            <div className="bg-card border border-border rounded-xl shadow-sm p-6">
                <h3 className="font-bold mb-4 text-sm uppercase text-muted-foreground">Dados Cadastrais</h3>
                <div className="space-y-4 text-sm">
                    <div>
                        <span className="block text-muted-foreground text-xs">Razão Social</span>
                        <span className="font-medium">{client.companyName}</span>
                    </div>
                    <div>
                        <span className="block text-muted-foreground text-xs">CNPJ</span>
                        <span className="font-mono text-muted-foreground">{client.cnpj}</span>
                    </div>
                    <div>
                        <span className="block text-muted-foreground text-xs">Cliente desde</span>
                        <span>{new Date(client.createdAt).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <div className="pt-4 border-t border-border">
                        <button className="w-full bg-muted hover:bg-muted/80 text-foreground py-2 rounded-lg text-xs font-bold uppercase transition-colors">
                            Ver Contrato PDF
                        </button>
                    </div>
                </div>
            </div>
        </div>

      </main>
    </div>
  );
}
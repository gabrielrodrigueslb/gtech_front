import type { Deal } from '@/context/crm-context';
import type { Contact as ContactType } from '@/lib/contact';
import type { User } from '@/lib/user';
// ADICIONADO: novas funções importadas aqui
import { formatPhoneNumber, formatCurrency, parseCurrency } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { useFunnel } from '@/context/funnel-context';
import {
  FaCalendarAlt,
  FaGlobe,
  FaMapMarkerAlt,
  FaPhone,
  FaRegUser,
  FaLinkedin,
  FaInstagram,
  FaLink,
  FaBriefcase,
  FaEnvelope,
  FaHashtag,
  FaAlignLeft,
} from 'react-icons/fa';
import { FaDollarSign, FaUserTie } from 'react-icons/fa6';

// --- IMPORTS DO SHADCN ---
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';

// --- TIPAGEM ---
type DetailsFormData = {
  id: string;
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
  createdAt: string;
};

type DetailsModalProps = {
  selectedDeal: Deal;
  availableContacts: ContactType[];
  availableUsers: User[];
  onClose: () => void;
  onSave: (data: DetailsFormData) => Promise<void> | void;
};

// --- HELPER FUNCTIONS ---
const buildInitialFormData = (deal: Deal): DetailsFormData => ({
  id: deal.id || '',
  title: deal.title || '',
  description: deal.description || '',
  value: deal.value || 0,
  contactId: deal.contactId || '',
  contactNumber: deal.contactNumber
    ? formatPhoneNumber(deal.contactNumber)
    : '',
  website: deal.website || '',
  address: deal.address || '',
  clientRole: deal.clientRole || '',
  clientName: deal.clientName || '',
  clientPhone: deal.clientPhone ? formatPhoneNumber(deal.clientPhone) : '',
  clientEmail: deal.clientEmail || '',
  enderecoCliente: deal.enderecoCliente || '',
  redesSocial1: deal.redesSocial1 || '',
  redesSocial2: deal.redesSocial2 || '',
  linksExtras: deal.linksExtras || [],
  ownerId: deal.ownerId || deal.owner?.id || '',
  probability: deal.probability ?? 0,
  expectedClose: deal.expectedClose
    ? new Date(deal.expectedClose).toISOString().split('T')[0]
    : '',
  stageId: deal.stage || '',
  createdAt: deal.createdAt
    ? new Date(deal.createdAt).toISOString()
    : new Date().toISOString(),
});

// --- COMPONENTE INTERNO DE CAMPO ---
const Field = ({
  label,
  icon: Icon,
  children,
  className = '',
}: {
  label: string;
  icon?: any;
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={`space-y-2 ${className}`}>
    <label className="text-xs font-bold uppercase text-muted-foreground ml-1">
      {label}
    </label>
    <div className="relative group ">
      {Icon && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground z-10 pointer-events-none">
          <Icon size={14} />
        </div>
      )}
      {children}
    </div>
  </div>
);

export default function DetailsModal({
  selectedDeal,
  availableContacts,
  availableUsers,
  onClose,
  onSave,
}: DetailsModalProps) {
  const { activeFunnel } = useFunnel();
  const [activeTab, setActiveTab] = useState<
    'details' | 'client' | 'social' | 'links'
  >('details');
  const [formData, setFormData] = useState<DetailsFormData>(() =>
    buildInitialFormData(selectedDeal),
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setFormData(buildInitialFormData(selectedDeal));
  }, [selectedDeal]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(formData);
    } catch (error) {
      console.error('Erro ao salvar:', error);
    } finally {
      setIsSaving(false);
      onClose();
    }
  };

  const stageOptions = activeFunnel?.stages || [];

  useEffect(() => {
    if (!formData.stageId && stageOptions.length > 0) {
      setFormData((prev) => ({ ...prev, stageId: stageOptions[0].id }));
    }
  }, [formData.stageId, stageOptions]);

  const inputClass =
    'w-full bg-muted/30 border border-border rounded-xl pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-muted-foreground/50';

  const tabs = [
    { id: 'details', label: 'Negociação' },
    { id: 'client', label: 'Dados do Cliente' },
    { id: 'social', label: 'Redes Sociais' },
    { id: 'links', label: 'Links Úteis' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl border border-border animate-in zoom-in-95 duration-200 overflow-hidden">
        {/* HEADER */}
        <header className="flex-none p-6 border-b border-border bg-card">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4 w-full">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <FaDollarSign size={24} />
              </div>
              <div className="flex-1 space-y-2">
                <input
                  className="text-xl font-bold bg-transparent w-full outline-none border-b border-transparent focus:border-primary/50 transition-colors placeholder:text-muted-foreground/50"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="Título da Oportunidade"
                />

                <div className="flex items-center gap-3">
                  <Select
                    value={formData.stageId}
                    onValueChange={(value) =>
                      setFormData({ ...formData, stageId: value })
                    }
                  >
                    <SelectTrigger className="h-7 w-[180px] rounded-full border-border bg-muted/50 text-xs font-bold px-3">
                      <SelectValue placeholder="Selecione a etapa" />
                    </SelectTrigger>
                    <SelectContent>
                      {stageOptions.map((stage) => (
                        <SelectItem
                          key={stage.id}
                          value={stage.id}
                          className="text-xs font-medium"
                        >
                          {stage.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <span className="text-xs text-muted-foreground flex items-center gap-1 border-l border-border pl-3">
                    <FaCalendarAlt size={10} />
                    {new Date(formData.createdAt).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 -mr-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>

          {/* TABS */}
          <div className="flex items-center gap-1 mt-6 border-b border-border/50 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`
                  cursor-pointer px-4 py-2 text-sm font-medium transition-all relative top-px border-b-2
                  ${
                    activeTab === tab.id
                      ? 'text-primary border-primary bg-primary/5 rounded-t-lg'
                      : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/30 rounded-t-lg'
                  }
                `}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </header>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-6 bg-muted/5">
          <div className="max-w-3xl mx-auto space-y-6">
            {/* TAB 1: DETALHES GERAIS E FINANCEIRO */}
            {activeTab === 'details' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-left-2 duration-300">
                <Field label="Valor Estimado" icon={FaDollarSign}>
                  <input
                    type="text" 
                    className={inputClass}
                    value={formatCurrency(formData.value)}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        value: parseCurrency(e.target.value),
                      })
                    }
                  />
                </Field>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold uppercase text-muted-foreground ml-1">
                      Probabilidade
                    </label>
                    <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      {formData.probability}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    className="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
                    value={formData.probability}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        probability: Number(e.target.value),
                      })
                    }
                  />
                </div>

                <Field label="Previsão de Fechamento" icon={FaCalendarAlt}>
                  <input
                    type="date"
                    className={inputClass}
                    value={formData.expectedClose}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        expectedClose: e.target.value,
                      })
                    }
                  />
                </Field>

                <Field label="Responsável Interno" icon={FaUserTie}>
                  <Select
                    value={formData.ownerId}
                    onValueChange={(value) =>
                      setFormData({ ...formData, ownerId: value })
                    }
                  >
                    <SelectTrigger className="w-full rounded-xl bg-muted/30 pl-10 h-[42px]">
                      <SelectValue placeholder="Selecione um responsável..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Descrição" icon={''} className="md:col-span-2">
                  <textarea
                    className="w-full bg-muted/30 border border-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all min-h-[120px] resize-y"
                    placeholder="Detalhes sobre a negociação..."
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                  />
                </Field>
              </div>
            )}

            {/* TAB 2: CLIENTE */}
            {activeTab === 'client' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
                <h3 className="font-bold text-sm text-foreground mb-4">
                  Dados do Cliente
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Nome do Cliente" icon={FaRegUser}>
                    <input
                      type="text"
                      className={inputClass}
                      value={formData.clientName}
                      placeholder='Nome'
                      onChange={(e) =>
                        setFormData({ ...formData, clientName: e.target.value })
                      }
                    />
                  </Field>

                  <Field label="Cargo / Função" icon={FaBriefcase}>
                    <input
                      type="text"
                      className={inputClass}
                      value={formData.clientRole}
                      placeholder='Dono'
                      onChange={(e) =>
                        setFormData({ ...formData, clientRole: e.target.value })
                      }
                    />
                  </Field>

                  {/* ALTERAÇÃO AQUI: Formatação de Telefone no onChange */}
                  <Field label="Telefone" icon={FaPhone}>
                    <input
                      type="text"
                      className={inputClass}
                      value={formData.clientPhone}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          clientPhone: formatPhoneNumber(e.target.value),
                        })
                      }
                      placeholder="(00) 00000-0000"
                      maxLength={15}
                    />
                  </Field>

                  <Field label="Email" icon={FaEnvelope}>
                    <input
                      type="email"
                      className={inputClass}
                      value={formData.clientEmail}
                      placeholder='exemplo@email.com'
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          clientEmail: e.target.value,
                        })
                      }
                    />
                  </Field>

                  <Field
                    label="Endereço do Cliente"
                    icon={FaMapMarkerAlt}
                    className="md:col-span-2"
                  >
                    <input
                      type="text"
                      className={inputClass}
                      value={formData.enderecoCliente}
                      placeholder='Rua exemplo'
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          enderecoCliente: e.target.value,
                        })
                      }
                    />
                  </Field>
                </div>

                <div className="border-t border-border/50 my-4" />
                
                <div className="bg-primary/5 border border-primary/10 rounded-xl p-4">
                  <Field label="Vincular Contato do CRM" icon={FaHashtag}>
                    <Select
                      value={formData.contactId}
                      onValueChange={(value) =>
                        setFormData({ ...formData, contactId: value })
                      }
                    >
                      <SelectTrigger className="w-full rounded-xl bg-card pl-10 h-[42px]">
                        <SelectValue placeholder="Buscar contato existente..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableContacts.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <p className="text-[10px] text-muted-foreground mt-2 ml-1">
                    Isso preenche automaticamente os dados se o contato já
                    existir.
                  </p>
                </div>
              </div>
            )}

            {/* TAB 3: REDES SOCIAIS */}
            {activeTab === 'social' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
                <Field label="Website Principal" icon={FaGlobe}>
                  <input
                    type="text"
                    className={inputClass}
                    value={formData.website}
                    onChange={(e) =>
                      setFormData({ ...formData, website: e.target.value })
                    }
                    placeholder="https://..."
                  />
                </Field>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Instagram / Facebook" icon={FaInstagram}>
                    <input
                      type="text"
                      className={inputClass}
                      value={formData.redesSocial1}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          redesSocial1: e.target.value,
                        })
                      }
                      placeholder="@usuario"
                    />
                  </Field>

                  <Field label="LinkedIn / Outro" icon={FaLinkedin}>
                    <input
                      type="text"
                      className={inputClass}
                      value={formData.redesSocial2}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          redesSocial2: e.target.value,
                        })
                      }
                      placeholder="URL do Perfil"
                    />
                  </Field>
                </div>
              </div>
            )}

            {/* TAB 4: LINKS ÚTEIS */}
            {activeTab === 'links' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-300">
                <Field
                  label="Links Adicionais (Drive, Docs, Propostas)"
                  icon={''}
                >
                  <textarea
                    className="w-full bg-muted/30 border border-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all min-h-[200px] resize-none font-mono text-sm"
                    value={formData.linksExtras.join('\n')}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        linksExtras: e.target.value.split('\n'),
                      })
                    }
                    placeholder={`https://drive.google.com/...\nhttps://trello.com/...`}
                  />
                </Field>
                <p className="text-xs text-muted-foreground text-right">
                  Insira um link por linha.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* FOOTER */}
        <footer className="flex-none p-4 bg-muted/20 border-t border-border flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-all cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-8 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold shadow-lg hover:shadow-primary/25 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
          >
            {isSaving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </footer>
      </div>
    </div>
  );
}
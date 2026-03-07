'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Building2, Mail, Pencil, Phone, Tags, UserRound, X } from 'lucide-react'
import { getContactById, type Contact } from '@/lib/contact'
import { DEFAULT_WHATSAPP_CONTACT_TAGS, getContactTags } from '@/lib/whatsapp-client'
import type { ConversationPresence, WhatsAppConversation } from '@/types/Whatsapp.types'
import UserProfile from './UserProfile'

type ConversationDetailsDrawerProps = {
  isOpen: boolean
  onClose: () => void
  conversation: WhatsAppConversation | null
  presence: ConversationPresence | null
  avatarUrl: string | null
  onSave: (
    conversationId: string,
    payload: {
      name: string
      email?: string
      phone?: string
      segment?: string
      company?: string
      status?: string
      notes?: string
      tags?: string[]
    }
  ) => Promise<unknown>
}

type ContactFormState = {
  name: string
  email: string
  phone: string
  segment: string
  company: string
  status: string
  notes: string
  tags: string
}

const EMPTY_FORM: ContactFormState = {
  name: '',
  email: '',
  phone: '',
  segment: '',
  company: '',
  status: 'lead',
  notes: '',
  tags: '',
}

function getConversationPhone(conversation: WhatsAppConversation | null) {
  if (!conversation) return ''
  return conversation.phone ?? String(conversation.remoteJid ?? '').split('@')[0] ?? ''
}

function formatPhone(value?: string | null) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length === 13) {
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`
  }
  if (digits.length === 12) {
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`
  }
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  return digits
}

function getPresenceLabel(_presence: ConversationPresence | null, fallbackPhone?: string | null) {
  return formatPhone(fallbackPhone)
}

function createFormFromConversation(conversation: WhatsAppConversation | null, contact?: Contact | null) {
  if (!conversation) return EMPTY_FORM

  const source = contact ?? conversation.contact
  const phone = source?.phone ?? getConversationPhone(conversation)

  return {
    name: source?.name ?? conversation.pushName ?? phone,
    email: source?.email ?? '',
    phone,
    segment: source?.segment ?? '',
    company: source?.company ?? '',
    status: source?.status ?? 'lead',
    notes: source?.notes ?? '',
    tags: Array.isArray(source?.tags) ? source.tags.join(', ') : '',
  }
}

export default function ConversationDetailsDrawer({
  isOpen,
  onClose,
  conversation,
  presence,
  avatarUrl,
  onSave,
}: ConversationDetailsDrawerProps) {
  const [formData, setFormData] = useState<ContactFormState>(EMPTY_FORM)
  const [savedFormData, setSavedFormData] = useState<ContactFormState>(EMPTY_FORM)
  const [isLoadingContact, setIsLoadingContact] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [availableTags, setAvailableTags] = useState<string[]>(DEFAULT_WHATSAPP_CONTACT_TAGS)

  useEffect(() => {
    let isMounted = true

    async function loadAvailableTags() {
      try {
        const tags = await getContactTags()
        if (isMounted && tags.length > 0) {
          setAvailableTags(tags)
        }
      } catch (_) {}
    }

    loadAvailableTags()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    async function loadContact() {
      if (!isOpen || !conversation) return

      const shouldStartEditing = !conversation.contactId
      const baseFormData = createFormFromConversation(conversation)
      setFeedback(null)
      setIsEditing(shouldStartEditing)
      setIsLoadingContact(Boolean(conversation.contactId))
      setFormData(baseFormData)
      setSavedFormData(baseFormData)

      if (!conversation.contactId) {
        setIsLoadingContact(false)
        return
      }

      try {
        const fullContact = await getContactById(conversation.contactId)
        if (!isMounted) return
        const nextFormData = createFormFromConversation(conversation, fullContact)
        setFormData(nextFormData)
        setSavedFormData(nextFormData)
      } catch (_) {
        if (isMounted) {
          setFormData(baseFormData)
          setSavedFormData(baseFormData)
        }
      } finally {
        if (isMounted) setIsLoadingContact(false)
      }
    }

    loadContact()

    return () => {
      isMounted = false
    }
  }, [conversation, isOpen])

  if (!isOpen || !conversation) return null

  const basePhone = getConversationPhone(conversation)
  const displayPhone = formatPhone(formData.phone || basePhone)
  const contactName =
    formData.name || conversation.contact?.name || conversation.pushName || basePhone || 'Contato'
  const tagList = formData.tags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)

  function toggleTag(tag: string) {
    const nextTags = tagList.includes(tag)
      ? tagList.filter((item) => item !== tag)
      : [...tagList, tag]

    setFormData((prev) => ({
      ...prev,
      tags: nextTags.join(', '),
    }))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!conversation || !formData.name.trim()) return

    setIsSaving(true)
    setFeedback(null)

    try {
      await onSave(conversation.id, {
        name: formData.name.trim(),
        email: formData.email.trim() || undefined,
        phone: formData.phone.trim() || basePhone,
        segment: formData.segment.trim() || undefined,
        company: formData.company.trim() || undefined,
        status: formData.status,
        notes: formData.notes.trim() || undefined,
        tags: tagList,
      })

      const nextSavedFormData = {
        ...formData,
        phone: formData.phone.trim() || basePhone,
      }
      setFormData(nextSavedFormData)
      setSavedFormData(nextSavedFormData)
      setFeedback('Contato salvo com sucesso.')
      setIsEditing(false)
    } catch (_) {
      setFeedback('Nao foi possivel salvar o contato.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50">
      <button type="button" aria-label="Fechar detalhes" className="flex-1 cursor-pointer" onClick={onClose} />

      <aside className="h-full w-full max-w-[390px] border-l border-white/10 bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-white/45">Detalhes do cliente</p>
            <h3 className="text-lg font-semibold">Perfil do atendimento</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setFeedback(null)
                if (isEditing) {
                  setFormData(savedFormData)
                  setIsEditing(false)
                  return
                }
                setIsEditing(true)
              }}
              className="rounded-full border border-white/10 p-2 text-white/65 transition hover:bg-white/5 hover:text-white cursor-pointer"
              title={isEditing ? 'Voltar para visualizacao' : 'Editar contato'}
            >
              <Pencil size={16} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/10 p-2 text-white/65 transition hover:bg-white/5 hover:text-white cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="h-[calc(100%-81px)] overflow-y-auto">
          <div className="border-b border-white/10 px-6 py-8 text-center">
            <div className="flex justify-center">
              <div className="scale-[1.4] origin-center">
                <UserProfile
                  username={contactName}
                  avatarUrl={avatarUrl}
                />
              </div>
            </div>

            <h4 className="mt-6 text-2xl font-semibold">{contactName}</h4>
            <p className="mt-2 text-sm text-white/55">{displayPhone}</p>
          </div>

          <div className="px-6 py-6">
            {isEditing ? (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <Field label="Nome">
                  <input
                    value={formData.name}
                    onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                    className="w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-sm outline-none"
                    placeholder="Nome do contato"
                    disabled={isLoadingContact || isSaving}
                  />
                </Field>

                <Field label="Telefone">
                  <input
                    value={formData.phone}
                    onChange={(event) => setFormData((prev) => ({ ...prev, phone: event.target.value }))}
                    className="w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-sm outline-none"
                    placeholder="Telefone"
                    disabled={isLoadingContact || isSaving}
                  />
                </Field>

                <Field label="Email">
                  <input
                    value={formData.email}
                    onChange={(event) => setFormData((prev) => ({ ...prev, email: event.target.value }))}
                    className="w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-sm outline-none"
                    placeholder="Email"
                    disabled={isLoadingContact || isSaving}
                  />
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Empresa">
                    <input
                      value={formData.company}
                      onChange={(event) => setFormData((prev) => ({ ...prev, company: event.target.value }))}
                      className="w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-sm outline-none"
                      placeholder="Empresa"
                      disabled={isLoadingContact || isSaving}
                    />
                  </Field>

                  <Field label="Segmento">
                    <input
                      value={formData.segment}
                      onChange={(event) => setFormData((prev) => ({ ...prev, segment: event.target.value }))}
                      className="w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-sm outline-none"
                      placeholder="Segmento"
                      disabled={isLoadingContact || isSaving}
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Status">
                    <select
                      value={formData.status}
                      onChange={(event) => setFormData((prev) => ({ ...prev, status: event.target.value }))}
                      className="w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-sm outline-none cursor-pointer"
                      disabled={isLoadingContact || isSaving}
                    >
                      <option value="lead">Lead</option>
                      <option value="prospect">Prospect</option>
                      <option value="customer">Cliente</option>
                      <option value="inactive">Inativo</option>
                    </select>
                  </Field>

                  <Field label="Tags">
                    <div className="flex min-h-[52px] items-center rounded-2xl border border-white/10 bg-background px-4 py-3 text-sm text-white/50">
                      {tagList.length > 0 ? `${tagList.length} tag(s) selecionada(s)` : 'Selecione abaixo'}
                    </div>
                  </Field>
                </div>

                <Field label="Selecionar tags">
                  <div className="flex flex-wrap gap-2">
                    {availableTags.map((tag) => {
                      const isSelected = tagList.includes(tag)
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleTag(tag)}
                          disabled={isLoadingContact || isSaving}
                          className={`rounded-full border px-3 py-2 text-xs font-medium transition disabled:opacity-50 cursor-pointer ${
                            isSelected
                              ? 'border-primary bg-primary/20 text-primary'
                              : 'border-white/10 bg-white/3 text-white/65 hover:bg-white/8'
                          }`}
                        >
                          {tag}
                        </button>
                      )
                    })}
                  </div>
                </Field>

                <Field label="Descricao / observacoes">
                  <textarea
                    value={formData.notes}
                    onChange={(event) => setFormData((prev) => ({ ...prev, notes: event.target.value }))}
                    rows={6}
                    className="w-full resize-none rounded-2xl border border-white/10 bg-background px-4 py-3 text-sm outline-none"
                    placeholder="Contexto, historico, preferencias e observacoes"
                    disabled={isLoadingContact || isSaving}
                  />
                </Field>

                {feedback && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
                    {feedback}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
              <button
                  type="button"
                    onClick={() => {
                      setFormData(savedFormData)
                      setFeedback(null)
                      setIsEditing(false)
                    }}
                    disabled={isSaving}
                    className="flex-1 rounded-2xl border border-white/10 px-4 py-3 text-sm transition hover:bg-white/5 disabled:opacity-50 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving || isLoadingContact || !formData.name.trim()}
                    className="flex-1 rounded-2xl bg-primary px-4 py-3 text-sm font-medium transition hover:opacity-90 disabled:opacity-50 cursor-pointer"
                  >
                    {isSaving ? 'Salvando...' : conversation.contactId ? 'Salvar' : 'Criar contato'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex flex-col gap-6">
                <Section title="Informacoes de contato">
                  <InfoRow icon={<Mail size={16} />} value={formData.email || 'Email nao informado'} />
                  <InfoRow icon={<Phone size={16} />} value={displayPhone || 'Telefone nao informado'} />
                  <InfoRow icon={<Building2 size={16} />} value={formData.company || formData.segment || 'Sem empresa ou segmento'} />
                </Section>

                <Section title="Descricao">
                  <div className="rounded-3xl border border-white/10 bg-white/3 px-4 py-5 text-sm leading-6 text-white/72">
                    {formData.notes || 'Nenhuma descricao adicionada ate o momento.'}
                  </div>
                </Section>

                <Section title="Resumo do atendimento">
                  <div className="grid grid-cols-2 gap-3">
                    <DataCard label="Responsavel" value={conversation.assignedUser?.name ?? 'Nao atribuido'} />
                    <DataCard label="Status CRM" value={formData.status || 'lead'} />
                  </div>
                </Section>

                <Section title="Tags do cliente">
                  {tagList.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {tagList.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/75"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-2xl border border-dashed border-white/10 px-4 py-4 text-sm text-white/45">
                      <Tags size={16} />
                      Nenhuma tag cadastrada
                    </div>
                  )}
                </Section>

                <button
                  type="button"
                  onClick={() => {
                    setFeedback(null)
                    setIsEditing(true)
                  }}
                  className="rounded-2xl bg-primary px-4 py-3 text-sm font-medium transition hover:opacity-90 cursor-pointer"
                >
                  {conversation.contactId ? 'Editar contato' : 'Adicionar contato ao CRM'}
                </button>

                {feedback && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
                    {feedback}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-xs uppercase tracking-[0.18em] text-white/42">{label}</span>
      {children}
    </label>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h5 className="text-xs uppercase tracking-[0.22em] text-white/38">{title}</h5>
      {children}
    </section>
  )
}

function InfoRow({ icon, value }: { icon: ReactNode; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/72">
      <span className="text-white/45">{icon}</span>
      <span className="min-w-0 truncate">{value}</span>
    </div>
  )
}

function DataCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
      <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">{label}</p>
      <p className="mt-2 flex items-center gap-2 text-sm font-medium text-white/75">
        <UserRound size={14} className="text-white/35" />
        <span className="truncate">{value}</span>
      </p>
    </div>
  )
}

'use client'

import { CirclePlus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { getContacts, type Contact } from '@/lib/contact'
import { openConversation } from '@/lib/whatsapp-client'
import { useWhatsApp } from '@/context/Whatsappcontext'

function normalizePhone(phone: string) {
  return String(phone ?? '').replace(/\D/g, '')
}

function buildPhoneCandidates(phone: string) {
  const digits = normalizePhone(phone)
  if (!digits) return []

  const normalized = (digits.length === 10 || digits.length === 11) && !digits.startsWith('55')
    ? `55${digits}`
    : digits

  const candidates = new Set<string>([normalized])
  const withoutCountryCode = normalized.startsWith('55') ? normalized.slice(2) : normalized

  if (withoutCountryCode) candidates.add(withoutCountryCode)

  if (normalized.startsWith('55')) {
    const areaCode = normalized.slice(2, 4)
    const localNumber = normalized.slice(4)

    if (localNumber.length === 9 && localNumber.startsWith('9')) {
      candidates.add(`55${areaCode}${localNumber.slice(1)}`)
      candidates.add(`${areaCode}${localNumber.slice(1)}`)
    }

    if (localNumber.length === 8) {
      candidates.add(`55${areaCode}9${localNumber}`)
      candidates.add(`${areaCode}9${localNumber}`)
    }
  }

  return Array.from(candidates).filter(Boolean)
}

function findContactByPhone(contacts: Contact[], phone: string) {
  const candidates = buildPhoneCandidates(phone)
  if (!candidates.length) return null

  return (
    contacts.find((contact) => {
      const contactPhone = normalizePhone(contact.phone ?? '')
      if (!contactPhone) return false

      return candidates.some(
        (candidate) =>
          contactPhone === candidate ||
          contactPhone.includes(candidate) ||
          candidate.includes(contactPhone)
      )
    }) ?? null
  )
}

export default function NewConversationButton() {
  const { registerConversation, setActiveConversation } = useWhatsApp()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [mode, setMode] = useState<'manual' | 'saved'>('manual')
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [initialMessage, setInitialMessage] = useState('')
  const [contactSearchQuery, setContactSearchQuery] = useState('')
  const [savedContacts, setSavedContacts] = useState<Contact[]>([])
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)
  const [isLoadingContacts, setIsLoadingContacts] = useState(false)
  const [hasLoadedContacts, setHasLoadedContacts] = useState(false)
  const [hasManualNameOverride, setHasManualNameOverride] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const selectedContact = useMemo(
    () => savedContacts.find((contact) => contact.id === selectedContactId) ?? null,
    [savedContacts, selectedContactId]
  )
  const matchedSavedContact = useMemo(
    () => (mode === 'manual' ? findContactByPhone(savedContacts, phone) : null),
    [mode, phone, savedContacts]
  )
  const filteredSavedContacts = useMemo(() => {
    const search = contactSearchQuery.trim().toLowerCase()
    if (!search) return savedContacts

    return savedContacts.filter((contact) => {
      const phoneText = String(contact.phone ?? '').toLowerCase()
      const nameText = String(contact.name ?? '').toLowerCase()
      const emailText = String(contact.email ?? '').toLowerCase()

      return (
        nameText.includes(search) ||
        emailText.includes(search) ||
        phoneText.includes(search) ||
        normalizePhone(phoneText).includes(normalizePhone(search))
      )
    })
  }, [contactSearchQuery, savedContacts])

  useEffect(() => {
    if (!isModalOpen || hasLoadedContacts) return

    let cancelled = false

    async function loadContacts() {
      setIsLoadingContacts(true)

      try {
        const contacts = await getContacts()
        if (cancelled) return
        setSavedContacts(Array.isArray(contacts) ? contacts : [])
        setHasLoadedContacts(true)
      } catch (_) {
        if (!cancelled) setError('Nao foi possivel carregar os contatos salvos.')
      } finally {
        if (!cancelled) setIsLoadingContacts(false)
      }
    }

    loadContacts()

    return () => {
      cancelled = true
    }
  }, [hasLoadedContacts, isModalOpen])

  useEffect(() => {
    if (!selectedContact) return

    setPhone(selectedContact.phone ?? '')
    setName(selectedContact.name ?? '')
    setHasManualNameOverride(false)
    setError(null)
  }, [selectedContact])

  useEffect(() => {
    if (mode !== 'manual' || hasManualNameOverride) return
    setName(matchedSavedContact?.name ?? '')
  }, [hasManualNameOverride, matchedSavedContact, mode])

  function resetForm() {
    setMode('manual')
    setPhone('')
    setName('')
    setInitialMessage('')
    setContactSearchQuery('')
    setSelectedContactId(null)
    setHasManualNameOverride(false)
    setError(null)
  }

  function openModal() {
    setIsModalOpen(true)
    setError(null)
  }

  function closeModal() {
    setIsModalOpen(false)
    resetForm()
  }

  async function handleSubmit() {
    const contactFromSelection = selectedContact ?? matchedSavedContact
    const resolvedPhone = contactFromSelection?.phone ?? phone
    const resolvedName = contactFromSelection?.name ?? name

    if (!resolvedPhone.trim()) {
      setError('Informe o telefone do atendimento.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const conversation = await openConversation({
        phone: resolvedPhone,
        contactId: contactFromSelection?.id,
        name: resolvedName,
        initialMessage,
      })

      registerConversation(conversation)
      closeModal()
      await setActiveConversation(conversation.id)
    } catch (submitError: any) {
      setError(submitError?.response?.data?.error ?? 'Nao foi possivel abrir o atendimento.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="bg-primary font-semibold flex gap-2 items-center justify-center  p-2.5 rounded-xl cursor-pointer hover:opacity-80 transition-opacity shrink-0"
      >
        <CirclePlus size={20}/>
      </button>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-card p-6 shadow-2xl">
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">Abrir atendimento</h3>
              <p className="text-sm opacity-70">
                Escolha um contato salvo ou informe o telefone para criar o atendimento.
              </p>
            </div>

            <div className="mt-5 space-y-4">
              <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-background/70 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setMode('manual')
                    setSelectedContactId(null)
                    setContactSearchQuery('')
                    setHasManualNameOverride(false)
                    setError(null)
                  }}
                  className={`rounded-xl px-3 py-2 text-sm font-medium transition cursor-pointer ${
                    mode === 'manual'
                      ? 'bg-primary text-white'
                      : 'text-white/70 hover:bg-white/5'
                  }`}
                >
                  Numero manual
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('saved')
                    setPhone('')
                    setName('')
                    setSelectedContactId(null)
                    setHasManualNameOverride(false)
                    setError(null)
                  }}
                  className={`rounded-xl px-3 py-2 text-sm font-medium transition cursor-pointer ${
                    mode === 'saved'
                      ? 'bg-primary text-white'
                      : 'text-white/70 hover:bg-white/5'
                  }`}
                >
                  Contato salvo
                </button>
              </div>

              {mode === 'saved' ? (
                <div className="space-y-3">
                  <input
                    value={contactSearchQuery}
                    onChange={(event) => setContactSearchQuery(event.target.value)}
                    placeholder="Busque por nome, email ou telefone"
                    className="w-full rounded-xl border border-white/10 bg-background px-4 py-3 text-sm outline-none"
                  />

                  <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                    {isLoadingContacts && (
                      <div className="rounded-xl border border-white/10 bg-background/60 px-4 py-3 text-sm text-white/70">
                        Carregando contatos...
                      </div>
                    )}

                    {!isLoadingContacts && filteredSavedContacts.length === 0 && (
                      <div className="rounded-xl border border-dashed border-white/10 bg-background/40 px-4 py-4 text-sm text-white/55">
                        Nenhum contato salvo encontrado.
                      </div>
                    )}

                    {!isLoadingContacts &&
                      filteredSavedContacts.map((contact) => {
                        const isSelected = selectedContactId === contact.id
                        const hasPhone = Boolean(contact.phone?.trim())

                        return (
                          <button
                            key={contact.id}
                            type="button"
                            disabled={!hasPhone}
                            onClick={() => {
                              setSelectedContactId(contact.id)
                              setError(null)
                            }}
                            className={`w-full rounded-2xl border px-4 py-3 text-left transition cursor-pointer ${
                              isSelected
                                ? 'border-primary/40 bg-primary/12'
                                : 'border-white/10 bg-background/50 hover:bg-white/5'
                            } ${!hasPhone ? 'cursor-not-allowed opacity-50' : ''}`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{contact.name}</p>
                                <p className="truncate text-xs text-white/55">
                                  {contact.phone || 'Contato sem telefone cadastrado'}
                                </p>
                              </div>
                              {isSelected && <span className="text-xs text-primary">Selecionado</span>}
                            </div>
                          </button>
                        )
                      })}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <input
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value)
                      setError(null)
                    }}
                    placeholder="Telefone com DDD ou codigo do pais (com ou sem 9)"
                    className="w-full rounded-xl border border-white/10 bg-background px-4 py-3 text-sm outline-none"
                  />

                  {matchedSavedContact && (
                    <div className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-white/80">
                      Contato salvo identificado: <span className="font-medium">{matchedSavedContact.name}</span>
                    </div>
                  )}

                  <input
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value)
                      setHasManualNameOverride(true)
                    }}
                    placeholder="Nome do contato (opcional)"
                    className="w-full rounded-xl border border-white/10 bg-background px-4 py-3 text-sm outline-none"
                  />
                </div>
              )}

              <textarea
                value={initialMessage}
                onChange={(e) => setInitialMessage(e.target.value)}
                rows={4}
                placeholder="Mensagem inicial (opcional)"
                className="w-full resize-none rounded-xl border border-white/10 bg-background px-4 py-3 text-sm outline-none"
              />

              {error && (
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                  {error}
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={closeModal}
                className="rounded-xl border border-white/10 px-4 py-3 text-sm transition hover:bg-white/5 disabled:opacity-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSubmit}
                className="rounded-xl bg-primary px-4 py-3 text-sm font-medium transition hover:opacity-90 disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? 'Abrindo...' : 'Abrir atendimento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

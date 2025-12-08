"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { getContacts, createContact, updateContact, deleteContact, type Contact } from "@/lib/contact"

export default function Contacts() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  
  const [showModal, setShowModal] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    company: "", 
    segment: "",
    status: "lead" as any, 
    notes: "",
  })

  // --- FUNÇÃO AUXILIAR DE FORMATAÇÃO DE TELEFONE ---
  const formatPhoneNumber = (value: string) => {
    // 1. Remove tudo que não é número
    const numbers = value.replace(/\D/g, "")
    
    // 2. Limita a 11 dígitos (DDD + 9 dígitos)
    const limited = numbers.substring(0, 11)

    // 3. Aplica a máscara
    // Se tiver mais que 10 dígitos, é celular: (99) 99999-9999
    // Se não, é fixo: (99) 9999-9999
    return limited
      .replace(/^(\d{2})(\d)/g, "($1) $2") // Coloca parênteses em volta dos dois primeiros dígitos
      .replace(/(\d)(\d{4})$/, "$1-$2")    // Coloca hífen antes dos últimos 4 dígitos
  }

  // --- CARREGAR CONTATOS ---
  useEffect(() => {
    loadContacts()
  }, [])

  async function loadContacts() {
    setIsLoading(true)
    try {
      const data = await getContacts()
      setContacts(data || [])
    } catch (error) {
      console.error("Erro ao carregar contatos:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // --- FILTROS ---
  const filteredContacts = contacts.filter((contact) => {
    const matchesSearch =
      contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (contact.email || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (contact.company || "").toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = filterStatus === "all" || contact.status === filterStatus
    return matchesSearch && matchesStatus
  })

  // --- AÇÕES ---
  const openModal = (contact?: Contact) => {
    if (contact) {
      setEditingContact(contact)
      setFormData({
        name: contact.name,
        email: contact.email || "",
        phone: contact.phone || "", // Já virá do banco, assumimos que está ou limpo ou formatado
        company: contact.company || "",
        segment: contact.segment || "",
        status: contact.status || "lead",
        notes: contact.notes || "",
      })
    } else {
      setEditingContact(null)
      setFormData({ name: "", email: "", phone: "", company: "", segment: "", status: "lead", notes: "" })
    }
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingContact) {
        // Editar
        await updateContact(editingContact.id, formData)
        setContacts(prev => prev.map(c => c.id === editingContact.id ? { ...c, ...formData } : c))
      } else {
        // Criar
        const newContact = await createContact(formData)
        setContacts(prev => [...prev, newContact])
      }
      setShowModal(false)
    } catch (error) {
      console.error("Erro ao salvar contato:", error)
      alert("Erro ao salvar contato")
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm("Deseja realmente excluir este contato?")) {
      try {
        await deleteContact(id)
        setContacts(prev => prev.filter(c => c.id !== id))
      } catch (error) {
        console.error("Erro ao excluir:", error)
        alert("Erro ao excluir contato")
      }
    }
  }

  return (
    <div>
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-2">Contatos</h1>
          <p style={{ color: "var(--color-muted-foreground)" }}>Gerencie seus contatos e leads</p>
        </div>
        <button className="btn btn-primary" onClick={() => openModal()}>
          + Novo Contato
        </button>
      </header>

      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <input
            type="text"
            placeholder="Buscar contatos..."
            className="input flex-1"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select
            className="input"
            style={{ width: "auto" }}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">Todos os status</option>
            <option value="lead">Lead</option>
            <option value="prospect">Prospect</option>
            <option value="customer">Cliente</option>
            <option value="inactive">Inativo</option>
          </select>
        </div>
      </div>

      <div className="card overflow-hidden p-0">
        {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando contatos...</div>
        ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Contato</th>
              <th>Segmento/Empresa</th>
              <th>Telefone</th>
              <th>Data</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredContacts.map((contact) => (
              <tr key={contact.id}>
                <td>
                  <div className="flex items-center gap-3">
                    <div
                      className="avatar"
                      style={{
                        backgroundColor: "var(--color-accent)",
                        color: "var(--color-primary-foreground)",
                      }}
                    >
                      {contact.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium">{contact.name}</p>
                      <p className="text-sm" style={{ color: "var(--color-muted-foreground)" }}>
                        {contact.email}
                      </p>
                    </div>
                  </div>
                </td>
                <td>{contact.segment || contact.company || "-"}</td>
                <td style={{ color: "var(--color-muted-foreground)" }}>{contact.phone}</td>
                <td style={{ color: "var(--color-muted-foreground)" }}>
                  {contact.createdAt ? new Date(contact.createdAt).toLocaleDateString("pt-BR") : "-"}
                </td>
                <td>
                  <div className="flex gap-2">
                    <button
                      className="btn btn-ghost"
                      style={{ padding: "6px 10px" }}
                      onClick={() => openModal(contact)}
                    >
                      Editar
                    </button>
                    <button
                      className="btn btn-ghost"
                      style={{ padding: "6px 10px", color: "var(--color-danger)" }}
                      onClick={() => handleDelete(contact.id)}
                    >
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
        {!isLoading && filteredContacts.length === 0 && (
          <div className="text-center py-12" style={{ color: "var(--color-muted-foreground)" }}>
            Nenhum contato encontrado
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-6">{editingContact ? "Editar Contato" : "Novo Contato"}</h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Nome</label>
                <input
                  type="text"
                  className="input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <input
                  type="email"
                  className="input"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Telefone / Celular</label>
                    <input
                      type="tel"
                      className="input"
                      value={formData.phone}
                      maxLength={15} // Limita o tamanho: (11) 99999-9999
                      onChange={(e) => {
                        const formatted = formatPhoneNumber(e.target.value)
                        setFormData({ ...formData, phone: formatted })
                      }}
                      placeholder="(99) 99999-9999"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Segmento</label>
                    <input
                      type="text"
                      className="input"
                      value={formData.segment}
                      onChange={(e) => setFormData({ ...formData, segment: e.target.value })}
                    />
                  </div>
              </div>
              <div className="flex gap-3 mt-4">
                <button type="button" className="btn btn-secondary flex-1" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary flex-1">
                  {editingContact ? "Salvar" : "Criar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
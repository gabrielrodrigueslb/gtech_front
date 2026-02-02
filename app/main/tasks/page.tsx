"use client"

import type React from "react"

import { useState } from "react"
import { useCRM, type Task } from "@/context/crm-context"
import { FaTasks } from "react-icons/fa";

export default function Tasks() {
  const { tasks, contacts, deals, addTask, updateTask, deleteTask } = useCRM()
  const [activeFilter, setActiveFilter] = useState<string>("all")
  const [showModal, setShowModal] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    dueDate: "",
    priority: "medium" as Task["priority"],
    status: "pending" as Task["status"],
    contactId: "",
    dealId: "",
  })

  const filteredTasks = tasks.filter((task) => {
    if (activeFilter === "all") return true
    if (activeFilter === "pending") return task.status === "pending"
    if (activeFilter === "in-progress") return task.status === "in-progress"
    if (activeFilter === "completed") return task.status === "completed"
    return true
  })

  const sortedTasks = [...filteredTasks].sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 }
    return priorityOrder[a.priority] - priorityOrder[b.priority]
  })

  const openModal = (task?: Task) => {
    if (task) {
      setEditingTask(task)
      setFormData({
        title: task.title,
        description: task.description || "",
        dueDate: new Date(task.dueDate).toISOString().split("T")[0],
        priority: task.priority,
        status: task.status,
        contactId: task.contactId || "",
        dealId: task.dealId || "",
      })
    } else {
      setEditingTask(null)
      setFormData({
        title: "",
        description: "",
        dueDate: "",
        priority: "medium",
        status: "pending",
        contactId: "",
        dealId: "",
      })
    }
    setShowModal(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const taskData = {
      ...formData,
      dueDate: new Date(formData.dueDate),
      contactId: formData.contactId || undefined,
      dealId: formData.dealId || undefined,
    }
    if (editingTask) {
      updateTask(editingTask.id, taskData)
    } else {
      addTask(taskData)
    }
    setShowModal(false)
  }

  const toggleStatus = (task: Task) => {
    const newStatus = task.status === "completed" ? "pending" : task.status === "pending" ? "in-progress" : "completed"
    updateTask(task.id, { status: newStatus })
  }

  const priorityColors = {
    high: "var(--color-danger)",
    medium: "var(--color-warning)",
    low: "var(--color-muted)",
  }

  const statusLabels = {
    pending: "Pendente",
    "in-progress": "Em Andamento",
    completed: "Concluída",
  }

  return (
    <div>
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-lg">
            <FaTasks className="text-primary text-2xl" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Tarefas</h1>
            <p className="text-sm text-muted-foreground">
              Gerencie suas atividades e compromissos
            </p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => openModal()}>
          + Nova Tarefa
        </button>
      </header>

      <div className="flex gap-2 mb-6 flex-wrap">
        {[
          { id: "all", label: "Todas" },
          { id: "pending", label: "Pendentes" },
          { id: "in-progress", label: "Em Andamento" },
          { id: "completed", label: "Concluídas" },
        ].map((filter) => (
          <button
            key={filter.id}
            className={`tab ${activeFilter === filter.id ? "active" : ""}`}
            onClick={() => setActiveFilter(filter.id)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {sortedTasks.map((task) => {
          const contact = contacts.find((c) => c.id === task.contactId)
          const deal = deals.find((d) => d.id === task.dealId)
          const isOverdue = new Date(task.dueDate) < new Date() && task.status !== "completed"

          return (
            <div
              key={task.id}
              className="card flex items-start gap-4"
              style={{ opacity: task.status === "completed" ? 0.6 : 1 }}
            >
              <button
                className="w-6 h-6 rounded-full border-2 shrink-0 flex items-center justify-center mt-0.5"
                style={{
                  borderColor: task.status === "completed" ? "var(--color-success)" : "var(--color-border)",
                  backgroundColor: task.status === "completed" ? "var(--color-success)" : "transparent",
                }}
                onClick={() => toggleStatus(task)}
              >
                {task.status === "completed" && (
                  <span style={{ color: "var(--color-primary-foreground)", fontSize: 12 }}>✓</span>
                )}
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3
                      className="font-medium"
                      style={{ textDecoration: task.status === "completed" ? "line-through" : "none" }}
                    >
                      {task.title}
                    </h3>
                    {task.description && (
                      <p className="text-sm mt-1" style={{ color: "var(--color-muted-foreground)" }}>
                        {task.description}
                      </p>
                    )}
                  </div>
                  <button className="btn btn-ghost" style={{ padding: "4px 8px" }} onClick={() => openModal(task)}>
                    Editar
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-3 mt-3">
                  <span
                    className="inline-flex items-center gap-1 text-sm"
                    style={{ color: isOverdue ? "var(--color-danger)" : "var(--color-muted-foreground)" }}
                  >
                    {new Date(task.dueDate).toLocaleDateString("pt-BR")}
                  </span>
                  <span
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded"
                    style={{
                      backgroundColor: `${priorityColors[task.priority]}20`,
                      color: priorityColors[task.priority],
                    }}
                  >
                    {task.priority === "high" ? "Alta" : task.priority === "medium" ? "Média" : "Baixa"}
                  </span>
                  {contact && (
                    <span className="text-sm" style={{ color: "var(--color-muted-foreground)" }}>
                      {contact.name}
                    </span>
                  )}
                  {deal && (
                    <span className="text-sm" style={{ color: "var(--color-primary)" }}>
                      {deal.title}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {sortedTasks.length === 0 && (
          <div className="card text-center py-12" style={{ color: "var(--color-muted-foreground)" }}>
            Nenhuma tarefa encontrada
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">{editingTask ? "Editar Tarefa" : "Nova Tarefa"}</h2>
              {editingTask && (
                <button
                  className="btn btn-ghost"
                  style={{ color: "var(--color-danger)", padding: "6px 12px" }}
                  onClick={() => {
                    deleteTask(editingTask.id)
                    setShowModal(false)
                  }}
                >
                  Excluir
                </button>
              )}
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Título</label>
                <input
                  type="text"
                  className="input"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Descrição</label>
                <textarea
                  className="input"
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Data de Vencimento</label>
                  <input
                    type="date"
                    className="input"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Prioridade</label>
                  <select
                    className="input"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as Task["priority"] })}
                  >
                    <option value="low">Baixa</option>
                    <option value="medium">Média</option>
                    <option value="high">Alta</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Status</label>
                <select
                  className="input"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as Task["status"] })}
                >
                  <option value="pending">Pendente</option>
                  <option value="in-progress">Em Andamento</option>
                  <option value="completed">Concluída</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Contato (opcional)</label>
                <select
                  className="input"
                  value={formData.contactId}
                  onChange={(e) => setFormData({ ...formData, contactId: e.target.value })}
                >
                  <option value="">Nenhum</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Negócio (opcional)</label>
                <select
                  className="input"
                  value={formData.dealId}
                  onChange={(e) => setFormData({ ...formData, dealId: e.target.value })}
                >
                  <option value="">Nenhum</option>
                  {deals.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 mt-4">
                <button type="button" className="btn btn-secondary flex-1" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary flex-1">
                  {editingTask ? "Salvar" : "Criar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

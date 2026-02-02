"use client"

import { useCRM } from "@/context/crm-context"
import { LuLayoutDashboard } from "react-icons/lu";

export default function Dashboard() {
  const { contacts, deals, tasks } = useCRM()

  const totalDealsValue = deals.reduce((acc, d) => acc + d.value, 0)
  const closedDeals = deals.filter((d) => d.stage === "closed")
  const closedValue = closedDeals.reduce((acc, d) => acc + d.value, 0)
  const pendingTasks = tasks.filter((t) => t.status !== "completed")
  const recentContacts = [...contacts]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)

  const stats = [
    { label: "Total de Contatos", value: contacts.length, change: "+12%", positive: true },
    {
      label: "Negócios em Aberto",
      value: deals.filter((d) => d.stage !== "closed").length,
      change: "+5%",
      positive: true,
    },
    { label: "Valor Pipeline", value: `R$ ${(totalDealsValue / 1000).toFixed(0)}k`, change: "+18%", positive: true },
    { label: "Fechados este mês", value: `R$ ${(closedValue / 1000).toFixed(0)}k`, change: "+25%", positive: true },
  ]

  return (
    <div className="">
      <header className="mb-8">
        <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-2 rounded-lg">
                    <LuLayoutDashboard className="text-primary text-2xl" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
                    <p className="text-sm text-muted-foreground">
                      Visão geral do seu CRM
                    </p>
                  </div>
                </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, i) => (
          <div key={i} className="stat-card">
            <p className="stat-label">{stat.label}</p>
            <p className="stat-value">{stat.value}</p>
            <p className={`stat-change ${stat.positive ? "positive" : "negative"}`}>{stat.change} vs mês anterior</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold" style={{ color: "hsl(var(--foreground))" }}>
              Negócios Recentes
            </h2>
            <span className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
              Top 5
            </span>
          </div>
          <div className="flex flex-col gap-4">
            {deals.slice(0, 5).map((deal) => {
              const contact = contacts.find((c) => c.id === deal.contactId)
              const stageColors: Record<string, string> = {
                lead: "51 87% 60%",
                qualified: "213 97% 35%",
                proposal: "30 80% 55%",
                negotiation: "270 85% 56%",
                closed: "51 87% 60%",
              }
              return (
                <div
                  key={deal.id}
                  className="flex items-center justify-between p-4 rounded-lg transition-colors duration-200"
                  style={{
                    backgroundColor: "hsl(var(--secondary))",
                  }}
                >
                  <div className="flex-1">
                    <p className="font-medium" style={{ color: "hsl(var(--foreground))" }}>
                      {deal.title}
                    </p>
                    <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                      {contact?.name || "Sem contato"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold" style={{ color: `hsl(${stageColors[deal.stage]})` }}>
                      R$ {deal.value.toLocaleString()}
                    </p>
                    <span
                      className="inline-block px-2 py-1 rounded text-xs font-medium mt-1"
                      style={{
                        backgroundColor: `hsl(${stageColors[deal.stage]} / 0.15)`,
                        color: `hsl(${stageColors[deal.stage]})`,
                      }}
                    >
                      {deal.stage}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold" style={{ color: "hsl(var(--foreground))" }}>
              Tarefas Pendentes
            </h2>
            <span
              className="badge badge-warning"
              style={{
                backgroundColor: "hsl(30 80% 55% / 0.15)",
                color: "hsl(30 80% 55%)",
              }}
            >
              {pendingTasks.length} pendentes
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {pendingTasks.slice(0, 5).map((task) => {
              const priorityColors: Record<string, string> = {
                high: "0 84% 60%",
                medium: "30 80% 55%",
                low: "215 11% 47%",
              }
              return (
                <div
                  key={task.id}
                  className="flex items-start gap-4 p-4 rounded-lg"
                  style={{ backgroundColor: "hsl(var(--secondary))" }}
                >
                  <div
                    className="w-3 h-3 rounded-full mt-1.5 shrink-0"
                    style={{ backgroundColor: `hsl(${priorityColors[task.priority]})` }}
                  />
                  <div className="flex-1">
                    <p className="font-medium" style={{ color: "hsl(var(--foreground))" }}>
                      {task.title}
                    </p>
                    <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                      Vence em {new Date(task.dueDate).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold" style={{ color: "hsl(var(--foreground))" }}>
              Contatos Recentes
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Empresa</th>
                  <th>Email</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentContacts.map((contact) => {
                  const statusColors: Record<string, string> = {
                    customer: "51 87% 60%",
                    prospect: "213 97% 35%",
                    lead: "30 80% 55%",
                    inactive: "215 11% 47%",
                  }
                  return (
                    <tr key={contact.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div
                            className="avatar w-8 h-8 text-xs"
                            style={{
                              backgroundColor: "hsl(var(--primary))",
                              color: "hsl(var(--primary-foreground))",
                            }}
                          >
                            {contact.name.charAt(0)}
                          </div>
                          {contact.name}
                        </div>
                      </td>
                      <td>{contact.company}</td>
                      <td style={{ color: "hsl(var(--muted-foreground))" }}>{contact.email}</td>
                      <td>
                        <span
                          className="badge text-xs"
                          style={{
                            backgroundColor: `hsl(${statusColors[contact.status]} / 0.15)`,
                            color: `hsl(${statusColors[contact.status]})`,
                          }}
                        >
                          {contact.status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

"use client"

import { useEffect, useMemo, useState } from "react"
import { getBrowserSupabase } from "@/lib/supabase-browser"
import { sortTickets } from "@/lib/priority"
import Topbar from "@/components/Topbar"
import StatCard from "@/components/StatCard"
import QuickActions from "@/components/QuickActions"
import AuditTimeline from "@/components/AuditTimeline"
import RoleHierarchyCard from "@/components/RoleHierarchyCard"
import StaffMetricsCard from "@/components/StaffMetricsCard"
import MemberSearchCard from "@/components/MemberSearchCard"
import TicketQueueTable from "@/components/TicketQueueTable"
import CategoryManager from "@/components/CategoryManager"
import MobileBottomNav from "@/components/MobileBottomNav"

export default function DashboardClient({ initialData, staffName }) {
  const [data, setData] = useState(initialData)
  const [loadingId, setLoadingId] = useState("")
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const [sortBy, setSortBy] = useState("priority_desc")

  async function refresh() {
    setError("")
    const res = await fetch("/api/dashboard/live", { cache: "no-store" })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error || "Failed to refresh dashboard.")
      return
    }
    setData(json)
  }

  useEffect(() => {
    let supabase
    try {
      supabase = getBrowserSupabase()
    } catch (err) {
      setError(err.message || "Realtime client unavailable.")
      return
    }
    const channel = supabase
      .channel("dashboard-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "ticket_messages" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "ticket_notes" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "ticket_categories" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "audit_events" }, refresh)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  async function onAction(type, ticketId, payload) {
    setLoadingId(ticketId)
    setError("")
    try {
      const endpoint = type === "claim" ? `/api/tickets/${ticketId}/claim` : `/api/tickets/${ticketId}/close`
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Ticket action failed.")
      await refresh()
    } catch (err) {
      setError(err.message || "Ticket action failed.")
    } finally {
      setLoadingId("")
    }
  }

  const filteredTickets = useMemo(() => {
    let rows = [...(data.tickets || [])]
    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter((t) =>
        [t.username, t.user_id, t.title, t.category, t.mod_suggestion, t.claimed_by]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q))
      )
    }
    if (statusFilter !== "all") rows = rows.filter((t) => t.status === statusFilter)
    if (priorityFilter !== "all") rows = rows.filter((t) => t.priority === priorityFilter)
    return sortTickets(rows, sortBy)
  }, [data.tickets, search, statusFilter, priorityFilter, sortBy])

  return (
    <>
      <Topbar />
      {error ? <div className="error-banner" style={{ marginBottom: 18 }}>{error}</div> : null}

      <section className="hero" id="overview">
        <div className="card">
          <div className="muted" style={{ marginBottom: 10 }}>Overview</div>
          <h2 style={{ marginTop: 0 }}>Stability pass with stronger runtime handling and deployment-readiness</h2>
          <p className="muted">
            This pass focuses on auth hardening, cleaner API behaviors, inline management tools, richer ticket controls,
            and safer loading and error states so you can push with more confidence.
          </p>
        </div>
        <QuickActions />
      </section>

      <section className="metrics">
        <StatCard title="Open Tickets" value={data.counts.openTickets} subtitle="Current open queue load" />
        <StatCard title="Warns Today" value={data.counts.warnsToday} subtitle="Spam and scam enforcement" />
        <StatCard title="Raid Alerts (24h)" value={data.counts.raidAlerts} subtitle="Join velocity incidents" />
        <StatCard title="Fraud Flags" value={data.counts.fraudFlags} subtitle="Manual verification review" />
      </section>

      <div className="card" style={{ marginBottom: 18 }}>
        <h2 style={{ marginTop: 0 }}>Ticket Filters</h2>
        <div className="filters">
          <input className="input" placeholder="Search user, title, category, suggestion..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="open">Open</option>
            <option value="claimed">Claimed</option>
            <option value="closed">Closed</option>
          </select>
          <select className="select" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
            <option value="all">All priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select className="select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="priority_desc">Priority</option>
            <option value="updated_desc">Updated desc</option>
            <option value="updated_asc">Updated asc</option>
            <option value="created_desc">Created desc</option>
            <option value="created_asc">Created asc</option>
          </select>
        </div>
      </div>

      <section className="grid-2">
        <TicketQueueTable tickets={filteredTickets} onAction={onAction} loadingId={loadingId} />
        <AuditTimeline events={data.events} />
      </section>

      <section className="grid-3">
        <MemberSearchCard />
        <RoleHierarchyCard roles={data.roles} />
        <StaffMetricsCard metrics={data.metrics} />
      </section>

      <section className="grid-2" style={{ marginTop: 18 }}>
        <CategoryManager categories={data.categories} onRefresh={refresh} />
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Live Sync Status</h2>
          <div className="space">
            <div className="row"><span className="status-dot" /><span>Realtime subscriptions active</span></div>
            <div className="row"><span className="status-dot" /><span>Authenticated identity: {staffName}</span></div>
            <div className="row"><span className="status-dot" /><span>Dashboard state updates in-place without page reloads</span></div>
          </div>
        </div>
      </section>

      <MobileBottomNav />
    </>
  )
}

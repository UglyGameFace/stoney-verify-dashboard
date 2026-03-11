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

const MOBILE_TABS = ["home", "tickets", "members", "categories"]

export default function DashboardClient({ initialData, staffName }) {
  const [data, setData] = useState(initialData)
  const [loadingId, setLoadingId] = useState("")
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const [sortBy, setSortBy] = useState("priority_desc")
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState("home")

  async function refresh({ silent = false } = {}) {
    if (!silent) setIsRefreshing(true)
    setError("")

    try {
      const res = await fetch("/api/dashboard/live", { cache: "no-store" })
      const json = await res.json()

      if (!res.ok) {
        throw new Error(json.error || "Failed to refresh dashboard.")
      }

      setData(json)
    } catch (err) {
      setError(err.message || "Failed to refresh dashboard.")
    } finally {
      if (!silent) setIsRefreshing(false)
    }
  }

  useEffect(() => {
    let supabase
    let channel

    async function handleRealtimeChange() {
      await refresh({ silent: true })
    }

    try {
      supabase = getBrowserSupabase()

      channel = supabase
        .channel("dashboard-live")
        .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, handleRealtimeChange)
        .on("postgres_changes", { event: "*", schema: "public", table: "ticket_messages" }, handleRealtimeChange)
        .on("postgres_changes", { event: "*", schema: "public", table: "ticket_notes" }, handleRealtimeChange)
        .on("postgres_changes", { event: "*", schema: "public", table: "ticket_categories" }, handleRealtimeChange)
        .on("postgres_changes", { event: "*", schema: "public", table: "audit_events" }, handleRealtimeChange)
        .subscribe((status) => {
          console.log("dashboard realtime status:", status)
          if (status === "SUBSCRIBED") {
            refresh({ silent: true })
          }
        })
    } catch (err) {
      setError(err.message || "Realtime client unavailable.")
      return
    }

    return () => {
      if (supabase && channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [])

  async function onAction(type, ticketId, payload) {
    setLoadingId(ticketId)
    setError("")

    try {
      const endpoint =
        type === "claim"
          ? `/api/tickets/${ticketId}/claim`
          : `/api/tickets/${ticketId}/close`

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload || {})
      })

      const json = await res.json()

      if (!res.ok) {
        throw new Error(json.error || "Ticket action failed.")
      }

      await refresh()
    } catch (err) {
      setError(err.message || "Ticket action failed.")
    } finally {
      setLoadingId("")
    }
  }

  const filteredTickets = useMemo(() => {
    let rows = [...(data?.tickets || [])]

    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter((t) =>
        [
          t.username,
          t.user_id,
          t.title,
          t.category,
          t.mod_suggestion,
          t.claimed_by
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q))
      )
    }

    if (statusFilter !== "all") {
      rows = rows.filter((t) => t.status === statusFilter)
    }

    if (priorityFilter !== "all") {
      rows = rows.filter((t) => t.priority === priorityFilter)
    }

    return sortTickets(rows, sortBy)
  }, [data?.tickets, search, statusFilter, priorityFilter, sortBy])

  const counts = data?.counts || {
    openTickets: 0,
    warnsToday: 0,
    raidAlerts: 0,
    fraudFlags: 0
  }

  const safeEvents = data?.events || []
  const safeRoles = data?.roles || []
  const safeMetrics = data?.metrics || []
  const safeCategories = data?.categories || []

  function isActiveTab(tab) {
    return activeTab === tab
  }

  return (
    <>
      <Topbar />

      {error ? (
        <div className="error-banner stoner-banner" style={{ marginBottom: 18 }}>
          {error}
        </div>
      ) : null}

      <section
        className={`mobile-tab-panel ${isActiveTab("home") ? "active" : ""}`}
        id="overview"
      >
        <section className="hero">
          <div className="card stoner-hero-card">
            <div
              className="row"
              style={{
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 12,
                marginBottom: 10
              }}
            >
              <div className="muted">Smoke Session Overview</div>

              <button
                className="button ghost"
                type="button"
                onClick={() => refresh()}
                disabled={isRefreshing}
                style={{ width: "auto", minWidth: 110 }}
              >
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            <h2 style={{ marginTop: 0 }}>
              Stoney Verify command deck with cleaner mobile flow and greener branding
            </h2>

            <p className="muted" style={{ marginBottom: 0 }}>
              This build keeps your moderation controls, realtime state updates,
              member tools, role data, and queue handling while turning mobile into
              focused sections instead of one endless stacked scroll.
            </p>
          </div>

          <QuickActions onRefresh={refresh} />
        </section>

        <section className="metrics">
          <StatCard
            title="Open Tickets"
            value={counts.openTickets}
            subtitle="Current queue in rotation"
          />
          <StatCard
            title="Warns Today"
            value={counts.warnsToday}
            subtitle="Spam and scam enforcement"
          />
          <StatCard
            title="Raid Alerts (24h)"
            value={counts.raidAlerts}
            subtitle="Join spike detections"
          />
          <StatCard
            title="Fraud Flags"
            value={counts.fraudFlags}
            subtitle="Manual verification review"
          />
        </section>

        <section className="grid-2">
          <AuditTimeline events={safeEvents} />
          <div className="card stoner-status-card">
            <h2 style={{ marginTop: 0 }}>Session Status</h2>

            <div className="space">
              <div className="row">
                <span className="status-dot" />
                <span>Realtime subscriptions active</span>
              </div>

              <div className="row">
                <span className="status-dot" />
                <span>Authenticated identity: {staffName}</span>
              </div>

              <div className="row">
                <span className="status-dot" />
                <span>Queue and panels update without full reloads</span>
              </div>

              <div className="row">
                <span className="status-dot" />
                <span>Current sync state: {isRefreshing ? "Refreshing..." : "Idle"}</span>
              </div>
            </div>
          </div>
        </section>
      </section>

      <section
        className={`mobile-tab-panel ${isActiveTab("tickets") ? "active" : ""}`}
        id="tickets"
      >
        <div className="card" style={{ marginBottom: 18 }}>
          <div
            className="row"
            style={{
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 10,
              marginBottom: 12
            }}
          >
            <h2 style={{ margin: 0 }}>Ticket Filters</h2>
            <div className="muted" style={{ fontSize: 14 }}>
              {filteredTickets.length} result{filteredTickets.length === 1 ? "" : "s"}
            </div>
          </div>

          <div className="filters">
            <input
              className="input"
              placeholder="Search user, title, category, suggestion..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <select
              className="select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All statuses</option>
              <option value="open">Open</option>
              <option value="claimed">Claimed</option>
              <option value="closed">Closed</option>
            </select>

            <select
              className="select"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
            >
              <option value="all">All priorities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <select
              className="select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="priority_desc">Priority</option>
              <option value="updated_desc">Updated desc</option>
              <option value="updated_asc">Updated asc</option>
              <option value="created_desc">Created desc</option>
              <option value="created_asc">Created asc</option>
            </select>
          </div>
        </div>

        <TicketQueueTable
          tickets={filteredTickets}
          onAction={onAction}
          loadingId={loadingId}
        />
      </section>

      <section
        className={`mobile-tab-panel ${isActiveTab("members") ? "active" : ""}`}
        id="members"
      >
        <section className="grid-3 stoner-members-grid">
          <MemberSearchCard />
          <RoleHierarchyCard roles={safeRoles} />
          <StaffMetricsCard metrics={safeMetrics} />
        </section>
      </section>

      <section
        className={`mobile-tab-panel ${isActiveTab("categories") ? "active" : ""}`}
        id="categories"
      >
        <section className="grid-2">
          <CategoryManager categories={safeCategories} onRefresh={refresh} />

          <div className="card">
            <h2 style={{ marginTop: 0 }}>Stoney Ops Notes</h2>
            <div className="space">
              <div className="info-banner stoner-banner">
                Keep category flows tight so staff can handle member issues fast
                without bouncing back into Discord for every small step.
              </div>

              <div className="space">
                <div className="row">
                  <span className="status-dot" />
                  <span>Verification flows should stay simple and green-lit</span>
                </div>

                <div className="row">
                  <span className="status-dot" />
                  <span>Appeals and fraud checks should be clearly separated</span>
                </div>

                <div className="row">
                  <span className="status-dot" />
                  <span>High-priority queue items should stay obvious on desktop and mobile</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </section>

      <MobileBottomNav activeTab={activeTab} onChange={setActiveTab} tabs={MOBILE_TABS} />
    </>
  )
}

/* app/dashboard/ui.tsx */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type StaffUser = {
  id: string;
  username: string;
  roles: string[];
  guildId: string | null;
};

type DashboardUIProps = {
  staffUser?: StaffUser | null;
};


type TokenRow = {
  token: string;
  guild_id: string | null;
  channel_id: string | null;
  requester_id: string | null;
  expires_at: string;
  used: boolean;
  submitted: boolean;
  decision: string | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
  webhook_url: string;
};

type KickTimerRow = {
  channel_id: string;
  guild_id: string;
  owner_id: string;
  started_at: string;
  hours: number;
  started_by: string | null;
};

type AuditRow = {
  id?: string;
  at: string;
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  meta: any;
};

type Stats = {
  pending: number;
  submitted: number;
  approved: number;
  denied: number;
  kickTimers: number;
  liveEvents: number;
  vcSessions: number;
};

type ModuleKey =
  | "overview"
  | "verifications"
  | "tokens"
  | "kickTimers"
  | "audit"
  | "liveMonitor"
  | "vcSessions"
  | "transcripts"
  | "settings";

function fmt(ts?: string | null) {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    return d.toLocaleString();
  } catch {
    return String(ts);
  }
}

function shortId(x?: string | null) {
  if (!x) return "";
  const s = String(x);
  if (s.length <= 10) return s;
  return s.slice(0, 4) + "…" + s.slice(-4);
}

function decisionLabel(decision: string | null, used: boolean, submitted: boolean) {
  const d = (decision || "").toUpperCase();
  if (used) return "USED";
  if (d.includes("APPROVED")) return "APPROVED";
  if (d.includes("DENIED")) return "DENIED";
  if (d.includes("RESUBMIT")) return "RESUBMIT";
  if (submitted) return "SUBMITTED";
  return "PENDING";
}

function pillClass(label: string) {
  const s = label.toUpperCase();
  if (s.includes("APPROV")) return "sb-pill ok";
  if (s.includes("DENY")) return "sb-pill bad";
  if (s.includes("RESUB")) return "sb-pill warn";
  if (s.includes("SUBMIT")) return "sb-pill blue";
  if (s.includes("USED")) return "sb-pill";
  return "sb-pill";
}

async function apiGet<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: "no-store" });
  return await r.json();
}

async function apiPost<T>(url: string, body: any): Promise<T> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return await r.json();
}

export default function DashboardUI({ staffUser }: DashboardUIProps) {
  const [me, setMe] = useState<StaffUser | null>(staffUser ?? null);
  const [mod, setMod] = useState<ModuleKey>("verifications");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [stats, setStats] = useState<Stats>({
    pending: 0,
    submitted: 0,
    approved: 0,
    denied: 0,
    kickTimers: 0,
    liveEvents: 0,
    vcSessions: 0,
  });

  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [timers, setTimers] = useState<KickTimerRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");

  // Queue UI
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"pending" | "submitted" | "approved" | "denied" | "used">(
    "pending"
  );
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  // Live monitor (SSE)
  const [events, setEvents] = useState<any[]>([]);
  const sseRef = useRef<EventSource | null>(null);

  // Modal
  const [modal, setModal] = useState<{ title: string; body: any } | null>(null);

  const nav = useMemo(
    () => [
      { k: "overview" as const, label: "🏠 Overview" },
      { k: "verifications" as const, label: "🧾 Verifications" },
      { k: "tokens" as const, label: "🔑 Tokens" },
      { k: "kickTimers" as const, label: "⏳ Kick Timers" },
      { k: "vcSessions" as const, label: "🎙️ VC Sessions" },
      { k: "transcripts" as const, label: "📜 Transcripts" },
      { k: "audit" as const, label: "🧷 Audit Log" },
      { k: "liveMonitor" as const, label: "📡 Live Monitor" },
      { k: "settings" as const, label: "⚙ Settings" },
    ],
    []
  );

  async function refreshEverything() {
    setLoading(true);
    setErr("");
    try {
      if (!staffUser) {
        const meRes = await apiGet<any>("/api/auth/me");
        if (meRes?.error) throw new Error(meRes.error);
        setMe(meRes as StaffUser);
      } else {
        setMe(staffUser);
      }

      // Stats (optional)
      try {
        const st = await apiGet<any>("/api/stats");
        if (st?.ok) {
          const { ok, ...rest } = st;
          setStats((prev) => ({ ...prev, ...(rest as any) }));
        }
      } catch {
        // ignore
      }

      // Tokens
      const t = await apiGet<any>(`/api/tokens?limit=80&status=${status}`);
      if (t?.error) throw new Error(t.error);
      setTokens((t?.rows || t?.data || []) as TokenRow[]);

      // Timers
      const kt = await apiGet<any>("/api/timers?limit=80");
      if (kt?.error) throw new Error(kt.error);
      setTimers((kt?.rows || kt?.data || []) as KickTimerRow[]);

      // Audit
      const au = await apiGet<any>("/api/audit?limit=80");
      if (au?.error) throw new Error(au.error);
      setAudit((au?.rows || au?.data || []) as AuditRow[]);
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshEverything();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // when status filter changes, refresh tokens
    (async () => {
      try {
        const t = await apiGet<any>(`/api/tokens?limit=120&status=${status}`);
        if (!t?.error) setTokens((t?.rows || t?.data || []) as TokenRow[]);
      } catch {
        // ignore
      }
    })();
    setSelected({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // SSE live monitor (only attach when viewing live)
  useEffect(() => {
    if (mod !== "liveMonitor") return;

    if (sseRef.current) {
      try {
        sseRef.current.close();
      } catch {}
      sseRef.current = null;
    }

    const es = new EventSource("/api/monitor");
    sseRef.current = es;

    es.onmessage = (ev) => {
      try {
        const j = JSON.parse(ev.data);
        setEvents((prev) => [j, ...prev].slice(0, 100));
      } catch {
        setEvents((prev) => [{ raw: ev.data }, ...prev].slice(0, 100));
      }
    };

    es.onerror = () => {
      setEvents((prev) => [{ type: "error", message: "monitor disconnected" }, ...prev].slice(0, 100));
    };

    return () => {
      try {
        es.close();
      } catch {}
      sseRef.current = null;
    };
  }, [mod]);

  // Close drawer when switching tabs
  useEffect(() => {
    setDrawerOpen(false);
  }, [mod]);

  const filteredTokens = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return tokens;

    return tokens.filter((r) => {
      const st = decisionLabel(r.decision, r.used, r.submitted).toLowerCase();
      return (
        (r.token || "").toLowerCase().includes(needle) ||
        (r.requester_id || "").toLowerCase().includes(needle) ||
        (r.channel_id || "").toLowerCase().includes(needle) ||
        st.includes(needle)
      );
    });
  }, [q, tokens]);

  const selectedTokens = useMemo(() => {
    const set = new Set(Object.keys(selected).filter((k) => selected[k]));
    return filteredTokens.filter((t) => set.has(t.token));
  }, [selected, filteredTokens]);

  async function setDecision(token: string, decision: "APPROVED" | "DENIED" | "RESUBMIT") {
    const res = await apiPost<any>("/api/decision", { token, decision });
    if (res?.error) throw new Error(res.error);
  }

  async function bulkDecision(decision: "APPROVED" | "DENIED" | "RESUBMIT") {
    const items = selectedTokens;
    if (!items.length) return;

    setLoading(true);
    setErr("");
    try {
      for (const row of items) {
        await setDecision(row.token, decision);
      }
      await refreshEverything();
      setSelected({});
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function cancelTimer(channel_id: string) {
    setLoading(true);
    setErr("");
    try {
      const res = await apiPost<any>("/api/timers/delete", { channel_id });
      if (res?.error) throw new Error(res.error);
      await refreshEverything();
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  function Header() {
    return (
      <div className="sb-topbar">
        <div className="sb-row" style={{ justifyContent: "space-between", width: "100%" }}>
          <div className="sb-row" style={{ gap: 10 }}>
            <button
              className="sb-btn sb-btn-ghost sb-only-mobile"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              title="Menu"
            >
              ☰
            </button>

            <div className="sb-title">
              <div className="h">Stoney Verify Dashboard</div>
              <div className="sub">
                Welcome, <b>{me?.username || "…"}</b> — Stoney Baloney Edition
              </div>
            </div>
          </div>

          <div className="sb-actions sb-only-desktop">
            {me && (
              <span className="sb-pill">
                🧑‍🚀 {me.username} • {me.roles?.length || 0} role(s)
              </span>
            )}
            <button className="sb-btn sb-btn-green" onClick={refreshEverything} disabled={loading}>
              ⟳ Refresh
            </button>
            <a className="sb-btn sb-btn-ghost" href="/">
              Home
            </a>
            <a className="sb-btn sb-btn-ghost" href="/api/auth/logout">
              Logout
            </a>
          </div>
        </div>

        <div className="sb-row sb-only-mobile" style={{ marginTop: 10, justifyContent: "space-between" }}>
          <button className="sb-btn sb-btn-green" onClick={refreshEverything} disabled={loading}>
            ⟳ Refresh
          </button>
          <div className="sb-row">
            <a className="sb-btn sb-btn-ghost" href="/">
              Home
            </a>
            <a className="sb-btn sb-btn-ghost" href="/api/auth/logout">
              Logout
            </a>
          </div>
        </div>
      </div>
    );
  }

  function KPIs() {
    return (
      <div className="sb-card">
        <div className="sb-kpis">
          <div className="sb-kpi">
            <div className="k">Pending</div>
            <div className="v">{stats.pending ?? 0}</div>
            <div className="glow" />
          </div>
          <div className="sb-kpi">
            <div className="k">Submitted</div>
            <div className="v">{stats.submitted ?? 0}</div>
            <div className="glow" />
          </div>
          <div className="sb-kpi">
            <div className="k">Approved</div>
            <div className="v">{stats.approved ?? 0}</div>
            <div className="glow" />
          </div>
          <div className="sb-kpi">
            <div className="k">Denied</div>
            <div className="v">{stats.denied ?? 0}</div>
            <div className="glow" />
          </div>
          <div className="sb-kpi">
            <div className="k">Kick Timers</div>
            <div className="v">{stats.kickTimers ?? 0}</div>
            <div className="glow" />
          </div>
          <div className="sb-kpi">
            <div className="k">VC Sessions</div>
            <div className="v">{stats.vcSessions ?? 0}</div>
            <div className="glow" />
          </div>
        </div>
        <div className="sb-row" style={{ marginTop: 12 }}>
          <span className="sb-pill blue">💡 Tip: filter “submitted” to find users waiting on staff</span>
          {!!err && <span className="sb-pill bad">⚠ {err}</span>}
        </div>
      </div>
    );
  }

  function Queue() {
    return (
      <div className="sb-card">
        <div className="sb-row" style={{ justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>Verification Queue</div>
            <div className="sb-muted" style={{ marginTop: 4, fontSize: 12 }}>
              Search, filter, bulk actions — Stoney staff control hub
            </div>
          </div>

          <div className="sb-row mobile-stack">
            <input
              className="sb-input"
              placeholder="Search token / user / channel / status…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select
              className="sb-select"
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              title="Status"
            >
              <option value="pending">Pending</option>
              <option value="submitted">Submitted</option>
              <option value="approved">Approved</option>
              <option value="denied">Denied</option>
              <option value="used">Used</option>
            </select>
          </div>
        </div>

        <div className="sb-row sb-only-desktop" style={{ marginTop: 12 }}>
          <button
            className="sb-btn sb-btn-green"
            onClick={() => bulkDecision("APPROVED")}
            disabled={loading || selectedTokens.length === 0}
          >
            ✅ Approve selected
          </button>
          <button
            className="sb-btn sb-btn-red"
            onClick={() => bulkDecision("DENIED")}
            disabled={loading || selectedTokens.length === 0}
          >
            ⛔ Deny selected
          </button>
          <button
            className="sb-btn"
            onClick={() => bulkDecision("RESUBMIT")}
            disabled={loading || selectedTokens.length === 0}
          >
            🔁 Resubmit selected
          </button>

          <span className="sb-pill">
            Selected: <b>{selectedTokens.length}</b>
          </span>
        </div>

        {/* Desktop table */}
        <div className="sb-only-desktop" style={{ marginTop: 12 }}>
          <div className="sb-tablewrap">
            <table className="sb-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>
                    <input
                      type="checkbox"
                      checked={
                        filteredTokens.length > 0 &&
                        filteredTokens.every((t) => !!selected[t.token])
                      }
                      onChange={(e) => {
                        const on = e.target.checked;
                        const next: Record<string, boolean> = { ...selected };
                        for (const t of filteredTokens) next[t.token] = on;
                        setSelected(next);
                      }}
                    />
                  </th>
                  <th>Token</th>
                  <th>User</th>
                  <th>Ticket</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Expires</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTokens.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="sb-muted">
                      No results.
                    </td>
                  </tr>
                ) : (
                  filteredTokens.map((r) => {
                    const st = decisionLabel(r.decision, r.used, r.submitted);
                    return (
                      <tr key={r.token}>
                        <td>
                          <input
                            type="checkbox"
                            checked={!!selected[r.token]}
                            onChange={(e) =>
                              setSelected((prev) => ({
                                ...prev,
                                [r.token]: e.target.checked,
                              }))
                            }
                          />
                        </td>
                        <td style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                          {r.token}
                        </td>
                        <td title={r.requester_id || ""}>
                          {r.requester_id ? `@${shortId(r.requester_id)}` : "—"}
                        </td>
                        <td title={r.channel_id || ""}>
                          {r.channel_id ? `#${shortId(r.channel_id)}` : "—"}
                        </td>
                        <td>
                          <span className={pillClass(st)}>{st}</span>
                        </td>
                        <td className="sb-muted">{fmt(r.created_at)}</td>
                        <td className="sb-muted">{fmt(r.expires_at)}</td>
                        <td className="sb-row">
                          <button
                            className="sb-btn sb-btn-green"
                            disabled={loading}
                            onClick={async () => {
                              setLoading(true);
                              setErr("");
                              try {
                                await setDecision(r.token, "APPROVED");
                                await refreshEverything();
                              } catch (e: any) {
                                setErr(String(e?.message || e));
                              } finally {
                                setLoading(false);
                              }
                            }}
                          >
                            Approve
                          </button>
                          <button
                            className="sb-btn sb-btn-red"
                            disabled={loading}
                            onClick={async () => {
                              setLoading(true);
                              setErr("");
                              try {
                                await setDecision(r.token, "DENIED");
                                await refreshEverything();
                              } catch (e: any) {
                                setErr(String(e?.message || e));
                              } finally {
                                setLoading(false);
                              }
                            }}
                          >
                            Deny
                          </button>
                          <button className="sb-btn" disabled={loading} onClick={() => setModal({ title: "Token row", body: r })}>
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile cards */}
        <div className="sb-only-mobile" style={{ marginTop: 12 }}>
          <div className="sb-mcards">
            {filteredTokens.length === 0 ? (
              <div className="sb-muted">No results.</div>
            ) : (
              filteredTokens.map((r) => {
                const st = decisionLabel(r.decision, r.used, r.submitted);
                return (
                  <div className="sb-mcard" key={r.token}>
                    <div className="top">
                      <div className="sb-row" style={{ gap: 10 }}>
                        <input
                          type="checkbox"
                          checked={!!selected[r.token]}
                          onChange={(e) =>
                            setSelected((prev) => ({
                              ...prev,
                              [r.token]: e.target.checked,
                            }))
                          }
                          aria-label="Select"
                        />
                        <div className="mono">{r.token}</div>
                      </div>
                      <span className={pillClass(st)}>{st}</span>
                    </div>

                    <div className="grid">
                      <div>
                        <span>User</span>
                        {r.requester_id ? `@${shortId(r.requester_id)}` : "—"}
                      </div>
                      <div>
                        <span>Ticket</span>
                        {r.channel_id ? `#${shortId(r.channel_id)}` : "—"}
                      </div>
                      <div>
                        <span>Created</span>
                        {fmt(r.created_at)}
                      </div>
                      <div>
                        <span>Expires</span>
                        {fmt(r.expires_at)}
                      </div>
                    </div>

                    <div className="actions">
                      <button
                        className="sb-btn sb-btn-green"
                        disabled={loading}
                        onClick={async () => {
                          setLoading(true);
                          setErr("");
                          try {
                            await setDecision(r.token, "APPROVED");
                            await refreshEverything();
                          } catch (e: any) {
                            setErr(String(e?.message || e));
                          } finally {
                            setLoading(false);
                          }
                        }}
                      >
                        Approve
                      </button>
                      <button
                        className="sb-btn sb-btn-red"
                        disabled={loading}
                        onClick={async () => {
                          setLoading(true);
                          setErr("");
                          try {
                            await setDecision(r.token, "DENIED");
                            await refreshEverything();
                          } catch (e: any) {
                            setErr(String(e?.message || e));
                          } finally {
                            setLoading(false);
                          }
                        }}
                      >
                        Deny
                      </button>
                      <button className="sb-btn" disabled={loading} onClick={() => setModal({ title: "Token row", body: r })}>
                        View
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  }

  function KickTimers() {
    return (
      <div className="sb-card">
        <div className="sb-row" style={{ justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>Kick Timers</div>
            <div className="sb-muted" style={{ marginTop: 4, fontSize: 12 }}>
              Active verification kick timers from Supabase
            </div>
          </div>
        </div>

        <div className="sb-only-desktop" style={{ marginTop: 12 }}>
          <div className="sb-tablewrap">

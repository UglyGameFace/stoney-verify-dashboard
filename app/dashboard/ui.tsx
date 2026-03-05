"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type StaffUser = {
  id: string;
  username: string;
  roles: string[];
  guildId: string | null;
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
  return (await r.json()) as T;
}

async function apiPost<T>(url: string, body: any): Promise<T> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await r.json()) as T;
}

function useIsMobile(bp = 920) {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width:${bp}px)`);
    const on = () => setMobile(mq.matches);
    on();
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, [bp]);
  return mobile;
}

export default function DashboardUI(props: { staffUser?: StaffUser }) {
  const isMobile = useIsMobile(920);

  const [me, setMe] = useState<StaffUser | null>(props.staffUser ?? null);
  const [mod, setMod] = useState<ModuleKey>("verifications");

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

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"pending" | "submitted" | "approved" | "denied" | "used">("pending");
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const [events, setEvents] = useState<any[]>([]);
  const sseRef = useRef<EventSource | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [modal, setModal] = useState<{ title: string; body: any } | null>(null);

  const primaryNav = useMemo(
    () => [
      { k: "overview" as const, label: "Home", ico: "🏠" },
      { k: "verifications" as const, label: "Queue", ico: "🧾" },
      { k: "kickTimers" as const, label: "Timers", ico: "⏳" },
      { k: "audit" as const, label: "Audit", ico: "🧷" },
      { k: "liveMonitor" as const, label: "Live", ico: "📡" },
    ],
    []
  );

  const drawerNav = useMemo(
    () => [
      { k: "vcSessions" as const, label: "🎙️ VC Sessions" },
      { k: "transcripts" as const, label: "📜 Transcripts" },
      { k: "settings" as const, label: "⚙ Settings" },
    ],
    []
  );

  async function refreshEverything() {
    setLoading(true);
    setErr("");
    try {
      const meRes = await apiGet<any>("/api/auth/me");
      if (meRes?.error) throw new Error(meRes.error);
      setMe(meRes as StaffUser);

      try {
        const st = await apiGet<any>("/api/stats");
        if (st?.ok) {
          const { ok, ...rest } = st;
          setStats((prev) => ({ ...prev, ...(rest as any) }));
        }
      } catch {
        // ignore
      }

      const t = await apiGet<any>(`/api/tokens?limit=160&status=${status}`);
      if (t?.error) throw new Error(t.error);
      setTokens((t?.rows || t?.data || []) as TokenRow[]);

      const kt = await apiGet<any>("/api/timers?limit=160");
      if (kt?.error) throw new Error(kt.error);
      setTimers((kt?.rows || kt?.data || []) as KickTimerRow[]);

      const au = await apiGet<any>("/api/audit?limit=160");
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
    (async () => {
      try {
        const t = await apiGet<any>(`/api/tokens?limit=200&status=${status}`);
        if (!t?.error) setTokens((t?.rows || t?.data || []) as TokenRow[]);
      } catch {}
    })();
    setSelected({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    if (mod !== "liveMonitor") return;

    if (sseRef.current) {
      try { sseRef.current.close(); } catch {}
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
      try { es.close(); } catch {}
      sseRef.current = null;
    };
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
      for (const row of items) await setDecision(row.token, decision);
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

  const MobileTop = () => (
    <div className="sb-mtop">
      <div className="row">
        <div className="brand">
          <div className="h">Stoney Verify</div>
          <div className="sub">
            {me ? `${me.username} • ${(me.roles?.length || 0)} role(s)` : "Loading…"}
          </div>
        </div>
        <div className="sb-row">
          <button className="sb-btn sb-btn-ghost" onClick={refreshEverything} disabled={loading} title="Refresh">
            ⟳
          </button>
          <button className="sb-btn sb-btn-ghost" onClick={() => setDrawerOpen(true)} title="More">
            ⋯
          </button>
        </div>
      </div>
      {!!err && (
        <div className="sb-row" style={{ marginTop: 8 }}>
          <span className="sb-pill bad">⚠ {err}</span>
        </div>
      )}
    </div>
  );

  const KPIs = () => (
    <div className="sb-card">
      <div className="sb-kpis">
        <div className="sb-kpi"><div className="k">Pending</div><div className="v">{stats.pending ?? 0}</div><div className="glow" /></div>
        <div className="sb-kpi"><div className="k">Submitted</div><div className="v">{stats.submitted ?? 0}</div><div className="glow" /></div>
        <div className="sb-kpi"><div className="k">Approved</div><div className="v">{stats.approved ?? 0}</div><div className="glow" /></div>
        <div className="sb-kpi"><div className="k">Denied</div><div className="v">{stats.denied ?? 0}</div><div className="glow" /></div>
        <div className="sb-kpi"><div className="k">Kick Timers</div><div className="v">{stats.kickTimers ?? 0}</div><div className="glow" /></div>
        <div className="sb-kpi"><div className="k">VC Sessions</div><div className="v">{stats.vcSessions ?? 0}</div><div className="glow" /></div>
      </div>
      <div className="sb-row" style={{ marginTop: 12 }}>
        <span className="sb-pill blue">💡 Tip: “submitted” = waiting on staff</span>
      </div>
    </div>
  );

  const QueueCards = () => (
    <div className="sb-card">
      <div className="sb-row" style={{ justifyContent: "space-between" }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 16 }}>Verification Queue</div>
          <div className="sb-muted" style={{ marginTop: 4, fontSize: 12 }}>
            Mobile-first: cards + sticky actions
          </div>
        </div>
      </div>

      <div className="sb-row" style={{ marginTop: 12, flexWrap: "wrap" }}>
        <input
          className="sb-input"
          placeholder="Search token / user / channel / status…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: "1 1 220px" }}
        />
        <select
          className="sb-select"
          value={status}
          onChange={(e) => setStatus(e.target.value as any)}
          title="Status"
          style={{ flex: "0 0 180px" }}
        >
          <option value="pending">Pending</option>
          <option value="submitted">Submitted</option>
          <option value="approved">Approved</option>
          <option value="denied">Denied</option>
          <option value="used">Used</option>
        </select>
      </div>

      <div className="sb-mcards" style={{ marginTop: 12 }}>
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
                      onChange={(e) => setSelected((p) => ({ ...p, [r.token]: e.target.checked }))}
                      aria-label="Select"
                    />
                    <div className="mono">{r.token}</div>
                  </div>
                  <span className={pillClass(st)}>{st}</span>
                </div>

                <div className="grid">
                  <div><span>User</span>{r.requester_id ? `@${shortId(r.requester_id)}` : "—"}</div>
                  <div><span>Ticket</span>{r.channel_id ? `#${shortId(r.channel_id)}` : "—"}</div>
                  <div><span>Created</span>{fmt(r.created_at)}</div>
                  <div><span>Expires</span>{fmt(r.expires_at)}</div>
                </div>

                <div className="actions">
                  <button
                    className="sb-btn sb-btn-green"
                    disabled={loading}
                    onClick={async () => {
                      setLoading(true);
                      setErr("");
                      try { await setDecision(r.token, "APPROVED"); await refreshEverything(); }
                      catch (e: any) { setErr(String(e?.message || e)); }
                      finally { setLoading(false); }
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
                      try { await setDecision(r.token, "DENIED"); await refreshEverything(); }
                      catch (e: any) { setErr(String(e?.message || e)); }
                      finally { setLoading(false); }
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
  );

  const KickTimersCards = () => (
    <div className="sb-card">
      <div style={{ fontWeight: 900, fontSize: 16 }}>Kick Timers</div>
      <div className="sb-muted" style={{ marginTop: 4, fontSize: 12 }}>Active verification kick timers</div>

      <div className="sb-mcards" style={{ marginTop: 12 }}>
        {timers.length === 0 ? (
          <div className="sb-muted">No timers found.</div>
        ) : (
          timers.map((t) => (
            <div className="sb-mcard" key={t.channel_id}>
              <div className="top">
                <div style={{ fontWeight: 900 }}>#{shortId(t.channel_id)}</div>
                <span className="sb-pill warn">⏳ {t.hours}h</span>
              </div>
              <div className="grid">
                <div><span>Owner</span>@{shortId(t.owner_id)}</div>
                <div><span>Started</span>{fmt(t.started_at)}</div>
                <div><span>Started by</span>{t.started_by ? `@${shortId(t.started_by)}` : "—"}</div>
                <div><span>Guild</span>{shortId(t.guild_id)}</div>
              </div>
              <div className="actions">
                <button className="sb-btn sb-btn-red" disabled={loading} onClick={() => cancelTimer(t.channel_id)}>
                  Cancel
                </button>
                <button className="sb-btn" onClick={() => setModal({ title: "Timer row", body: t })}>
                  View
                </button>
                <button className="sb-btn sb-btn-green" onClick={() => setMod("verifications")}>
                  Go Queue
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const AuditCards = () => (
    <div className="sb-card">
      <div style={{ fontWeight: 900, fontSize: 16 }}>Audit Log</div>
      <div className="sb-muted" style={{ marginTop: 4, fontSize: 12 }}>Recent staff actions</div>

      <div className="sb-mcards" style={{ marginTop: 12 }}>
        {audit.length === 0 ? (
          <div className="sb-muted">No audit logs found.</div>
        ) : (
          audit.map((a, idx) => (
            <div className="sb-mcard" key={(a.id || "") + idx}>
              <div className="top">
                <div style={{ fontWeight: 900 }}>{a.action}</div>
                <span className="sb-pill">{fmt(a.at)}</span>
              </div>
              <div className="grid">
                <div><span>Actor</span>{a.actor_name || (a.actor_id ? `@${shortId(a.actor_id)}` : "—")}</div>
                <div><span>ID</span>{a.actor_id ? shortId(a.actor_id) : "—"}</div>
              </div>
              <div className="actions">
                <button className="sb-btn" onClick={() => setModal({ title: "Audit meta", body: a.meta })}>
                  Meta
                </button>
                <button className="sb-btn" onClick={() => setModal({ title: "Audit row", body: a })}>
                  Row
                </button>
                <button className="sb-btn sb-btn-green" onClick={() => setMod("liveMonitor")}>
                  Live
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const LiveMonitor = () => (
    <div className="sb-card">
      <div style={{ fontWeight: 900, fontSize: 16 }}>Live Monitor</div>
      <div className="sb-muted" style={{ marginTop: 4, fontSize: 12 }}>
        Real-time events from <code>/api/monitor</code>
      </div>

      <div style={{ marginTop: 12 }} className="sb-card2">
        {events.length === 0 ? (
          <div className="sb-muted">No live events yet…</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {events.map((e, i) => (
              <div key={i} className="sb-pre">{JSON.stringify(e, null, 2)}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const Placeholder = (name: string, tip: string) => (
    <div className="sb-card">
      <div style={{ fontWeight: 900, fontSize: 16 }}>{name}</div>
      <div className="sb-muted" style={{ marginTop: 6 }}>{tip}</div>
      <div className="sb-muted" style={{ marginTop: 12, fontSize: 12 }}>
        Next: username/avatar resolver so IDs become real names + avatars everywhere.
      </div>
    </div>
  );

  const stickyVisible = isMobile && selectedTokens.length > 0;

  return (
    <>
      <MobileTop />

      {drawerOpen && (
        <>
          <div className="sb-drawer-backdrop" onClick={() => setDrawerOpen(false)} />
          <div className="sb-drawer" role="dialog" aria-modal="true">
            <div className="head">
              <div style={{ fontWeight: 950 }}>More</div>
              <button className="sb-btn sb-btn-ghost" onClick={() => setDrawerOpen(false)}>Close</button>
            </div>
            <div className="body">
              {drawerNav.map((n) => (
                <button
                  key={n.k}
                  className={"sb-navbtn" + (mod === n.k ? " active" : "")}
                  onClick={() => { setMod(n.k); setDrawerOpen(false); }}
                >
                  {n.label}
                </button>
              ))}
              <div className="sb-row" style={{ justifyContent: "space-between" }}>
                <a className="sb-btn sb-btn-ghost" href="/">Home</a>
                <a className="sb-btn sb-btn-ghost" href="/api/auth/logout">Logout</a>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="sb-shell">
        <aside className="sb-sidebar">
          <div className="sb-brand">
            <h1>Stoney Verify</h1>
            <p>Mega TicketTool-style control panel — Stoney Baloney themed</p>
          </div>
          <div className="sb-nav">
            <button className={"sb-navbtn" + (mod === "overview" ? " active" : "")} onClick={() => setMod("overview")}>🏠 Overview</button>
            <button className={"sb-navbtn" + (mod === "verifications" ? " active" : "")} onClick={() => setMod("verifications")}>🧾 Verifications</button>
            <button className={"sb-navbtn" + (mod === "kickTimers" ? " active" : "")} onClick={() => setMod("kickTimers")}>⏳ Kick Timers</button>
            <button className={"sb-navbtn" + (mod === "audit" ? " active" : "")} onClick={() => setMod("audit")}>🧷 Audit Log</button>
            <button className={"sb-navbtn" + (mod === "liveMonitor" ? " active" : "")} onClick={() => setMod("liveMonitor")}>📡 Live Monitor</button>
            <button className={"sb-navbtn" + (mod === "settings" ? " active" : "")} onClick={() => setMod("settings")}>⚙ Settings</button>
          </div>
        </aside>

        <main className="sb-main">
          <KPIs />

          {mod === "overview" && (
            <div className="sb-card">
              <div style={{ fontWeight: 950, fontSize: 16 }}>🔥 Hot Queue</div>
              <div className="sb-muted" style={{ marginTop: 6 }}>Newest pending verifications (quick actions)</div>
              <div style={{ marginTop: 12 }} className="sb-row">
                <button className="sb-btn sb-btn-green" onClick={() => setMod("verifications")}>Open queue →</button>
                <button className="sb-btn" onClick={() => setStatus("submitted")}>Show submitted</button>
              </div>
            </div>
          )}

          {mod === "verifications" && <QueueCards />}
          {mod === "kickTimers" && <KickTimersCards />}
          {mod === "audit" && <AuditCards />}
          {mod === "liveMonitor" && <LiveMonitor />}

          {mod === "vcSessions" && Placeholder("VC Sessions", "Hook this to /api/vc-sessions (already supported).")}
          {mod === "transcripts" && Placeholder("Transcripts", "Hook this to /api/transcripts + /api/transcripts/view.")}
          {mod === "settings" && Placeholder("Settings", "Server config, role mappings, staff perms, theme toggles, etc.")}
        </main>

        <div className="sb-bottomnav" aria-label="Bottom navigation">
          <div className="grid">
            {primaryNav.map((n) => (
              <button
                key={n.k}
                className={"item" + (mod === n.k ? " active" : "")}
                onClick={() => setMod(n.k)}
              >
                <div className="ico">{n.ico}</div>
                <span>{n.label}</span>
              </button>
            ))}
          </div>
        </div>

        {stickyVisible && (
          <div className="sb-stickybar">
            <div className="sb-row" style={{ justifyContent: "space-between" }}>
              <span className="sb-pill">Selected: <b>{selectedTokens.length}</b></span>
              <button className="sb-btn" onClick={() => setSelected({})}>Clear</button>
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <button className="sb-btn sb-btn-green" onClick={() => bulkDecision("APPROVED")} disabled={loading}>
                ✅ Approve selected
              </button>
              <button className="sb-btn sb-btn-red" onClick={() => bulkDecision("DENIED")} disabled={loading}>
                ⛔ Deny selected
              </button>
              <button className="sb-btn" onClick={() => bulkDecision("RESUBMIT")} disabled={loading}>
                🔁 Resubmit selected
              </button>
            </div>
          </div>
        )}

        {modal && (
          <div className="sb-modal-backdrop" onClick={() => setModal(null)}>
            <div className="sb-modal" onClick={(e) => e.stopPropagation()}>
              <div className="head">
                <div style={{ fontWeight: 950 }}>{modal.title}</div>
                <button className="sb-btn" onClick={() => setModal(null)}>Close</button>
              </div>
              <div className="body">
                <div className="sb-pre">{JSON.stringify(modal.body, null, 2)}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

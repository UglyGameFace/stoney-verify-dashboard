"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type StaffUser = { id: string; username: string };

type TokenRow = {
  token: string;
  guild_id?: string | null;
  channel_id?: string | null;
  requester_id?: string | null;
  expires_at?: string | null;
  used?: boolean;
  submitted?: boolean;
  decision?: string | null;
  decided_by?: string | null;
  decided_at?: string | null;
  created_at?: string | null;
  submitted_at?: string | null;
  owner_display_name?: string | null;
  owner_username?: string | null;
  owner_tag?: string | null;
};

type KickTimerRow = {
  channel_id: string;
  guild_id: string;
  owner_id: string;
  started_at: string;
  hours: number;
  started_by?: string | null;
};

function badge(decision?: string | null, used?: boolean) {
  const d = (decision || "PENDING").toUpperCase();
  if (d.startsWith("APPROVED")) return <span className="badge badge-ok">APPROVED</span>;
  if (d.startsWith("DENIED")) return <span className="badge badge-bad">DENIED</span>;
  if (d.includes("RESUBMIT")) return <span className="badge badge-warn">RESUBMIT</span>;
  if (used) return <span className="badge badge-warn">USED</span>;
  return <span className="badge">PENDING</span>;
}

export default function DashboardClient({ staffUser }: { staffUser: StaffUser }) {
  const [tab, setTab] = useState<"monitor"|"tokens"|"timers"|"audit">("monitor");
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [timers, setTimers] = useState<KickTimerRow[]>([]);
  const [audit, setAudit] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [monitor, setMonitor] = useState<TokenRow[]>([]);
  const [filter, setFilter] = useState("");

  async function loadTokens() {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/tokens", { cache: "no-store" });
      const j = await r.json();
      setTokens(j.data || []);
    } finally { setLoading(false); }
  }

  async function loadTimers() {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/kick-timers", { cache: "no-store" });
      const j = await r.json();
      setTimers(j.data || []);
    } finally { setLoading(false); }
  }

  async function loadAudit() {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/audit", { cache: "no-store" });
      const j = await r.json();
      setAudit(j.data || []);
    } finally { setLoading(false); }
  }

  useEffect(() => {
    // initial
    loadTokens();
    loadTimers();
    loadAudit();
  }, []);

  // realtime monitor: subscribe to verification_tokens changes using anon key (read requires RLS allow; if not, we'll just poll)
  useEffect(() => {
    const sb = supabaseBrowser();
    let alive = true;

    const table = process.env.NEXT_PUBLIC_TOKENS_TABLE || "verification_tokens";

    // Start with last 20 from admin endpoint (server role)
    (async () => {
      const r = await fetch("/api/admin/tokens", { cache: "no-store" });
      const j = await r.json();
      const recent = (j.data || []).slice(0, 20);
      if (alive) setMonitor(recent);
    })().catch(() => {});

    const ch = sb
      .channel("sv_tokens_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table }, (payload) => {
        const row = (payload.new || payload.old) as any;
        if (!row?.token) return;
        setMonitor((prev) => {
          const next = [{ ...row }, ...prev.filter((x) => x.token !== row.token)].slice(0, 50);
          return next;
        });
      })
      .subscribe();

    return () => {
      alive = false;
      sb.removeChannel(ch);
    };
  }, []);

  const filteredTokens = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return tokens;
    return tokens.filter((t) =>
      [t.token, t.channel_id, t.requester_id, t.decision, t.owner_display_name, t.owner_username, t.owner_tag]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [tokens, filter]);

  async function decide(token: string, decision: string, used: boolean) {
    await fetch("/api/admin/tokens", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, decision, decided_by: staffUser.id, used }),
    });
    await fetch("/api/admin/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "token_decision",
        actor_discord_id: staffUser.id,
        actor_username: staffUser.username,
        token,
        meta: { decision, used },
      }),
    }).catch(() => {});
    await loadTokens();
  }

  async function clearTimer(channel_id: string) {
    await fetch(`/api/admin/kick-timers?channel_id=${encodeURIComponent(channel_id)}`, { method: "DELETE" });
    await fetch("/api/admin/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "kick_timer_delete",
        actor_discord_id: staffUser.id,
        actor_username: staffUser.username,
        meta: { channel_id },
      }),
    }).catch(() => {});
    await loadTimers();
  }

  const TabBtn = ({ id, label }: { id: typeof tab; label: string }) => (
    <button className={`btn ${tab === id ? "" : "btn-secondary"}`} onClick={() => setTab(id)}>{label}</button>
  );

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="row" style={{ flexWrap: "wrap" }}>
        <TabBtn id="monitor" label="🔔 Live Monitor" />
        <TabBtn id="tokens" label="🧾 Token Viewer" />
        <TabBtn id="timers" label="⏳ Kick Timers" />
        <TabBtn id="audit" label="📜 Audit Logs" />
        <div style={{ flex: 1 }} />
        <button className="btn btn-secondary" onClick={() => { loadTokens(); loadTimers(); loadAudit(); }}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {tab === "monitor" && (
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <div style={{ fontWeight: 700 }}>Live verification monitor</div>
              <div className="muted" style={{ marginTop: 6 }}>Updates when tokens are created/updated (via Supabase Realtime if RLS allows).</div>
            </div>
            <span className="pill">last {monitor.length}</span>
          </div>
          <div className="hr" />
          <table className="table">
            <thead>
              <tr>
                <th>Token</th>
                <th>Status</th>
                <th>Channel</th>
                <th>Requester</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {monitor.map((t) => (
                <tr key={t.token}>
                  <td><code>{t.token}</code></td>
                  <td>{badge(t.decision, t.used)} {t.submitted ? <span className="badge badge-ok">SUBMITTED</span> : <span className="badge">NO SUBMIT</span>}</td>
                  <td className="muted">{t.channel_id || "-"}</td>
                  <td className="muted">{t.requester_id || "-"}</td>
                  <td className="muted">{t.decided_at || t.submitted_at || t.created_at || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "tokens" && (
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 700 }}>Token viewer</div>
              <div className="muted" style={{ marginTop: 6 }}>Search + manual approve/deny without touching Discord.</div>
            </div>
            <div className="row" style={{ minWidth: 320, flex: 1, justifyContent: "flex-end" }}>
              <input className="input" placeholder="Search token / channel / requester / decision / name..." value={filter} onChange={(e) => setFilter(e.target.value)} />
            </div>
          </div>
          <div className="hr" />
          <table className="table">
            <thead>
              <tr>
                <th>Token</th>
                <th>Status</th>
                <th>Owner</th>
                <th>Channel</th>
                <th>Expires</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTokens.map((t) => (
                <tr key={t.token}>
                  <td><code>{t.token}</code></td>
                  <td>
                    {badge(t.decision, t.used)}{" "}
                    {t.submitted ? <span className="badge badge-ok">SUBMITTED</span> : <span className="badge">NO SUBMIT</span>}
                  </td>
                  <td className="muted">{t.owner_display_name || t.owner_username || t.owner_tag || "-"}</td>
                  <td className="muted">{t.channel_id || "-"}</td>
                  <td className="muted">{t.expires_at || "-"}</td>
                  <td>
                    <div className="row" style={{ flexWrap: "wrap" }}>
                      <button className="btn" onClick={() => decide(t.token, "APPROVED (DASHBOARD)", true)}>Approve</button>
                      <button className="btn btn-secondary" onClick={() => decide(t.token, "RESUBMIT REQUESTED (DASHBOARD)", false)}>Resubmit</button>
                      <button className="btn btn-secondary" onClick={() => decide(t.token, "DENIED (DASHBOARD)", true)}>Deny</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filteredTokens.length && (
                <tr><td colSpan={6} className="muted">No matching tokens.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "timers" && (
        <div className="card">
          <div style={{ fontWeight: 700 }}>Kick timer manager</div>
          <div className="muted" style={{ marginTop: 6 }}>View and delete persisted kick timers (your bot will also delete when it cancels).</div>
          <div className="hr" />
          <table className="table">
            <thead>
              <tr>
                <th>Channel</th>
                <th>Owner</th>
                <th>Started</th>
                <th>Hours</th>
                <th>Started by</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {timers.map((t) => (
                <tr key={t.channel_id}>
                  <td className="muted">{t.channel_id}</td>
                  <td className="muted">{t.owner_id}</td>
                  <td className="muted">{t.started_at}</td>
                  <td>{t.hours}</td>
                  <td className="muted">{t.started_by || "-"}</td>
                  <td><button className="btn btn-secondary" onClick={() => clearTimer(t.channel_id)}>Delete</button></td>
                </tr>
              ))}
              {!timers.length && <tr><td colSpan={6} className="muted">No kick timers found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === "audit" && (
        <div className="card">
          <div style={{ fontWeight: 700 }}>Audit log panel</div>
          <div className="muted" style={{ marginTop: 6 }}>
            Writes occur when you take actions in this dashboard. (If the table doesn’t exist yet, the API returns empty.)
          </div>
          <div className="hr" />
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Token</th>
                <th>Meta</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((a, idx) => (
                <tr key={a.id || idx}>
                  <td className="muted">{a.created_at || "-"}</td>
                  <td className="muted">{a.actor_username || a.actor_discord_id || "-"}</td>
                  <td>{a.action || "-"}</td>
                  <td className="muted">{a.token || "-"}</td>
                  <td className="muted"><pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{JSON.stringify(a.meta || {}, null, 2)}</pre></td>
                </tr>
              ))}
              {!audit.length && <tr><td colSpan={5} className="muted">No audit rows (or table not created yet).</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

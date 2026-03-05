"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Stoney Verify Dashboard — Mega TicketTool-style UI (Stoney Baloney Edition)
 * - Sidebar nav
 * - Overview KPIs + Hot Queue
 * - Verification queue with bulk approve/deny
 * - Tokens, Kick Timers
 * - VC Sessions
 * - Transcript viewer (best-effort)
 * - Staff stats (from audit log)
 * - Live monitor (SSE)
 */

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
  ai_status?: string | null;
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

type LiveEvent = { ts: number; type: string; payload: any };

type VcSessionRow = {
  id?: string;
  guild_id?: string | null;
  channel_id?: string | null;
  requester_id?: string | null;
  started_by?: string | null;
  started_at?: string | null;
  status?: string | null; // ACTIVE/ENDED/etc
  meta?: any;
};

type StaffStatRow = {
  actor_id: string | null;
  actor_name: string | null;
  approvals: number;
  denials: number;
  resubmits: number;
  total: number;
};

type TranscriptRow = {
  id?: string;
  channel_id?: string | null;
  guild_id?: string | null;
  ticket_no?: string | null;
  url?: string | null;
  created_at?: string | null;
  meta?: any;
};

type Tab =
  | "overview"
  | "verifications"
  | "tokens"
  | "timers"
  | "vc"
  | "transcripts"
  | "audit"
  | "stats"
  | "monitor"
  | "settings";

function fmtIso(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}
function relTime(iso?: string | null) {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diff = t - Date.now();
  const s = Math.round(Math.abs(diff) / 1000);
  const sign = diff < 0 ? "ago" : "from now";
  if (s < 60) return `${s}s ${sign}`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ${sign}`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ${sign}`;
  const d = Math.round(h / 24);
  return `${d}d ${sign}`;
}
function shortId(id?: string | null) {
  if (!id) return "—";
  if (id.length <= 10) return id;
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}
function discordChannelLink(guildId?: string | null, channelId?: string | null) {
  if (!guildId || !channelId) return null;
  return `https://discord.com/channels/${guildId}/${channelId}`;
}
function discordUserLink(userId?: string | null) {
  if (!userId) return null;
  return `https://discord.com/users/${userId}`;
}

async function jget<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return (await r.json()) as T;
}
async function jpost<T>(url: string, body: any): Promise<T> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return (await r.json()) as T;
}

function Tag({
  kind,
  children,
}: {
  kind?: "green" | "red" | "amber" | "gray";
  children: any;
}) {
  const cls =
    kind === "green"
      ? "sb-tag sb-tagGreen"
      : kind === "red"
      ? "sb-tag sb-tagRed"
      : kind === "amber"
      ? "sb-tag sb-tagAmber"
      : "sb-tag sb-tagGray";
  return <span className={cls}>{children}</span>;
}

function Btn({
  children,
  onClick,
  disabled,
  kind,
  title,
}: {
  children: any;
  onClick?: () => void;
  disabled?: boolean;
  kind?: "primary" | "danger" | "ghost";
  title?: string;
}) {
  const cls =
    kind === "danger"
      ? "sb-btn sb-btnDanger"
      : kind === "ghost"
      ? "sb-btn sb-btnGhost"
      : "sb-btn sb-btnPrimary";
  return (
    <button className={cls} onClick={onClick} disabled={disabled} title={title}>
      {children}
    </button>
  );
}

function Input({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      className="sb-input"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select className="sb-select" value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function Modal({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: any;
}) {
  if (!open) return null;
  return (
    <div className="sb-modalOverlay" role="dialog" aria-modal="true">
      <div className="sb-modal">
        <div className="sb-modalHeader">
          <div className="sb-modalTitle">{title}</div>
          <Btn kind="ghost" onClick={onClose}>
            ✕
          </Btn>
        </div>
        <div className="sb-modalBody">{children}</div>
      </div>
    </div>
  );
}

function Sidebar({
  tab,
  setTab,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
}) {
  const items: { id: Tab; label: string; icon: string }[] = [
    { id: "overview", label: "Overview", icon: "🏠" },
    { id: "verifications", label: "Verifications", icon: "🎫" },
    { id: "tokens", label: "Tokens", icon: "🔑" },
    { id: "timers", label: "Kick Timers", icon: "⏳" },
    { id: "vc", label: "VC Sessions", icon: "🎙️" },
    { id: "transcripts", label: "Transcripts", icon: "🧾" },
    { id: "audit", label: "Audit Log", icon: "📋" },
    { id: "stats", label: "Staff Stats", icon: "📈" },
    { id: "monitor", label: "Live Monitor", icon: "📡" },
    { id: "settings", label: "Settings", icon: "⚙️" },
  ];

  return (
    <aside className="sb-sidebar">
      <div className="sb-brand">
        <div className="sb-brandLogo">SB</div>
        <div className="sb-brandText">
          <div className="sb-brandTitle">Stoney Verify</div>
          <div className="sb-brandSub">Mega TicketTool Dashboard</div>
        </div>
      </div>

      <nav className="sb-nav">
        {items.map((it) => (
          <button
            key={it.id}
            className={it.id === tab ? "sb-navItem sb-navItemActive" : "sb-navItem"}
            onClick={() => setTab(it.id)}
          >
            <span className="sb-navIcon">{it.icon}</span>
            <span>{it.label}</span>
          </button>
        ))}
      </nav>

      <div className="sb-sidebarFooter">
        <div className="sb-muted">Stoney Baloney Edition</div>
      </div>
    </aside>
  );
}

function kpiCard(title: string, value: any, sub?: any) {
  return (
    <div className="sb-card">
      <div className="sb-kpiTitle">{title}</div>
      <div className="sb-kpiValue">{value}</div>
      <div className="sb-muted">{sub ?? "\u00A0"}</div>
    </div>
  );
}

function tokenStatusTag(t: TokenRow) {
  const d = (t.decision || "").toUpperCase();
  if (d === "APPROVED") return <Tag kind="green">APPROVED</Tag>;
  if (d === "DENIED") return <Tag kind="red">DENIED</Tag>;
  if (d.includes("RESUBMIT")) return <Tag kind="amber">RESUBMIT</Tag>;
  if (t.submitted) return <Tag kind="amber">SUBMITTED</Tag>;
  if (t.used) return <Tag kind="gray">USED</Tag>;
  return <Tag kind="gray">PENDING</Tag>;
}

export default function DashboardUI({ staffUser }: { staffUser: StaffUser }) {
  const [tab, setTab] = useState<Tab>("overview");

  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [timers, setTimers] = useState<KickTimerRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [live, setLive] = useState<LiveEvent[]>([]);
  const [vc, setVc] = useState<VcSessionRow[]>([]);
  const [stats, setStats] = useState<StaffStatRow[]>([]);
  const [transcripts, setTranscripts] = useState<TranscriptRow[]>([]);

  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [q, setQ] = useState("");
  const [tokenFilter, setTokenFilter] = useState<
    "all" | "pending" | "approved" | "denied" | "submitted"
  >("pending");

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const selectedTokens = useMemo(
    () => Object.keys(selected).filter((k) => selected[k]),
    [selected]
  );

  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [transcriptHtml, setTranscriptHtml] = useState<string>("");
  const [transcriptTitle, setTranscriptTitle] = useState<string>("Transcript");

  const liveRef = useRef<EventSource | null>(null);

  const roleHint = useMemo(() => {
    const n = staffUser.roles?.length ?? 0;
    return n ? `${n} role(s)` : "roles unknown";
  }, [staffUser.roles]);

  const filteredTokens = useMemo(() => {
    const qq = q.trim().toLowerCase();
    let arr = tokens.slice();

    if (tokenFilter !== "all") {
      arr = arr.filter((t) => {
        const d = (t.decision || "").toUpperCase();
        if (tokenFilter === "pending") return !d && !t.used;
        if (tokenFilter === "submitted") return t.submitted && !d;
        if (tokenFilter === "approved") return d === "APPROVED";
        if (tokenFilter === "denied") return d === "DENIED";
        return true;
      });
    }

    if (qq) {
      arr = arr.filter((t) => {
        return (
          (t.token || "").toLowerCase().includes(qq) ||
          (t.requester_id || "").toLowerCase().includes(qq) ||
          (t.channel_id || "").toLowerCase().includes(qq) ||
          (t.guild_id || "").toLowerCase().includes(qq) ||
          (t.decision || "").toLowerCase().includes(qq) ||
          (t.ai_status || "").toLowerCase().includes(qq)
        );
      });
    }

    // newest first
    arr.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return arr;
  }, [tokens, q, tokenFilter]);

  const pendingQueue = useMemo(() => {
    // “Hot queue” = submitted or pending (not decided), newest first
    const arr = tokens
      .filter((t) => !t.decision && !t.used)
      .slice()
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return arr.slice(0, 8);
  }, [tokens]);

  const kpis = useMemo(() => {
    const pending = tokens.filter((t) => !t.decision && !t.used).length;
    const submitted = tokens.filter((t) => t.submitted && !t.decision).length;
    const approved = tokens.filter((t) => (t.decision || "").toUpperCase() === "APPROVED").length;
    const denied = tokens.filter((t) => (t.decision || "").toUpperCase() === "DENIED").length;
    const activeTimers = timers.length;
    const liveCount = live.length;
    const activeVc = vc.filter((s) => (s.status || "").toUpperCase().includes("ACTIVE")).length;
    return { pending, submitted, approved, denied, activeTimers, liveCount, activeVc };
  }, [tokens, timers, live, vc]);

  async function refreshAll() {
    setErr(null);
    try {
      const [toks, ks, au, vcRows, st, tr] = await Promise.all([
        jget<{ rows: TokenRow[] }>("/api/tokens"),
        jget<{ rows: KickTimerRow[] }>("/api/timers"),
        jget<{ rows: AuditRow[] }>("/api/audit"),
        jget<{ rows: VcSessionRow[] }>("/api/vc-sessions"),
        jget<{ rows: StaffStatRow[] }>("/api/stats"),
        jget<{ rows: TranscriptRow[] }>("/api/transcripts"),
      ]);
      setTokens(toks.rows || []);
      setTimers(ks.rows || []);
      setAudit(au.rows || []);
      setVc(vcRows.rows || []);
      setStats(st.rows || []);
      setTranscripts(tr.rows || []);
    } catch (e: any) {
      setErr(String(e?.message || e));
    }
  }

  async function actDecision(token: string, decision: string) {
    setBusy(true);
    setErr(null);
    try {
      await jpost("/api/decision", { token, decision });
      setToast(`${decision} → ${token}`);
      await refreshAll();
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function bulkDecision(decision: string) {
    const list = selectedTokens.slice();
    if (!list.length) return;
    setBusy(true);
    setErr(null);
    try {
      // Fire sequentially to keep your bot endpoint from getting slammed
      for (const token of list) {
        await jpost("/api/decision", { token, decision });
      }
      setToast(`${decision} → ${list.length} token(s)`);
      setSelected({});
      await refreshAll();
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function cancelTimer(channel_id: string) {
    setBusy(true);
    setErr(null);
    try {
      await jpost("/api/timers/delete", { channel_id });
      setToast(`Timer cancelled for ${channel_id}`);
      await refreshAll();
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function openTranscript(tr: TranscriptRow) {
    setTranscriptTitle(tr.ticket_no ? `Transcript • #${tr.ticket_no}` : "Transcript");
    setTranscriptHtml("");
    setTranscriptOpen(true);

    try {
      const r = await jpost<{ html?: string; url?: string; error?: string }>("/api/transcripts/view", {
        channel_id: tr.channel_id,
        url: tr.url,
        ticket_no: tr.ticket_no,
      });
      if (r.html) setTranscriptHtml(r.html);
      else if (r.url) setTranscriptHtml(`<p><a href="${r.url}" target="_blank" rel="noreferrer">Open transcript link</a></p>`);
      else setTranscriptHtml(`<p class="sb-muted">No transcript HTML available.</p>`);
    } catch (e: any) {
      setTranscriptHtml(`<p class="sb-muted">Failed to load transcript: ${String(e?.message || e)}</p>`);
    }
  }

  function startLive() {
    if (liveRef.current) return;
    try {
      const es = new EventSource("/api/monitor");
      liveRef.current = es;

      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          setLive((prev) => {
            const next = [{ ts: Date.now(), type: data?.type || "event", payload: data }, ...prev];
            return next.slice(0, 250);
          });
        } catch {
          // ignore
        }
      };

      es.onerror = () => {
        // auto-close; user can re-open
        try {
          es.close();
        } catch {}
        liveRef.current = null;
      };
    } catch (e) {
      // ignore
    }
  }

  function stopLive() {
    if (!liveRef.current) return;
    try {
      liveRef.current.close();
    } catch {}
    liveRef.current = null;
  }

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tab === "monitor") startLive();
    else stopLive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const content = (
    <div className="sb-content">
      <header className="sb-topbar">
        <div className="sb-topLeft">
          <div className="sb-h1">Control Hub</div>
          <div className="sb-muted">
            Signed in as <span className="sb-mono">{staffUser.username}</span> •{" "}
            <span className="sb-mono">{shortId(staffUser.id)}</span> • {roleHint}
          </div>
        </div>

        <div className="sb-topRight">
          <Btn kind="ghost" onClick={() => refreshAll()} disabled={busy} title="Refresh">
            ↻ Refresh
          </Btn>
        </div>
      </header>

      {err ? (
        <div className="sb-alert sb-alertRed">
          <strong>Oops:</strong> <span className="sb-mono">{err}</span>
        </div>
      ) : null}

      {toast ? (
        <div className="sb-toast">
          <span>{toast}</span>
        </div>
      ) : null}

      {tab === "overview" ? (
        <div className="sb-grid">
          <div className="sb-kpis">
            {kpiCard("Pending", kpis.pending, "not decided")}
            {kpiCard("Submitted", kpis.submitted, "awaiting staff")}
            {kpiCard("Approved", kpis.approved, "decided")}
            {kpiCard("Denied", kpis.denied, "decided")}
            {kpiCard("Kick Timers", kpis.activeTimers, "active")}
            {kpiCard("VC Sessions", kpis.activeVc, "active")}
            {kpiCard("Live Events", kpis.liveCount, "cached")}
          </div>

          <div className="sb-row">
            <div className="sb-card sb-span2">
              <div className="sb-cardHeader">
                <div>
                  <div className="sb-cardTitle">🔥 Hot Queue</div>
                  <div className="sb-muted">Newest pending verifications</div>
                </div>
                <div className="sb-actions">
                  <Btn kind="ghost" onClick={() => setTab("verifications")}>
                    Open queue →
                  </Btn>
                </div>
              </div>

              <div className="sb-tableWrap">
                <table className="sb-table">
                  <thead>
                    <tr>
                      <th>Token</th>
                      <th>User</th>
                      <th>Ticket</th>
                      <th>Status</th>
                      <th>Expires</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingQueue.length ? (
                      pendingQueue.map((t) => {
                        const u = discordUserLink(t.requester_id);
                        const ch = discordChannelLink(t.guild_id, t.channel_id);
                        return (
                          <tr key={t.token}>
                            <td className="sb-mono">{t.token}</td>
                            <td>
                              {u ? (
                                <a className="sb-link" href={u} target="_blank" rel="noreferrer">
                                  {shortId(t.requester_id)}
                                </a>
                              ) : (
                                <span className="sb-mono">{shortId(t.requester_id)}</span>
                              )}
                            </td>
                            <td>
                              {ch ? (
                                <a className="sb-link" href={ch} target="_blank" rel="noreferrer">
                                  {shortId(t.channel_id)}
                                </a>
                              ) : (
                                <span className="sb-mono">{shortId(t.channel_id)}</span>
                              )}
                            </td>
                            <td>{tokenStatusTag(t)}</td>
                            <td>
                              <span className="sb-mono">{relTime(t.expires_at)}</span>
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <div className="sb-actions">
                                <Btn kind="primary" disabled={busy} onClick={() => actDecision(t.token, "APPROVED")}>
                                  Approve
                                </Btn>
                                <Btn kind="danger" disabled={busy} onClick={() => actDecision(t.token, "DENIED")}>
                                  Deny
                                </Btn>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} className="sb-muted">
                          No pending tokens 🎉
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="sb-card">
              <div className="sb-cardHeader">
                <div>
                  <div className="sb-cardTitle">Quick Jump</div>
                  <div className="sb-muted">Pick a module</div>
                </div>
              </div>
              <div className="sb-stack">
                <Btn kind="ghost" onClick={() => setTab("verifications")}>
                  🎫 Verifications
                </Btn>
                <Btn kind="ghost" onClick={() => setTab("tokens")}>
                  🔑 Tokens
                </Btn>
                <Btn kind="ghost" onClick={() => setTab("timers")}>
                  ⏳ Kick Timers
                </Btn>
                <Btn kind="ghost" onClick={() => setTab("vc")}>
                  🎙️ VC Sessions
                </Btn>
                <Btn kind="ghost" onClick={() => setTab("transcripts")}>
                  🧾 Transcripts
                </Btn>
                <Btn kind="ghost" onClick={() => setTab("audit")}>
                  📋 Audit Log
                </Btn>
                <Btn kind="ghost" onClick={() => setTab("stats")}>
                  📈 Staff Stats
                </Btn>
                <Btn kind="ghost" onClick={() => setTab("monitor")}>
                  📡 Live Monitor
                </Btn>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {tab === "verifications" || tab === "tokens" ? (
        <div className="sb-card">
          <div className="sb-cardHeader">
            <div>
              <div className="sb-cardTitle">{tab === "verifications" ? "Verification Queue" : "Token Manager"}</div>
              <div className="sb-muted">
                Search, filter, bulk actions • Tip: use “submitted” to find people waiting on staff
              </div>
            </div>
            <div className="sb-actions">
              <Input value={q} onChange={setQ} placeholder="Search token / user / channel / status…" />
              <Select
                value={tokenFilter}
                onChange={(v) => setTokenFilter(v as any)}
                options={[
                  { value: "pending", label: "Pending" },
                  { value: "submitted", label: "Submitted" },
                  { value: "approved", label: "Approved" },
                  { value: "denied", label: "Denied" },
                  { value: "all", label: "All" },
                ]}
              />
              <Btn kind="primary" disabled={busy || !selectedTokens.length} onClick={() => bulkDecision("APPROVED")}>
                Approve selected
              </Btn>
              <Btn kind="danger" disabled={busy || !selectedTokens.length} onClick={() => bulkDecision("DENIED")}>
                Deny selected
              </Btn>
            </div>
          </div>

          <div className="sb-tableWrap">
            <table className="sb-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>
                    <input
                      type="checkbox"
                      checked={selectedTokens.length > 0 && selectedTokens.length === filteredTokens.length}
                      onChange={(e) => {
                        const v = e.target.checked;
                        const next: Record<string, boolean> = {};
                        for (const t of filteredTokens) next[t.token] = v;
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
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTokens.length ? (
                  filteredTokens.map((t) => {
                    const u = discordUserLink(t.requester_id);
                    const ch = discordChannelLink(t.guild_id, t.channel_id);
                    return (
                      <tr key={t.token}>
                        <td>
                          <input
                            type="checkbox"
                            checked={!!selected[t.token]}
                            onChange={(e) => setSelected((prev) => ({ ...prev, [t.token]: e.target.checked }))}
                          />
                        </td>
                        <td className="sb-mono">{t.token}</td>
                        <td>
                          {u ? (
                            <a className="sb-link" href={u} target="_blank" rel="noreferrer">
                              {shortId(t.requester_id)}
                            </a>
                          ) : (
                            <span className="sb-mono">{shortId(t.requester_id)}</span>
                          )}
                        </td>
                        <td>
                          {ch ? (
                            <a className="sb-link" href={ch} target="_blank" rel="noreferrer">
                              {shortId(t.channel_id)}
                            </a>
                          ) : (
                            <span className="sb-mono">{shortId(t.channel_id)}</span>
                          )}
                        </td>
                        <td>{tokenStatusTag(t)}</td>
                        <td>
                          <span className="sb-mono">{relTime(t.created_at)}</span>
                        </td>
                        <td>
                          <span className="sb-mono">{relTime(t.expires_at)}</span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div className="sb-actions">
                            <Btn kind="primary" disabled={busy} onClick={() => actDecision(t.token, "APPROVED")}>
                              Approve
                            </Btn>
                            <Btn kind="danger" disabled={busy} onClick={() => actDecision(t.token, "DENIED")}>
                              Deny
                            </Btn>
                            <Btn kind="ghost" disabled={busy} onClick={() => actDecision(t.token, "RESUBMIT REQUESTED")}>
                              Resubmit
                            </Btn>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="sb-muted">
                      No results.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "timers" ? (
        <div className="sb-card">
          <div className="sb-cardHeader">
            <div>
              <div className="sb-cardTitle">Kick Timers</div>
              <div className="sb-muted">Cancel a timer if a user is verified or you need to stop an auto-kick.</div>
            </div>
          </div>
          <div className="sb-tableWrap">
            <table className="sb-table">
              <thead>
                <tr>
                  <th>Owner</th>
                  <th>Ticket</th>
                  <th>Hours</th>
                  <th>Started</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {timers.length ? (
                  timers.map((t) => {
                    const u = discordUserLink(t.owner_id);
                    const ch = discordChannelLink(t.guild_id, t.channel_id);
                    return (
                      <tr key={t.channel_id}>
                        <td>
                          {u ? (
                            <a className="sb-link" href={u} target="_blank" rel="noreferrer">
                              {shortId(t.owner_id)}
                            </a>
                          ) : (
                            <span className="sb-mono">{shortId(t.owner_id)}</span>
                          )}
                        </td>
                        <td>
                          {ch ? (
                            <a className="sb-link" href={ch} target="_blank" rel="noreferrer">
                              {shortId(t.channel_id)}
                            </a>
                          ) : (
                            <span className="sb-mono">{shortId(t.channel_id)}</span>
                          )}
                        </td>
                        <td className="sb-mono">{t.hours}</td>
                        <td className="sb-mono">
                          {fmtIso(t.started_at)} • {relTime(t.started_at)}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <Btn kind="danger" disabled={busy} onClick={() => cancelTimer(t.channel_id)}>
                            Cancel
                          </Btn>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="sb-muted">
                      No active kick timers.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "vc" ? (
        <div className="sb-card">
          <div className="sb-cardHeader">
            <div>
              <div className="sb-cardTitle">VC Sessions</div>
              <div className="sb-muted">
                Best-effort view (table names vary). If it shows empty, we’ll map it to your exact Supabase table name.
              </div>
            </div>
          </div>
          <div className="sb-tableWrap">
            <table className="sb-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>User</th>
                  <th>Channel</th>
                  <th>Started</th>
                  <th>Meta</th>
                </tr>
              </thead>
              <tbody>
                {vc.length ? (
                  vc.map((s, idx) => {
                    const u = discordUserLink(s.requester_id || null);
                    const ch = discordChannelLink(s.guild_id || null, s.channel_id || null);
                    return (
                      <tr key={String(s.id || idx)}>
                        <td>
                          <Tag kind={(s.status || "").toUpperCase().includes("ACTIVE") ? "green" : "gray"}>
                            {(s.status || "—").toString()}
                          </Tag>
                        </td>
                        <td>
                          {u ? (
                            <a className="sb-link" href={u} target="_blank" rel="noreferrer">
                              {shortId(s.requester_id || "")}
                            </a>
                          ) : (
                            <span className="sb-mono">{shortId(s.requester_id || "")}</span>
                          )}
                        </td>
                        <td>
                          {ch ? (
                            <a className="sb-link" href={ch} target="_blank" rel="noreferrer">
                              {shortId(s.channel_id || "")}
                            </a>
                          ) : (
                            <span className="sb-mono">{shortId(s.channel_id || "")}</span>
                          )}
                        </td>
                        <td className="sb-mono">{fmtIso(s.started_at || null)}</td>
                        <td>
                          <details>
                            <summary className="sb-link">view</summary>
                            <pre className="sb-pre">{JSON.stringify(s.meta ?? {}, null, 2)}</pre>
                          </details>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="sb-muted">
                      No VC sessions found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "transcripts" ? (
        <div className="sb-card">
          <div className="sb-cardHeader">
            <div>
              <div className="sb-cardTitle">Transcripts</div>
              <div className="sb-muted">
                Shows transcript links/rows if present. You can open them in a modal (HTML) or as a link.
              </div>
            </div>
          </div>
          <div className="sb-tableWrap">
            <table className="sb-table">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Channel</th>
                  <th>Created</th>
                  <th>Link</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {transcripts.length ? (
                  transcripts.map((tr, idx) => {
                    const ch = discordChannelLink(tr.guild_id || null, tr.channel_id || null);
                    return (
                      <tr key={String(tr.id || idx)}>
                        <td className="sb-mono">{tr.ticket_no || "—"}</td>
                        <td>
                          {ch ? (
                            <a className="sb-link" href={ch} target="_blank" rel="noreferrer">
                              {shortId(tr.channel_id || "")}
                            </a>
                          ) : (
                            <span className="sb-mono">{shortId(tr.channel_id || "")}</span>
                          )}
                        </td>
                        <td className="sb-mono">{fmtIso(tr.created_at || null)}</td>
                        <td className="sb-mono">
                          {tr.url ? (
                            <a className="sb-link" href={tr.url} target="_blank" rel="noreferrer">
                              open
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <Btn kind="ghost" onClick={() => openTranscript(tr)}>
                            View
                          </Btn>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="sb-muted">
                      No transcripts found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "audit" ? (
        <div className="sb-card">
          <div className="sb-cardHeader">
            <div>
              <div className="sb-cardTitle">Audit Log</div>
              <div className="sb-muted">Recent staff actions. Expand meta to see full context.</div>
            </div>
          </div>
          <div className="sb-tableWrap">
            <table className="sb-table">
              <thead>
                <tr>
                  <th>At</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Meta</th>
                </tr>
              </thead>
              <tbody>
                {audit.length ? (
                  audit.map((a, idx) => (
                    <tr key={String(a.id || idx)}>
                      <td className="sb-mono">{fmtIso(a.at)}</td>
                      <td className="sb-mono">{a.actor_name || shortId(a.actor_id)}</td>
                      <td>
                        <Tag kind={a.action.toUpperCase().includes("DENY") ? "red" : a.action.toUpperCase().includes("APPROV") ? "green" : "gray"}>
                          {a.action}
                        </Tag>
                      </td>
                      <td>
                        <details>
                          <summary className="sb-link">view</summary>
                          <pre className="sb-pre">{JSON.stringify(a.meta ?? {}, null, 2)}</pre>
                        </details>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="sb-muted">
                      No audit entries found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "stats" ? (
        <div className="sb-card">
          <div className="sb-cardHeader">
            <div>
              <div className="sb-cardTitle">Staff Stats</div>
              <div className="sb-muted">Based on audit log entries (approvals/denials/resubmits).</div>
            </div>
          </div>
          <div className="sb-tableWrap">
            <table className="sb-table">
              <thead>
                <tr>
                  <th>Staff</th>
                  <th>Approvals</th>
                  <th>Denials</th>
                  <th>Resubmits</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {stats.length ? (
                  stats
                    .slice()
                    .sort((a, b) => b.total - a.total)
                    .map((s, idx) => (
                      <tr key={`${s.actor_id || "x"}-${idx}`}>
                        <td className="sb-mono">{s.actor_name || shortId(s.actor_id)}</td>
                        <td className="sb-mono">{s.approvals}</td>
                        <td className="sb-mono">{s.denials}</td>
                        <td className="sb-mono">{s.resubmits}</td>
                        <td className="sb-mono">{s.total}</td>
                      </tr>
                    ))
                ) : (
                  <tr>
                    <td colSpan={5} className="sb-muted">
                      No stats yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "monitor" ? (
        <div className="sb-card">
          <div className="sb-cardHeader">
            <div>
              <div className="sb-cardTitle">Live Monitor</div>
              <div className="sb-muted">SSE event feed from /api/monitor. Auto-reconnects when you re-open this tab.</div>
            </div>
            <div className="sb-actions">
              <Btn kind="ghost" onClick={() => setLive([])}>
                Clear
              </Btn>
            </div>
          </div>
          <div className="sb-feed">
            {live.length ? (
              live.map((e, idx) => (
                <div className="sb-feedItem" key={idx}>
                  <div className="sb-feedTop">
                    <span className="sb-mono">{new Date(e.ts).toLocaleTimeString()}</span>
                    <Tag kind="gray">{e.type}</Tag>
                  </div>
                  <pre className="sb-pre">{JSON.stringify(e.payload ?? {}, null, 2)}</pre>
                </div>
              ))
            ) : (
              <div className="sb-muted">No live events yet. Leave this tab open while actions happen.</div>
            )}
          </div>
        </div>
      ) : null}

      {tab === "settings" ? (
        <div className="sb-card">
          <div className="sb-cardHeader">
            <div>
              <div className="sb-cardTitle">Settings</div>
              <div className="sb-muted">This panel is intentionally safe — secrets stay in Vercel env vars.</div>
            </div>
          </div>
          <div className="sb-stack">
            <div className="sb-card sb-cardInset">
              <div className="sb-muted">
                <strong>BOT_ACTIONS_URL</strong> and <strong>BOT_ACTIONS_SECRET</strong> power staff decisions.
              </div>
              <div className="sb-muted">
                <strong>Supabase</strong> keys power tokens/timers/audit.
              </div>
            </div>
            <div className="sb-card sb-cardInset">
              <div className="sb-muted">
                Want usernames/avatars like TicketTool? Add an optional lookup endpoint in the bot and we’ll wire a bulk user cache.
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <Modal title={transcriptTitle} open={transcriptOpen} onClose={() => setTranscriptOpen(false)}>
        <div className="sb-transcript" dangerouslySetInnerHTML={{ __html: transcriptHtml || "<p class='sb-muted'>Loading…</p>" }} />
      </Modal>
    </div>
  );

  return (
    <div className="sb-shell">
      <Sidebar tab={tab} setTab={setTab} />
      {content}
    </div>
  );
}

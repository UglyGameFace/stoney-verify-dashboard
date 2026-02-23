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

type LiveEvent = {
  ts: number;
  type: string;
  payload: any;
};

function fmtIso(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function badge(text: string) {
  return (
    <span
      style={{
        fontSize: 12,
        padding: "2px 8px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.2)",
        background: "rgba(255,255,255,0.06)",
        marginRight: 6,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      {text}
    </span>
  );
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

export default function DashboardUI({ staffUser }: { staffUser: StaffUser }) {
  const [tab, setTab] = useState<"monitor" | "tokens" | "timers" | "audit">("monitor");

  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [timers, setTimers] = useState<KickTimerRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [live, setLive] = useState<LiveEvent[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const liveRef = useRef<EventSource | null>(null);

  const staffRoleHint = useMemo(() => {
    const n = staffUser.roles?.length ?? 0;
    return n ? `${n} role(s)` : "roles unknown";
  }, [staffUser.roles]);

  const refreshTokens = async () => {
    const data = await jget<{ rows: TokenRow[] }>("/api/tokens");
    setTokens(data.rows || []);
  };

  const refreshTimers = async () => {
    const data = await jget<{ rows: KickTimerRow[] }>("/api/timers");
    setTimers(data.rows || []);
  };

  const refreshAudit = async () => {
    const data = await jget<{ rows: AuditRow[] }>("/api/audit");
    setAudit(data.rows || []);
  };

  const refreshAll = async () => {
    setErr(null);
    setBusy(true);
    try {
      await Promise.all([refreshTokens(), refreshTimers(), refreshAudit()]);
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const connectLive = () => {
    try {
      if (liveRef.current) liveRef.current.close();
      const es = new EventSource("/api/monitor");
      liveRef.current = es;

      es.onmessage = (evt) => {
        try {
          const payload = JSON.parse(evt.data);
          const ev: LiveEvent = { ts: Date.now(), type: payload.type || "event", payload };
          setLive((prev) => [ev, ...prev].slice(0, 200));
        } catch {
          // ignore
        }
      };

      es.onerror = () => {
        // Let browser retry; show a tiny hint
      };
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    refreshAll();
    connectLive();
    return () => {
      if (liveRef.current) liveRef.current.close();
      liveRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const approveToken = async (token: string) => {
    setErr(null);
    setBusy(true);
    try {
      await jpost("/api/decision", { token, decision: "APPROVED", actorId: staffUser.id, actorName: staffUser.username });
      await refreshAll();
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const denyToken = async (token: string) => {
    setErr(null);
    setBusy(true);
    try {
      await jpost("/api/decision", { token, decision: "DENIED", actorId: staffUser.id, actorName: staffUser.username });
      await refreshAll();
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const deleteTimer = async (channelId: string) => {
    setErr(null);
    setBusy(true);
    try {
      await jpost("/api/timers/delete", { channel_id: channelId, actorId: staffUser.id, actorName: staffUser.username });
      await refreshAll();
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
        color: "white",
        background: "#0b0f14",
        minHeight: "calc(100vh - 48px)",
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.08)",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: 16, borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", gap: 12, alignItems: "center" }}>
        <div style={{ fontWeight: 800, letterSpacing: 0.2 }}>Stoney Verify Dashboard</div>
        <div style={{ opacity: 0.8, fontSize: 13 }}>
          Signed in as <b>{staffUser.username}</b> ({staffRoleHint})
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button
            onClick={refreshAll}
            disabled={busy}
            style={{
              padding: "8px 12px",
              borderRadius: 12,
              background: "rgba(255,255,255,0.08)",
              color: "white",
              border: "1px solid rgba(255,255,255,0.12)",
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            {busy ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {err ? (
        <div style={{ padding: 12, background: "rgba(255,0,0,0.12)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <b>Error:</b> {err}
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 8, padding: 12, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        {(["monitor", "tokens", "timers", "audit"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "8px 12px",
              borderRadius: 12,
              background: tab === t ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.06)",
              color: "white",
              border: "1px solid rgba(255,255,255,0.12)",
              cursor: "pointer",
              textTransform: "capitalize",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      <div style={{ padding: 16 }}>
        {tab === "monitor" ? (
          <div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
              {badge("🔔 Live verification monitor")}
              <span style={{ opacity: 0.75, fontSize: 13 }}>Live feed is pushed from /api/monitor (SSE).</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
              {live.length === 0 ? (
                <div style={{ opacity: 0.7 }}>No live events yet.</div>
              ) : (
                live.map((ev, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: 12,
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.10)",
                      background: "rgba(255,255,255,0.04)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ fontWeight: 700 }}>{ev.type}</div>
                      <div style={{ opacity: 0.65, fontSize: 12 }}>{new Date(ev.ts).toLocaleTimeString()}</div>
                    </div>
                    <pre style={{ margin: 0, marginTop: 8, whiteSpace: "pre-wrap", wordBreak: "break-word", opacity: 0.9, fontSize: 12 }}>
                      {JSON.stringify(ev.payload, null, 2)}
                    </pre>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}

        {tab === "tokens" ? (
          <div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
              {badge("🛠 Manual approve/deny")}
              {badge("🧾 Token viewer")}
              <span style={{ opacity: 0.75, fontSize: 13 }}>Pulled from Supabase table verification_tokens.</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
              {tokens.length === 0 ? (
                <div style={{ opacity: 0.7 }}>No tokens found.</div>
              ) : (
                tokens.map((r) => (
                  <div
                    key={r.token}
                    style={{
                      padding: 12,
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.10)",
                      background: "rgba(255,255,255,0.04)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                      <div style={{ fontWeight: 800, letterSpacing: 0.2 }}>{r.token}</div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={() => approveToken(r.token)}
                          disabled={busy}
                          style={{
                            padding: "8px 10px",
                            borderRadius: 10,
                            background: "rgba(0,255,0,0.10)",
                            color: "white",
                            border: "1px solid rgba(0,255,0,0.25)",
                            cursor: busy ? "not-allowed" : "pointer",
                          }}
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => denyToken(r.token)}
                          disabled={busy}
                          style={{
                            padding: "8px 10px",
                            borderRadius: 10,
                            background: "rgba(255,0,0,0.10)",
                            color: "white",
                            border: "1px solid rgba(255,0,0,0.25)",
                            cursor: busy ? "not-allowed" : "pointer",
                          }}
                        >
                          Deny
                        </button>
                      </div>
                    </div>

                    <div style={{ marginTop: 10, opacity: 0.85, fontSize: 13, lineHeight: 1.4 }}>
                      <div>guild: {r.guild_id || "—"} | channel: {r.channel_id || "—"} | requester: {r.requester_id || "—"}</div>
                      <div>expires: {fmtIso(r.expires_at)} | created: {fmtIso(r.created_at)}</div>
                      <div>
                        used: <b>{String(r.used)}</b> | submitted: <b>{String(r.submitted)}</b> | decision: <b>{r.decision || "—"}</b>
                      </div>
                      <div>decided_by: {r.decided_by || "—"} | decided_at: {fmtIso(r.decided_at)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}

        {tab === "timers" ? (
          <div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
              {badge("⏳ Kick timer manager")}
              <span style={{ opacity: 0.75, fontSize: 13 }}>Pulled from Supabase table verification_kick_timers.</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
              {timers.length === 0 ? (
                <div style={{ opacity: 0.7 }}>No timers found.</div>
              ) : (
                timers.map((t) => (
                  <div
                    key={t.channel_id}
                    style={{
                      padding: 12,
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.10)",
                      background: "rgba(255,255,255,0.04)",
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      alignItems: "center",
                    }}
                  >
                    <div style={{ opacity: 0.9, fontSize: 13, lineHeight: 1.4 }}>
                      <div style={{ fontWeight: 800 }}>{t.channel_id}</div>
                      <div>guild: {t.guild_id} | owner: {t.owner_id} | started_by: {t.started_by || "—"}</div>
                      <div>started: {fmtIso(t.started_at)} | hours: {t.hours}</div>
                    </div>

                    <button
                      onClick={() => deleteTimer(t.channel_id)}
                      disabled={busy}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 10,
                        background: "rgba(255,255,255,0.06)",
                        color: "white",
                        border: "1px solid rgba(255,255,255,0.12)",
                        cursor: busy ? "not-allowed" : "pointer",
                      }}
                    >
                      Delete Timer
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}

        {tab === "audit" ? (
          <div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
              {badge("📜 Audit log panel")}
              <span style={{ opacity: 0.75, fontSize: 13 }}>Pulled from Supabase table audit_logs.</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
              {audit.length === 0 ? (
                <div style={{ opacity: 0.7 }}>No audit logs found.</div>
              ) : (
                audit.map((a, idx) => (
                  <div
                    key={a.id || idx}
                    style={{
                      padding: 12,
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.10)",
                      background: "rgba(255,255,255,0.04)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ fontWeight: 800 }}>{a.action}</div>
                      <div style={{ opacity: 0.65, fontSize: 12 }}>{fmtIso(a.at)}</div>
                    </div>
                    <div style={{ marginTop: 6, opacity: 0.85, fontSize: 13 }}>
                      actor: {a.actor_name || "—"} ({a.actor_id || "—"})
                    </div>
                    <pre style={{ margin: 0, marginTop: 8, whiteSpace: "pre-wrap", wordBreak: "break-word", opacity: 0.9, fontSize: 12 }}>
                      {JSON.stringify(a.meta ?? {}, null, 2)}
                    </pre>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

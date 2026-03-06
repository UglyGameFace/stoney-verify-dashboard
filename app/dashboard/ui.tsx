"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type StaffUser = {
  userId: string;
  id?: string;
  username: string;
  roles: string[];
  guildId: string | null;
  avatar?: string | null;
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
  submitted_at?: string | null;
  ai_status?: string | null;
  owner_display_name?: string | null;
  owner_username?: string | null;
  owner_tag?: string | null;
  status?: string | null;
  requester_display_name?: string | null;
  requester_username?: string | null;
  requester_avatar_url?: string | null;
  requester_role_ids?: string[] | null;
  requester_role_names?: string[] | null;
  expected_role_state?: string | null;
  actual_role_state?: string | null;
  role_sync_ok?: boolean | null;
  role_sync_reason?: string | null;
  decided_by_display_name?: string | null;
  decided_by_username?: string | null;
  decided_by_avatar_url?: string | null;
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
  at?: string;
  created_at?: string;
  actor_id?: string | null;
  actor_name?: string | null;
  staff_id?: string | null;
  action: string;
  meta: any;
};

type MemberRow = {
  guild_id: string;
  user_id: string;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  role_ids?: string[] | null;
  role_names?: string[] | null;
  highest_role_id?: string | null;
  highest_role_name?: string | null;
  in_guild?: boolean | null;
  has_any_role?: boolean | null;
  data_health?: string | null;
  synced_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  has_unverified?: boolean | null;
  has_verified_role?: boolean | null;
  has_staff_role?: boolean | null;
  has_secondary_verified_role?: boolean | null;
  has_cosmetic_only?: boolean | null;
  role_state?: string | null;
  role_state_reason?: string | null;
};

type Stats = {
  pending: number;
  submitted: number;
  approved: number;
  denied: number;
  kickTimers: number;
  liveEvents: number;
  vcSessions: number;
  roleConflicts?: number;
  missingVerifiedRole?: number;
  missingUnverified?: number;
  boosterOnly?: number;
  staffConflicts?: number;
};

type ModuleKey =
  | "overview"
  | "verifications"
  | "members"
  | "kickTimers"
  | "audit"
  | "liveMonitor"
  | "settings";

type RoleInfo = { id: string; name: string; color?: number | null };

type ResolvedUser = {
  id: string;
  displayName: string;
  username?: string | null;
  avatarUrl?: string | null;
  roleIds: string[];
  roles: RoleInfo[];
  roleState?: string;
  roleStateReason?: string;
  hasUnverified?: boolean;
  hasVerifiedRole?: boolean;
  hasStaffRole?: boolean;
};

type ResolveResponse = {
  ok: boolean;
  guildId?: string | null;
  roles?: RoleInfo[];
  users?: Record<string, ResolvedUser>;
  error?: string;
};

const _resolveCache: Record<string, ResolvedUser> = {};

function fmt(ts?: string | null) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

function shortId(value?: string | null) {
  if (!value) return "—";
  const s = String(value);
  if (s.length <= 10) return s;
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

function decisionLabel(decision: string | null, used: boolean, submitted: boolean) {
  const d = String(decision || "").toUpperCase();
  if (d.includes("APPROVED")) return "APPROVED";
  if (d.includes("DENIED")) return "DENIED";
  if (d.includes("RESUBMIT")) return "RESUBMIT";
  if (submitted) return "SUBMITTED";
  if (used) return "USED";
  return "PENDING";
}

function effectiveStatus(row: TokenRow) {
  const explicit = String(row.status || "").trim().toUpperCase();
  if (explicit) return explicit;
  return decisionLabel(row.decision, row.used, row.submitted);
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

function roleStateClass(state?: string | null) {
  const s = String(state || "").toLowerCase();
  if (s === "verified_ok" || s === "staff_ok") return "sb-pill ok";
  if (s.includes("conflict")) return "sb-pill bad";
  if (s === "missing_verified_role" || s === "missing_unverified") return "sb-pill warn";
  if (s === "booster_only") return "sb-pill blue";
  if (s === "unverified_only") return "sb-pill";
  if (s === "left_guild") return "sb-pill bad";
  return "sb-pill";
}

function roleStateLabel(state?: string | null) {
  switch (String(state || "").toLowerCase()) {
    case "verified_ok":
      return "Verified";
    case "staff_ok":
      return "Staff";
    case "verified_conflict":
      return "Verified Conflict";
    case "staff_conflict":
      return "Staff Conflict";
    case "missing_verified_role":
      return "Missing Verified Role";
    case "missing_unverified":
      return "Missing Unverified";
    case "booster_only":
      return "Booster Only";
    case "unverified_only":
      return "Unverified";
    case "left_guild":
      return "Left Guild";
    default:
      return "Unknown";
  }
}

async function apiGet<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  return (await response.json()) as T;
}

async function apiPost<T>(url: string, body: any): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await response.json()) as T;
}

function bestName(user?: ResolvedUser | null) {
  return user?.displayName || user?.username || (user?.id ? `@${shortId(user.id)}` : "—");
}

function avatarFallback(id: string) {
  return `https://cdn.discordapp.com/embed/avatars/${Number(id) % 6}.png`;
}

async function resolveDiscordUsers(ids: string[], guildId?: string | null): Promise<Record<string, ResolvedUser>> {
  const unique = Array.from(new Set(ids.map(String).filter(Boolean)));
  const missing = unique.filter((id) => !_resolveCache[id]);

  if (missing.length) {
    const response = await apiPost<ResolveResponse>("/api/discord/resolve", {
      ids: missing,
      guildId: guildId || null,
    });

    if (response?.ok && response.users) {
      for (const [id, user] of Object.entries(response.users)) {
        _resolveCache[id] = user;
      }
    }
  }

  const out: Record<string, ResolvedUser> = {};
  for (const id of unique) {
    out[id] =
      _resolveCache[id] ||
      ({
        id,
        displayName: `@${shortId(id)}`,
        username: null,
        avatarUrl: avatarFallback(id),
        roleIds: [],
        roles: [],
        roleState: "unknown",
        roleStateReason: "Not resolved yet",
      } as ResolvedUser);
  }

  return out;
}

function RoleChips({ roles }: { roles: RoleInfo[] }) {
  if (!roles?.length) return null;

  return (
    <div className="sb-rolewrap" aria-label="roles">
      {roles.slice(0, 8).map((role) => (
        <span key={role.id} className="sb-role">
          {role.name}
        </span>
      ))}
      {roles.length > 8 ? <span className="sb-role more">+{roles.length - 8}</span> : null}
    </div>
  );
}

function RoleNameChips({ names }: { names?: string[] | null }) {
  if (!names?.length) return null;

  return (
    <div className="sb-rolewrap" aria-label="roles">
      {names.slice(0, 8).map((name) => (
        <span key={name} className="sb-role">
          {name}
        </span>
      ))}
      {names.length > 8 ? <span className="sb-role more">+{names.length - 8}</span> : null}
    </div>
  );
}

function UserInline({ user }: { user?: ResolvedUser | null }) {
  if (!user?.id) return <span>—</span>;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
      <img
        src={user.avatarUrl || avatarFallback(user.id)}
        alt={bestName(user)}
        width={34}
        height={34}
        style={{
          width: 34,
          height: 34,
          borderRadius: 999,
          objectFit: "cover",
          flex: "0 0 auto",
          border: "1px solid rgba(255,255,255,.12)",
        }}
      />
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontWeight: 800,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {bestName(user)}
        </div>
        {user.username ? (
          <div
            className="sb-muted"
            style={{
              fontSize: 12,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            @{user.username}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MemberInline({ member }: { member: MemberRow }) {
  const avatar = member.avatar_url || avatarFallback(member.user_id);
  const displayName = member.display_name || member.username || `@${shortId(member.user_id)}`;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
      <img
        src={avatar}
        alt={displayName}
        width={38}
        height={38}
        style={{
          width: 38,
          height: 38,
          borderRadius: 999,
          objectFit: "cover",
          flex: "0 0 auto",
          border: "1px solid rgba(255,255,255,.12)",
        }}
      />
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontWeight: 800,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {displayName}
        </div>
        <div
          className="sb-muted"
          style={{
            fontSize: 12,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {member.username ? `@${member.username}` : shortId(member.user_id)}
        </div>
      </div>
    </div>
  );
}

function useIsMobile(breakpoint = 920) {
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width:${breakpoint}px)`);
    const onChange = () => setMobile(mq.matches);
    onChange();
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [breakpoint]);

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
    roleConflicts: 0,
    missingVerifiedRole: 0,
    missingUnverified: 0,
    boosterOnly: 0,
    staffConflicts: 0,
  });

  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [timers, setTimers] = useState<KickTimerRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [resolved, setResolved] = useState<Record<string, ResolvedUser>>({});

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [queueSearch, setQueueSearch] = useState("");
  const [status, setStatus] = useState<"pending" | "submitted" | "approved" | "denied" | "used">("pending");
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const [memberSearch, setMemberSearch] = useState("");
  const [memberRoleStateFilter, setMemberRoleStateFilter] = useState("");

  const [events, setEvents] = useState<any[]>([]);
  const sseRef = useRef<EventSource | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [modal, setModal] = useState<{ title: string; body: any } | null>(null);

  const primaryNav = useMemo(
    () => [
      { k: "overview" as const, label: "Home", ico: "🏠" },
      { k: "verifications" as const, label: "Queue", ico: "🧾" },
      { k: "members" as const, label: "Members", ico: "👥" },
      { k: "kickTimers" as const, label: "Timers", ico: "⏳" },
      { k: "audit" as const, label: "Audit", ico: "🧷" },
    ],
    []
  );

  const drawerNav = useMemo(
    () => [
      { k: "liveMonitor" as const, label: "📡 Live Monitor" },
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

      const currentMe: StaffUser = {
        userId: String(meRes.userId || meRes.session?.userId || ""),
        id: String(meRes.userId || meRes.id || meRes.session?.userId || ""),
        username: String(meRes.username || meRes.session?.username || ""),
        roles: Array.isArray(meRes.roles)
          ? meRes.roles
          : Array.isArray(meRes.session?.roles)
            ? meRes.session.roles
            : [],
        guildId: String(meRes.guildId || meRes.session?.guildId || "") || null,
        avatar: meRes.avatar || meRes.session?.avatar || null,
      };

      setMe(currentMe);

      const [statsRes, tokensRes, timersRes, auditRes, membersRes] = await Promise.all([
        apiGet<any>("/api/stats"),
        apiGet<any>(`/api/tokens?limit=300&status=${status}`),
        apiGet<any>("/api/timers?limit=200"),
        apiGet<any>("/api/audit?limit=200"),
        apiGet<any>(`/api/members?limit=1000&guild_id=${encodeURIComponent(currentMe.guildId || "")}`),
      ]);

      if (!statsRes?.error) {
        const { ok, ...rest } = statsRes;
        setStats((prev) => ({ ...prev, ...(rest as any) }));
      }

      if (tokensRes?.error) throw new Error(tokensRes.error);
      if (timersRes?.error) throw new Error(timersRes.error);
      if (auditRes?.error) throw new Error(auditRes.error);
      if (membersRes?.error) throw new Error(membersRes.error);

      const tokenRows = (tokensRes?.rows || tokensRes?.data || []) as TokenRow[];
      const timerRows = (timersRes?.rows || timersRes?.data || []) as KickTimerRow[];
      const auditRows = (auditRes?.rows || auditRes?.data || []) as AuditRow[];
      const memberRows = (membersRes?.rows || membersRes?.data || []) as MemberRow[];

      setTokens(tokenRows);
      setTimers(timerRows);
      setAudit(auditRows);
      setMembers(memberRows);

      const idsToResolve = [
        String(currentMe.userId || ""),
        ...tokenRows.map((row) => String(row.requester_id || "")),
        ...tokenRows.map((row) => String(row.decided_by || "")),
        ...timerRows.map((row) => String(row.owner_id || "")),
        ...timerRows.map((row) => String(row.started_by || "")),
        ...auditRows.flatMap((row) => [
          String(row.actor_id || ""),
          String(row.staff_id || ""),
          String(row?.meta?.actor_discord_id || ""),
        ]),
        ...memberRows.map((row) => String(row.user_id || "")),
      ];

      try {
        const map = await resolveDiscordUsers(idsToResolve, currentMe.guildId || null);
        setResolved(map);
      } catch {
        // keep UI alive even if resolver fails
      }
    } catch (error: any) {
      setErr(String(error?.message || error));
    } finally {
      setLoading(false);
    }
  }

  async function runGuildSync() {
    if (!me?.guildId) {
      setErr("Missing guild ID");
      return;
    }

    setLoading(true);
    setErr("");

    try {
      const response = await apiPost<any>("/api/guild-sync", { guildId: me.guildId });
      if (response?.error) throw new Error(response.error);
      await refreshEverything();
    } catch (error: any) {
      setErr(String(error?.message || error));
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
        const response = await apiGet<any>(`/api/tokens?limit=300&status=${status}`);
        if (!response?.error) {
          const tokenRows = (response?.rows || response?.data || []) as TokenRow[];
          setTokens(tokenRows);
        }
      } catch {
        // ignore
      }
    })();

    setSelected({});
  }, [status]);

  useEffect(() => {
    if (mod !== "liveMonitor") return;

    if (sseRef.current) {
      try {
        sseRef.current.close();
      } catch {}
      sseRef.current = null;
    }

    const source = new EventSource("/api/monitor");
    sseRef.current = source;

    source.onmessage = (event) => {
      try {
        const json = JSON.parse(event.data);
        setEvents((prev) => [json, ...prev].slice(0, 100));
      } catch {
        setEvents((prev) => [{ raw: event.data }, ...prev].slice(0, 100));
      }
    };

    source.onerror = () => {
      setEvents((prev) => [{ type: "error", message: "monitor disconnected" }, ...prev].slice(0, 100));
    };

    return () => {
      try {
        source.close();
      } catch {}
      sseRef.current = null;
    };
  }, [mod]);

  const filteredTokens = useMemo(() => {
    const needle = queueSearch.trim().toLowerCase();
    if (!needle) return tokens;

    return tokens.filter((row) => {
      const requester = resolved[String(row.requester_id || "")];
      const hay = [
        row.token,
        row.requester_id,
        row.channel_id,
        requester?.displayName,
        requester?.username,
        row.actual_role_state,
        row.expected_role_state,
        effectiveStatus(row),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return hay.includes(needle);
    });
  }, [queueSearch, tokens, resolved]);

  const filteredMembers = useMemo(() => {
    const needle = memberSearch.trim().toLowerCase();

    return members.filter((member) => {
      if (memberRoleStateFilter) {
        if (String(member.role_state || "").toLowerCase() !== memberRoleStateFilter) {
          return false;
        }
      }

      if (!needle) return true;

      const hay = [
        member.user_id,
        member.username,
        member.display_name,
        member.highest_role_name,
        member.role_state,
        member.role_state_reason,
        ...(member.role_names || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return hay.includes(needle);
    });
  }, [members, memberSearch, memberRoleStateFilter]);

  const selectedTokens = useMemo(() => {
    const selectedSet = new Set(Object.keys(selected).filter((key) => selected[key]));
    return filteredTokens.filter((row) => selectedSet.has(row.token));
  }, [selected, filteredTokens]);

  async function setDecision(token: string, decision: "APPROVED" | "DENIED" | "RESUBMIT") {
    const response = await apiPost<any>("/api/decision", { token, decision });
    if (response?.error) throw new Error(response.error);
  }

  async function bulkDecision(decision: "APPROVED" | "DENIED" | "RESUBMIT") {
    if (!selectedTokens.length) return;

    setLoading(true);
    setErr("");

    try {
      for (const row of selectedTokens) {
        await setDecision(row.token, decision);
      }
      await refreshEverything();
      setSelected({});
    } catch (error: any) {
      setErr(String(error?.message || error));
    } finally {
      setLoading(false);
    }
  }

  async function cancelTimer(channelId: string) {
    setLoading(true);
    setErr("");

    try {
      const response = await apiPost<any>("/api/timers/delete", { channel_id: channelId });
      if (response?.error) throw new Error(response.error);
      await refreshEverything();
    } catch (error: any) {
      setErr(String(error?.message || error));
    } finally {
      setLoading(false);
    }
  }

  const meResolved = me?.userId ? resolved[String(me.userId)] : null;

  const MobileTop = () => (
    <div className="sb-mtop">
      <div className="row">
        <div className="brand">
          <div className="h">Stoney Verify</div>
          <div className="sub">
            {me
              ? `${bestName(meResolved || null)} • ${(meResolved?.roles?.length ?? me.roles?.length ?? 0)} role(s)`
              : "Loading…"}
          </div>
          {meResolved?.roles?.length ? (
            <div className="sb-mroles">
              <RoleChips roles={meResolved.roles} />
            </div>
          ) : null}
        </div>

        <div className="sb-row">
          <button
            className="sb-btn sb-btn-ghost"
            onClick={refreshEverything}
            disabled={loading}
            title="Refresh"
          >
            ⟳
          </button>
          <button
            className="sb-btn sb-btn-ghost"
            onClick={() => setDrawerOpen(true)}
            title="More"
          >
            ⋯
          </button>
        </div>
      </div>

      {err ? (
        <div className="sb-row" style={{ marginTop: 8 }}>
          <span className="sb-pill bad">⚠ {err}</span>
        </div>
      ) : null}
    </div>
  );

  const DesktopHeader = () => (
    <div className="sb-card" style={{ marginBottom: 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
          <img
            src={meResolved?.avatarUrl || avatarFallback(String(me?.userId || "0"))}
            alt={bestName(meResolved || null)}
            width={52}
            height={52}
            style={{
              width: 52,
              height: 52,
              borderRadius: 999,
              objectFit: "cover",
              border: "1px solid rgba(255,255,255,.12)",
            }}
          />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 900 }}>
              {bestName(meResolved || null)}
            </div>
            <div className="sb-muted" style={{ marginTop: 4 }}>
              {meResolved?.username ? `@${meResolved.username}` : "Staff dashboard"}
            </div>
            {meResolved?.roles?.length ? (
              <div style={{ marginTop: 8 }}>
                <RoleChips roles={meResolved.roles} />
              </div>
            ) : null}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="sb-btn sb-btn-ghost" onClick={refreshEverything} disabled={loading}>
            Refresh
          </button>
          <button className="sb-btn sb-btn-green" onClick={runGuildSync} disabled={loading}>
            Sync Guild Members
          </button>
          <a className="sb-btn sb-btn-ghost" href="/api/auth/logout">
            Logout
          </a>
        </div>
      </div>
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

      <div className="sb-row" style={{ marginTop: 12, flexWrap: "wrap" }}>
        <span className="sb-pill blue">Role Conflicts: {stats.roleConflicts ?? 0}</span>
        <span className="sb-pill warn">Missing Verified: {stats.missingVerifiedRole ?? 0}</span>
        <span className="sb-pill warn">Missing Unverified: {stats.missingUnverified ?? 0}</span>
        <span className="sb-pill blue">Booster Only: {stats.boosterOnly ?? 0}</span>
        <span className="sb-pill bad">Staff Conflicts: {stats.staffConflicts ?? 0}</span>
      </div>
    </div>
  );

  const QueueCards = () => (
    <div className="sb-card">
      <div className="sb-row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Verification Queue</div>
          <div className="sb-muted" style={{ marginTop: 4, fontSize: 13 }}>
            Accurate queue with role-state context
          </div>
        </div>
        <div className="sb-row" style={{ gap: 8, flexWrap: "wrap" }}>
          <span className="sb-pill">Rows: {filteredTokens.length}</span>
          <span className="sb-pill blue">Selected: {selectedTokens.length}</span>
        </div>
      </div>

      <div className="sb-row" style={{ marginTop: 12, flexWrap: "wrap" }}>
        <input
          className="sb-input"
          placeholder="Search token / user / channel / status…"
          value={queueSearch}
          onChange={(e) => setQueueSearch(e.target.value)}
          style={{ flex: "1 1 320px" }}
        />
        <select
          className="sb-select"
          value={status}
          onChange={(e) => setStatus(e.target.value as any)}
          style={{ flex: "0 0 180px" }}
          title="Status"
        >
          <option value="pending">Pending</option>
          <option value="submitted">Submitted</option>
          <option value="approved">Approved</option>
          <option value="denied">Denied</option>
          <option value="used">Used</option>
        </select>
      </div>

      <div className="sb-mcards" style={{ marginTop: 14 }}>
        {filteredTokens.length === 0 ? (
          <div className="sb-muted">No results.</div>
        ) : (
          filteredTokens.map((row) => {
            const currentStatus = effectiveStatus(row);
            const requester = resolved[String(row.requester_id || "")] || null;
            const staff = resolved[String(row.decided_by || "")] || null;

            return (
              <div className="sb-mcard" key={row.token}>
                <div className="top">
                  <div className="sb-row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <input
                      type="checkbox"
                      checked={!!selected[row.token]}
                      onChange={(e) =>
                        setSelected((prev) => ({ ...prev, [row.token]: e.target.checked }))
                      }
                      aria-label="Select row"
                    />
                    <div className="mono">{row.token}</div>
                  </div>
                  <span className={pillClass(currentStatus)}>{currentStatus}</span>
                </div>

                <div className="grid">
                  <div>
                    <span>User</span>
                    <UserInline user={requester} />
                  </div>

                  {requester?.roles?.length ? (
                    <div>
                      <span>Roles</span>
                      <RoleChips roles={requester.roles} />
                    </div>
                  ) : null}

                  <div>
                    <span>Role Status</span>
                    <span className={roleStateClass(row.actual_role_state)}>
                      {roleStateLabel(row.actual_role_state)}
                    </span>
                  </div>

                  <div>
                    <span>Expected</span>
                    <span className="sb-pill">
                      {roleStateLabel(row.expected_role_state)}
                    </span>
                  </div>

                  <div><span>Ticket</span>{row.channel_id ? `#${shortId(row.channel_id)}` : "—"}</div>
                  <div><span>Created</span>{fmt(row.created_at)}</div>
                  <div><span>Expires</span>{fmt(row.expires_at)}</div>

                  {staff?.id ? (
                    <div>
                      <span>Staff</span>
                      <UserInline user={staff} />
                    </div>
                  ) : null}

                  {row.role_sync_reason ? (
                    <div>
                      <span>Why</span>
                      {row.role_sync_reason}
                    </div>
                  ) : null}
                </div>

                <div className="actions">
                  <button
                    className="sb-btn sb-btn-green"
                    disabled={loading}
                    onClick={async () => {
                      setLoading(true);
                      setErr("");
                      try {
                        await setDecision(row.token, "APPROVED");
                        await refreshEverything();
                      } catch (error: any) {
                        setErr(String(error?.message || error));
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
                        await setDecision(row.token, "DENIED");
                        await refreshEverything();
                      } catch (error: any) {
                        setErr(String(error?.message || error));
                      } finally {
                        setLoading(false);
                      }
                    }}
                  >
                    Deny
                  </button>

                  <button
                    className="sb-btn"
                    disabled={loading}
                    onClick={async () => {
                      setLoading(true);
                      setErr("");
                      try {
                        await setDecision(row.token, "RESUBMIT");
                        await refreshEverything();
                      } catch (error: any) {
                        setErr(String(error?.message || error));
                      } finally {
                        setLoading(false);
                      }
                    }}
                  >
                    Resubmit
                  </button>

                  <button className="sb-btn" onClick={() => setModal({ title: "Token row", body: row })}>
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

  const MembersCards = () => (
    <div className="sb-card">
      <div className="sb-row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Server Members</div>
          <div className="sb-muted" style={{ marginTop: 4, fontSize: 13 }}>
            Detailed member list with role accuracy
          </div>
        </div>
        <div className="sb-row" style={{ gap: 8, flexWrap: "wrap" }}>
          <span className="sb-pill">Members Loaded: {members.length}</span>
          <button className="sb-btn sb-btn-green" onClick={runGuildSync} disabled={loading}>
            Sync Now
          </button>
        </div>
      </div>

      <div className="sb-row" style={{ marginTop: 12, flexWrap: "wrap" }}>
        <input
          className="sb-input"
          placeholder="Search member / role / username / state…"
          value={memberSearch}
          onChange={(e) => setMemberSearch(e.target.value)}
          style={{ flex: "1 1 320px" }}
        />

        <select
          className="sb-select"
          value={memberRoleStateFilter}
          onChange={(e) => setMemberRoleStateFilter(e.target.value)}
          style={{ flex: "0 0 210px" }}
          title="Role state"
        >
          <option value="">All role states</option>
          <option value="unverified_only">Unverified</option>
          <option value="verified_ok">Verified</option>
          <option value="verified_conflict">Verified Conflict</option>
          <option value="staff_ok">Staff</option>
          <option value="staff_conflict">Staff Conflict</option>
          <option value="missing_verified_role">Missing Verified</option>
          <option value="missing_unverified">Missing Unverified</option>
          <option value="booster_only">Booster Only</option>
          <option value="left_guild">Left Guild</option>
          <option value="unknown">Unknown</option>
        </select>
      </div>

      <div className="sb-mcards" style={{ marginTop: 14 }}>
        {filteredMembers.length === 0 ? (
          <div className="sb-muted">No members matched your search.</div>
        ) : (
          filteredMembers.map((member) => (
            <div className="sb-mcard" key={`${member.guild_id}:${member.user_id}`}>
              <div className="top">
                <MemberInline member={member} />
                <span className={roleStateClass(member.role_state)}>
                  {roleStateLabel(member.role_state)}
                </span>
              </div>

              <div className="grid">
                <div><span>User ID</span>{shortId(member.user_id)}</div>
                <div><span>Highest Role</span>{member.highest_role_name || "—"}</div>
                <div><span>In Guild</span>{member.in_guild ? "Yes" : "No"}</div>
                <div><span>Any Role</span>{member.has_any_role ? "Yes" : "No"}</div>
                <div><span>Synced</span>{fmt(member.synced_at)}</div>

                {member.role_state_reason ? (
                  <div>
                    <span>Reason</span>
                    {member.role_state_reason}
                  </div>
                ) : null}
              </div>

              <div style={{ marginTop: 10 }}>
                <div className="sb-muted" style={{ fontSize: 12, marginBottom: 6 }}>
                  Current Roles
                </div>
                <RoleNameChips names={member.role_names} />
              </div>

              <div className="actions">
                <button className="sb-btn" onClick={() => setModal({ title: "Member row", body: member })}>
                  View
                </button>
                <button
                  className="sb-btn sb-btn-green"
                  onClick={() => {
                    setQueueSearch(member.user_id);
                    setMod("verifications");
                  }}
                >
                  Find in Queue
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const KickTimersCards = () => (
    <div className="sb-card">
      <div style={{ fontWeight: 900, fontSize: 18 }}>Kick Timers</div>
      <div className="sb-muted" style={{ marginTop: 4, fontSize: 13 }}>
        Active verification kick timers
      </div>

      <div className="sb-mcards" style={{ marginTop: 14 }}>
        {timers.length === 0 ? (
          <div className="sb-muted">No timers found.</div>
        ) : (
          timers.map((timer) => {
            const owner = resolved[String(timer.owner_id || "")] || null;
            const starter = resolved[String(timer.started_by || "")] || null;

            return (
              <div className="sb-mcard" key={timer.channel_id}>
                <div className="top">
                  <div style={{ fontWeight: 900 }}>#{shortId(timer.channel_id)}</div>
                  <span className="sb-pill warn">⏳ {timer.hours}h</span>
                </div>

                <div className="grid">
                  <div>
                    <span>Owner</span>
                    <UserInline user={owner} />
                  </div>

                  {owner?.roles?.length ? (
                    <div>
                      <span>Owner Roles</span>
                      <RoleChips roles={owner.roles} />
                    </div>
                  ) : null}

                  <div><span>Started</span>{fmt(timer.started_at)}</div>

                  <div>
                    <span>Started by</span>
                    <UserInline user={starter} />
                  </div>

                  {starter?.roles?.length ? (
                    <div>
                      <span>Starter Roles</span>
                      <RoleChips roles={starter.roles} />
                    </div>
                  ) : null}

                  <div><span>Guild</span>{shortId(timer.guild_id)}</div>
                </div>

                <div className="actions">
                  <button
                    className="sb-btn sb-btn-red"
                    disabled={loading}
                    onClick={() => cancelTimer(timer.channel_id)}
                  >
                    Cancel
                  </button>
                  <button className="sb-btn" onClick={() => setModal({ title: "Timer row", body: timer })}>
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

  const AuditCards = () => (
    <div className="sb-card">
      <div style={{ fontWeight: 900, fontSize: 18 }}>Audit Log</div>
      <div className="sb-muted" style={{ marginTop: 4, fontSize: 13 }}>
        Recent staff actions
      </div>

      <div className="sb-mcards" style={{ marginTop: 14 }}>
        {audit.length === 0 ? (
          <div className="sb-muted">No audit logs found.</div>
        ) : (
          audit.map((row, index) => {
            const actorId = String(row.actor_id || row.staff_id || row?.meta?.actor_discord_id || "").trim();
            const actor = actorId ? resolved[actorId] || null : null;

            return (
              <div className="sb-mcard" key={`${row.id || "audit"}-${index}`}>
                <div className="top">
                  <div style={{ fontWeight: 900 }}>{row.action}</div>
                  <span className="sb-pill">{fmt(row.at || row.created_at)}</span>
                </div>

                <div className="grid">
                  <div>
                    <span>Actor</span>
                    {actor ? (
                      <UserInline user={actor} />
                    ) : (
                      row.actor_name || (actorId ? `@${shortId(actorId)}` : "—")
                    )}
                  </div>

                  {actor?.roles?.length ? (
                    <div>
                      <span>Roles</span>
                      <RoleChips roles={actor.roles} />
                    </div>
                  ) : null}

                  <div><span>ID</span>{actorId ? shortId(actorId) : "—"}</div>
                </div>

                <div className="actions">
                  <button className="sb-btn" onClick={() => setModal({ title: "Audit meta", body: row.meta })}>
                    Meta
                  </button>
                  <button className="sb-btn" onClick={() => setModal({ title: "Audit row", body: row })}>
                    Row
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  const LiveMonitor = () => (
    <div className="sb-card">
      <div style={{ fontWeight: 900, fontSize: 18 }}>Live Monitor</div>
      <div className="sb-muted" style={{ marginTop: 4, fontSize: 13 }}>
        Real-time events from <code>/api/monitor</code>
      </div>

      <div style={{ marginTop: 14 }} className="sb-card2">
        {events.length === 0 ? (
          <div className="sb-muted">No live events yet…</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {events.map((event, index) => (
              <div key={index} className="sb-pre">
                {JSON.stringify(event, null, 2)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const SettingsCard = () => (
    <div className="sb-card">
      <div style={{ fontWeight: 900, fontSize: 18 }}>Settings</div>
      <div className="sb-muted" style={{ marginTop: 6 }}>
        Run a full Discord member sync to refresh member truth, queue role states, and server counts.
      </div>

      <div className="sb-row" style={{ marginTop: 12, flexWrap: "wrap" }}>
        <span className="sb-pill blue">Members Loaded: {members.length}</span>
        <span className="sb-pill">Guild: {me?.guildId ? shortId(me.guildId) : "—"}</span>
      </div>

      <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button className="sb-btn sb-btn-green" onClick={runGuildSync} disabled={loading}>
          Sync Guild Members
        </button>
        <button className="sb-btn sb-btn-ghost" onClick={refreshEverything} disabled={loading}>
          Refresh Dashboard
        </button>
      </div>

      <div className="sb-muted" style={{ marginTop: 14, fontSize: 13 }}>
        This version keeps mobile UI intact, improves desktop layout, shows staff avatars, and adds a detailed Members page.
      </div>
    </div>
  );

  const stickyVisible = isMobile && selectedTokens.length > 0;

  return (
    <>
      <MobileTop />

      {drawerOpen ? (
        <>
          <div className="sb-drawer-backdrop" onClick={() => setDrawerOpen(false)} />
          <div className="sb-drawer" role="dialog" aria-modal="true">
            <div className="head">
              <div style={{ fontWeight: 950 }}>More</div>
              <button className="sb-btn sb-btn-ghost" onClick={() => setDrawerOpen(false)}>
                Close
              </button>
            </div>

            <div className="body">
              {drawerNav.map((item) => (
                <button
                  key={item.k}
                  className={`sb-navbtn${mod === item.k ? " active" : ""}`}
                  onClick={() => {
                    setMod(item.k);
                    setDrawerOpen(false);
                  }}
                >
                  {item.label}
                </button>
              ))}

              <div className="sb-row" style={{ justifyContent: "space-between" }}>
                <a className="sb-btn sb-btn-ghost" href="/">
                  Home
                </a>
                <a className="sb-btn sb-btn-ghost" href="/api/auth/logout">
                  Logout
                </a>
              </div>
            </div>
          </div>
        </>
      ) : null}

      <div className="sb-shell">
        <aside className="sb-sidebar">
          <div className="sb-brand">
            <h1>Stoney Verify</h1>
            <p>Mega TicketTool-style control panel — Stoney Baloney themed</p>
          </div>

          <div className="sb-nav">
            <button className={`sb-navbtn${mod === "overview" ? " active" : ""}`} onClick={() => setMod("overview")}>🏠 Overview</button>
            <button className={`sb-navbtn${mod === "verifications" ? " active" : ""}`} onClick={() => setMod("verifications")}>🧾 Verifications</button>
            <button className={`sb-navbtn${mod === "members" ? " active" : ""}`} onClick={() => setMod("members")}>👥 Members</button>
            <button className={`sb-navbtn${mod === "kickTimers" ? " active" : ""}`} onClick={() => setMod("kickTimers")}>⏳ Kick Timers</button>
            <button className={`sb-navbtn${mod === "audit" ? " active" : ""}`} onClick={() => setMod("audit")}>🧷 Audit Log</button>
            <button className={`sb-navbtn${mod === "liveMonitor" ? " active" : ""}`} onClick={() => setMod("liveMonitor")}>📡 Live Monitor</button>
            <button className={`sb-navbtn${mod === "settings" ? " active" : ""}`} onClick={() => setMod("settings")}>⚙ Settings</button>
          </div>
        </aside>

        <main className="sb-main">
          {!isMobile ? <DesktopHeader /> : null}

          <KPIs />

          {mod === "overview" ? (
            <div className="sb-card">
              <div style={{ fontWeight: 950, fontSize: 18 }}>Overview</div>
              <div className="sb-muted" style={{ marginTop: 6 }}>
                Quick access to queue and role issues
              </div>

              <div style={{ marginTop: 14 }} className="sb-row">
                <button className="sb-btn sb-btn-green" onClick={() => setMod("verifications")}>
                  Open Queue
                </button>
                <button className="sb-btn" onClick={() => setMod("members")}>
                  Open Members
                </button>
                <button className="sb-btn sb-btn-ghost" onClick={runGuildSync} disabled={loading}>
                  Sync Now
                </button>
              </div>

              <div className="sb-row" style={{ marginTop: 12, flexWrap: "wrap" }}>
                <span className="sb-pill bad">Role Conflicts: {stats.roleConflicts ?? 0}</span>
                <span className="sb-pill warn">Missing Verified: {stats.missingVerifiedRole ?? 0}</span>
                <span className="sb-pill warn">Missing Unverified: {stats.missingUnverified ?? 0}</span>
                <span className="sb-pill blue">Booster Only: {stats.boosterOnly ?? 0}</span>
                <span className="sb-pill bad">Staff Conflicts: {stats.staffConflicts ?? 0}</span>
              </div>
            </div>
          ) : null}

          {mod === "verifications" ? <QueueCards /> : null}
          {mod === "members" ? <MembersCards /> : null}
          {mod === "kickTimers" ? <KickTimersCards /> : null}
          {mod === "audit" ? <AuditCards /> : null}
          {mod === "liveMonitor" ? <LiveMonitor /> : null}
          {mod === "settings" ? <SettingsCard /> : null}
        </main>

        <div className="sb-bottomnav" aria-label="Bottom navigation">
          <div className="grid">
            {primaryNav.map((item) => (
              <button
                key={item.k}
                className={`item${mod === item.k ? " active" : ""}`}
                onClick={() => setMod(item.k)}
              >
                <div className="ico">{item.ico}</div>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {stickyVisible ? (
          <div className="sb-stickybar">
            <div className="sb-row" style={{ justifyContent: "space-between" }}>
              <span className="sb-pill">
                Selected: <b>{selectedTokens.length}</b>
              </span>
              <button className="sb-btn" onClick={() => setSelected({})}>
                Clear
              </button>
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
        ) : null}

        {modal ? (
          <div className="sb-modal-backdrop" onClick={() => setModal(null)}>
            <div className="sb-modal" onClick={(e) => e.stopPropagation()}>
              <div className="head">
                <div style={{ fontWeight: 950 }}>{modal.title}</div>
                <button className="sb-btn" onClick={() => setModal(null)}>
                  Close
                </button>
              </div>
              <div className="body">
                <div className="sb-pre">{JSON.stringify(modal.body, null, 2)}</div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}

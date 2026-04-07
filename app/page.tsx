import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Sidebar from "@/components/Sidebar";
import DashboardClient from "@/components/DashboardClient";
import UserDashboardClient from "@/components/UserDashboardClient";
import {
  getSession,
  getDiscordLoginUrl,
  hasDiscordOAuthConfig,
} from "@/lib/auth-server";
import { env } from "@/lib/env";

type SessionLike = {
  isStaff?: boolean;
  user?: {
    discord_id?: string | null;
    id?: string | null;
    username?: string | null;
    global_name?: string | null;
    name?: string | null;
    avatar_url?: string | null;
    avatar?: string | null;
    image?: string | null;
    picture?: string | null;
  } | null;
  discordUser?: {
    id?: string | null;
    username?: string | null;
    global_name?: string | null;
    avatar_url?: string | null;
    avatar?: string | null;
  } | null;
  member?: {
    display_name?: string | null;
    verification_label?: string | null;
    access_label?: string | null;
    roles?: string[] | null;
    has_unverified_role?: boolean | null;
    has_verified_role?: boolean | null;
    has_staff_role?: boolean | null;
  } | null;
} | null;

type DashboardPayload = Record<string, unknown>;

function normalizeString(value: unknown): string {
  return String(value || "").trim();
}

function buildFallbackUserData(session: SessionLike, guildId: string): DashboardPayload {
  const discordId = normalizeString(
    session?.user?.discord_id ||
      session?.user?.id ||
      session?.discordUser?.id
  );

  const username =
    session?.user?.username ||
    session?.discordUser?.username ||
    session?.user?.global_name ||
    session?.user?.name ||
    "Member";

  const displayName =
    session?.member?.display_name ||
    session?.discordUser?.global_name ||
    session?.user?.global_name ||
    username;

  const avatarUrl =
    session?.user?.avatar_url ||
    session?.user?.avatar ||
    session?.user?.image ||
    session?.user?.picture ||
    session?.discordUser?.avatar_url ||
    session?.discordUser?.avatar ||
    null;

  return {
    ok: true,
    viewer: {
      discord_id: discordId || null,
      username,
      display_name: displayName,
      global_name: displayName,
      avatar_url: avatarUrl,
      avatar: avatarUrl,
      image: avatarUrl,
      picture: avatarUrl,
      isStaff: false,
      guild_id: guildId || null,
      verification_label:
        session?.member?.verification_label || "Not Synced Yet",
      access_label: session?.member?.access_label || "Not Synced Yet",
      role_names: Array.isArray(session?.member?.roles) ? session.member.roles : [],
    },
    member: {
      guild_id: guildId || null,
      user_id: discordId || null,
      username,
      display_name: displayName,
      nickname: null,
      avatar_url: avatarUrl,
      joined_at: null,
      role_names: Array.isArray(session?.member?.roles) ? session.member.roles : [],
      role_ids: [],
      has_unverified: Boolean(session?.member?.has_unverified_role),
      has_verified_role: Boolean(session?.member?.has_verified_role),
      has_staff_role: Boolean(session?.member?.has_staff_role),
      has_secondary_verified_role: false,
      role_state: "not_synced",
      role_state_reason: "Dashboard API fallback payload was used.",
    },
    profile: {
      guild_id: guildId || null,
      user_id: discordId || null,
      username,
      display_name: displayName,
      nickname: null,
      avatar_url: avatarUrl,
      joined_at: null,
      role_names: Array.isArray(session?.member?.roles) ? session.member.roles : [],
      role_ids: [],
      has_unverified: Boolean(session?.member?.has_unverified_role),
      has_verified_role: Boolean(session?.member?.has_verified_role),
      has_staff_role: Boolean(session?.member?.has_staff_role),
      has_secondary_verified_role: false,
      role_state: "not_synced",
      role_state_reason: "Dashboard API fallback payload was used.",
    },
    entry: {
      joined_at: null,
      join_source: null,
      entry_method: null,
      invite_code: null,
      inviter_id: null,
      inviter_name: null,
      vanity_used: false,
    },
    relationships: {
      entry_method: null,
      verification_source: null,
      entry_reason: null,
      approval_reason: null,
      invite_code: null,
      inviter_id: null,
      inviter_name: null,
      vanity_used: false,
      vouched_by: null,
      vouched_by_name: null,
      approved_by: null,
      approved_by_name: null,
      verification_ticket_id: null,
      source_ticket_id: null,
      vouch_count: 0,
      latest_vouch_at: null,
    },
    ticketSummary: {
      total: 0,
      open: 0,
      closed: 0,
      deleted: 0,
      claimed: 0,
      status_counts: {},
      priority_counts: {},
      category_counts: {},
      latest_ticket_at: null,
    },
    verification: {
      status: "unknown",
      has_unverified: Boolean(session?.member?.has_unverified_role),
      has_verified_role: Boolean(session?.member?.has_verified_role),
      has_secondary_verified_role: false,
      has_staff_role: Boolean(session?.member?.has_staff_role),
      flag_count: 0,
      flagged_count: 0,
      latest_flag_at: null,
      vc_request_count: 0,
      vc_completed_count: 0,
      vc_latest_status: null,
      token_count: 0,
      token_latest_status: null,
      token_latest_decision: null,
      token_submitted_count: 0,
      token_pending_count: 0,
      token_approved_count: 0,
      token_denied_count: 0,
      open_ticket_id: null,
    },
    verificationFlags: [],
    verificationTokens: [],
    vcSessions: [],
    vcVerifySession: null,
    joinHistory: [],
    memberEvents: [],
    usernameHistory: [],
    historicalUsernames: [],
    vouches: [],
    openTicket: null,
    recentTickets: [],
    recentActivity: [],
    categories: [],
    stats: {
      ticket_count: 0,
      activity_count: 0,
      verification_flag_count: 0,
      verification_token_count: 0,
      vc_session_count: 0,
      last_activity_at: null,
    },
  };
}

function buildFallbackStaffData(): DashboardPayload {
  return {
    ok: true,
    generated_at: new Date().toISOString(),
    tickets: [],
    activeTickets: [],
    events: [],
    warns: [],
    raids: [],
    fraud: [],
    fraudFlagsList: [],
    roles: [],
    metrics: [],
    categories: [],
    recentJoins: [],
    recentActiveMembers: [],
    recentFormerMembers: [],
    guildMembers: [],
    members: [],
    memberRows: [],
    memberCounts: {
      tracked: 0,
      active: 0,
      former: 0,
      pendingVerification: 0,
      verified: 0,
      staff: 0,
    },
    counts: {
      openTickets: 0,
      warnsToday: 0,
      raidAlerts: 0,
      fraudFlags: 0,
    },
  };
}

function resolveAppOrigin(): string {
  const explicitCandidates = [
    env?.siteUrl,
    env?.appUrl,
    env?.baseUrl,
    env?.publicUrl,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.SITE_URL,
    process.env.APP_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "",
  ]
    .map((value) => normalizeString(value))
    .filter(Boolean);

  if (explicitCandidates.length) {
    return explicitCandidates[0].replace(/\/+$/, "");
  }

  const headerStore = headers();
  const host =
    normalizeString(headerStore.get("x-forwarded-host")) ||
    normalizeString(headerStore.get("host"));

  const proto =
    normalizeString(headerStore.get("x-forwarded-proto")) ||
    (host.includes("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");

  if (host) {
    return `${proto}://${host}`;
  }

  return "http://127.0.0.1:3000";
}

async function fetchDashboardJson(
  pathname: string,
  fallbackData: DashboardPayload
): Promise<DashboardPayload> {
  try {
    const headerStore = headers();
    const origin = resolveAppOrigin();
    const cookieHeader = normalizeString(headerStore.get("cookie"));
    const authHeader = normalizeString(headerStore.get("authorization"));

    const response = await fetch(`${origin}${pathname}`, {
      method: "GET",
      cache: "no-store",
      headers: {
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
        ...(authHeader ? { authorization: authHeader } : {}),
        accept: "application/json",
        "x-dashboard-internal": "1",
      },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      return fallbackData;
    }

    const json = (await response.json().catch(() => null)) as DashboardPayload | null;
    if (!json || typeof json !== "object") {
      return fallbackData;
    }

    return json;
  } catch {
    return fallbackData;
  }
}

function LoginRequiredState() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        background: "#09090b",
        color: "white",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.03)",
          borderRadius: 20,
          padding: 24,
        }}
      >
        <h1 style={{ marginTop: 0 }}>Login Required</h1>
        <p style={{ color: "rgba(255,255,255,0.72)", lineHeight: 1.5 }}>
          Discord login is required to use this dashboard.
        </p>
        <p style={{ color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>
          OAuth configuration is currently missing or incomplete.
        </p>
      </div>
    </main>
  );
}

function StaffQuickToolsCard() {
  return (
    <div className="card staff-quick-tools-card">
      <div
        className="row"
        style={{
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="muted" style={{ marginBottom: 8 }}>
            Staff Tools
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: "clamp(30px, 5vw, 46px)",
              lineHeight: 0.96,
              letterSpacing: "-0.05em",
            }}
          >
            Control the ticket system
          </h1>

          <div
            className="muted"
            style={{
              marginTop: 12,
              maxWidth: 820,
              lineHeight: 1.55,
            }}
          >
            Jump straight into category routing and matching rules without digging
            through the dashboard. This is where you tune intake types, keyword
            matching, default category behavior, and safe deletion rules.
          </div>
        </div>

        <div
          className="row"
          style={{
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <Link
            href="/ticket-categories"
            className="button primary"
            style={{ width: "auto", minWidth: 220 }}
          >
            Open Category Manager
          </Link>

          <Link
            href="/#categories"
            className="button ghost"
            style={{ width: "auto", minWidth: 160 }}
          >
            View Category Stats
          </Link>
        </div>
      </div>

      <style jsx>{`
        .staff-quick-tools-card {
          background:
            radial-gradient(circle at top right, rgba(93,255,141,0.08), transparent 28%),
            radial-gradient(circle at bottom left, rgba(99,213,255,0.06), transparent 24%),
            linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015)),
            linear-gradient(180deg, rgba(14, 25, 35, 0.98), rgba(7, 13, 21, 0.98));
          margin-bottom: 18px;
        }
      `}</style>
    </div>
  );
}

function StaffShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell staff-shell">
      <Sidebar />
      <main className="content staff-content">
        <div className="content-inner">{children}</div>
      </main>
    </div>
  );
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  const session = (await getSession()) as SessionLike;

  if (!session) {
    if (hasDiscordOAuthConfig()) {
      redirect(getDiscordLoginUrl());
    }

    return <LoginRequiredState />;
  }

  const guildId = normalizeString(env?.guildId);

  if (session?.isStaff) {
    const staffData = await fetchDashboardJson(
      "/api/staff/dashboard",
      buildFallbackStaffData()
    );

    return (
      <StaffShell>
        <StaffQuickToolsCard />
        <DashboardClient
          initialData={staffData}
          staffName={
            session?.user?.username ||
            session?.discordUser?.username ||
            env?.defaultStaffName ||
            "Staff"
          }
        />
      </StaffShell>
    );
  }

  const userData = await fetchDashboardJson(
    "/api/user/dashboard",
    buildFallbackUserData(session, guildId)
  );

  return (
    <main className="content" style={{ minHeight: "100vh" }}>
      <UserDashboardClient initialData={userData} />
    </main>
  );
}

import type { ReactNode } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import Sidebar from "@/components/Sidebar";
import DashboardClient from "@/components/DashboardClient";
import UserDashboardClient from "@/components/UserDashboardClient";
import AuthStatePage from "@/components/dashboard/AuthStatePage";
import SetupLaunchChecklist from "@/components/dashboard/SetupLaunchChecklist";
import { getDashboardAuthSession, type DashboardAuthSession } from "@/lib/dashboard-auth";
import { env } from "@/lib/env";

type DashboardPayload = Record<string, unknown>;

function clean(value: unknown): string {
  return String(value || "").trim();
}

async function safeDashboardAuthSession(): Promise<DashboardAuthSession | null> {
  try {
    return await getDashboardAuthSession();
  } catch {
    return null;
  }
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
    .map(clean)
    .filter(Boolean);

  if (explicitCandidates.length) return explicitCandidates[0].replace(/\/+$/, "");

  const headerStore = headers();
  const host = clean(headerStore.get("x-forwarded-host")) || clean(headerStore.get("host"));
  const proto = clean(headerStore.get("x-forwarded-proto")) || (host.includes("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return host ? `${proto}://${host}` : "http://127.0.0.1:3000";
}

async function fetchDashboardJson(pathname: string, fallbackData: DashboardPayload): Promise<DashboardPayload> {
  try {
    const headerStore = headers();
    const origin = resolveAppOrigin();
    const cookieHeader = clean(headerStore.get("cookie"));
    const authHeader = clean(headerStore.get("authorization"));

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

    if (!response.ok) return fallbackData;
    const json = (await response.json().catch(() => null)) as DashboardPayload | null;
    return json && typeof json === "object" ? json : fallbackData;
  } catch {
    return fallbackData;
  }
}

function buildFallbackStaffData(session: DashboardAuthSession): DashboardPayload {
  return {
    ok: true,
    selectedGuildId: session.selectedGuildId || null,
    staffUserId: session.user.discord_id,
    viewer: {
      id: session.user.discord_id,
      discord_id: session.user.discord_id,
      username: session.user.username,
      display_name: session.member.display_name,
      avatar_url: session.user.avatar_url,
      isStaff: true,
      isServerManager: session.isServerManager,
      access_label: session.member.access_label,
      role_names: session.member.roles,
    },
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
    memberCounts: { tracked: 0, active: 0, former: 0, pendingVerification: 0, verified: 0, staff: 0 },
    counts: { openTickets: 0, warnsToday: 0, raidAlerts: 0, fraudFlags: 0 },
  };
}

function buildFallbackUserData(session: DashboardAuthSession): DashboardPayload {
  return {
    ok: true,
    selectedGuildId: session.selectedGuildId || null,
    viewer: {
      discord_id: session.user.discord_id,
      username: session.user.username,
      display_name: session.member.display_name,
      global_name: session.member.display_name,
      avatar_url: session.user.avatar_url,
      avatar: session.user.avatar_url,
      image: session.user.avatar_url,
      picture: session.user.avatar_url,
      isStaff: false,
      guild_id: session.selectedGuildId || null,
      verification_label: session.member.verification_label,
      access_label: session.member.access_label,
      role_names: session.member.roles,
    },
    member: {
      guild_id: session.selectedGuildId || null,
      user_id: session.user.discord_id,
      username: session.user.username,
      display_name: session.member.display_name,
      avatar_url: session.user.avatar_url,
      role_names: session.member.roles,
      role_ids: session.member.roleIds,
      has_unverified: session.member.has_unverified_role,
      has_verified_role: session.member.has_verified_role,
      has_staff_role: session.member.has_staff_role,
      role_state: "dashboard_auth",
      role_state_reason: "Loaded from selected-server dashboard auth.",
    },
    categories: [],
    recentTickets: [],
    recentActivity: [],
    verificationFlags: [],
    verificationTokens: [],
    vcSessions: [],
    stats: { ticket_count: 0, activity_count: 0, verification_flag_count: 0, verification_token_count: 0, vc_session_count: 0, last_activity_at: null },
  };
}

function StaffQuickToolsCard() {
  return (
    <div className="card staff-quick-tools-card" style={{ marginBottom: 18 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="muted" style={{ marginBottom: 8 }}>Staff Tools</div>
          <h2 style={{ margin: 0 }}>Server control center</h2>
          <p className="muted" style={{ marginTop: 8, maxWidth: 720 }}>
            Manage the selected server without mixing tickets, categories, forms, activity, or member data across servers.
          </p>
        </div>
        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <Link href="/servers" className="button ghost" style={{ width: "auto" }}>Change Server</Link>
          <Link href="/ticket-categories" className="button ghost" style={{ width: "auto" }}>Categories</Link>
          <Link href="/ticket-forms" className="button ghost" style={{ width: "auto" }}>Forms</Link>
        </div>
      </div>
    </div>
  );
}

function DashboardLockedHome() {
  return (
    <section className="card dashboard-locked-home" aria-label="Dashboard locked until server selection">
      <div className="muted dashboard-locked-eyebrow">Dashboard</div>
      <h1>Pick a server before the dashboard loads</h1>
      <p className="muted">Home is the live control room. It stays clean until a server is selected.</p>
      <div className="dashboard-locked-actions">
        <Link href="/servers" className="button primary">Go to Servers</Link>
      </div>
    </section>
  );
}

function StaffShell({ children }: { children: ReactNode }) {
  return (
    <>
      <Sidebar />
      <main className="content">{children}</main>
    </>
  );
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  const session = await safeDashboardAuthSession();
  if (!session) return <AuthStatePage variant="login" showReset={true} showBack={false} />;

  const guildId = clean(session.selectedGuildId);
  if (session.isStaff) {
    if (!guildId) {
      return (
        <StaffShell>
          <DashboardLockedHome />
        </StaffShell>
      );
    }

    const staffData = await fetchDashboardJson("/api/staff/dashboard", buildFallbackStaffData(session));

    return (
      <StaffShell>
        <StaffQuickToolsCard />
        <SetupLaunchChecklist data={staffData} selectedGuildId={guildId} />
        <DashboardClient
          initialData={staffData}
          staffName={session.user.username || session.discordUser.username || env?.defaultStaffName || "Staff"}
          initialStaffId={session.user.discord_id}
        />
      </StaffShell>
    );
  }

  const userData = await fetchDashboardJson("/api/user/dashboard", buildFallbackUserData(session));
  return (
    <main className="content" style={{ minHeight: "100vh" }}>
      <UserDashboardClient initialData={userData} />
    </main>
  );
}

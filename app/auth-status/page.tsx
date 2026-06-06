import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { hasDiscordOAuthConfig } from "@/lib/auth-server";
import { getDashboardAuthSession, type DashboardAuthSession } from "@/lib/dashboard-auth";
import { getExplicitSelectedGuildId } from "@/lib/guild-selection";
import { loginRouteFor } from "@/lib/auth-return";

type SearchParams = {
  authError?: string | string[];
};

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function normalizeString(value: unknown): string {
  return String(value || "").trim();
}

function ActionLink({ href, children, primary = false }: { href: string; children: React.ReactNode; primary?: boolean }) {
  return (
    <Link href={href} className={primary ? "button primary" : "button ghost"}>
      {children}
    </Link>
  );
}

function accessLabel(session: DashboardAuthSession): string {
  if (session.isServerManager) return "Server Manager";
  if (session.isStaff) return "Staff";
  return "Member";
}

function SessionCard({ session }: { session: DashboardAuthSession }) {
  const displayName =
    session.member?.display_name ||
    session.user?.global_name ||
    session.discordUser?.global_name ||
    session.user?.username ||
    session.discordUser?.username ||
    "Discord user";
  const avatarUrl = session.user?.avatar_url || session.discordUser?.avatar_url || "";
  const explicitGuildId = getExplicitSelectedGuildId();
  const sessionGuildId = normalizeString(session.authContext?.selected_guild_id || session.selectedGuildId);
  const selectedGuildId = explicitGuildId || sessionGuildId;
  const selectedSource = explicitGuildId ? "Selected by cookie" : sessionGuildId ? "Default/fallback context" : "None";
  const roles = Array.isArray(session.member?.roles) ? session.member.roles : [];
  const guildCheckError = normalizeString(session.authContext?.guild_check_error);

  return (
    <>
      <section className="card account-hero-card">
        <div className="account-hero-main">
          <div className="account-avatar" aria-hidden="true">
            {avatarUrl ? <img src={avatarUrl} alt="" /> : <span>{displayName.slice(0, 1).toUpperCase()}</span>}
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="muted account-eyebrow">Account</div>
            <h1>{displayName}</h1>
            <p className="muted">Your Discord session is active. This page now uses the selected-server dashboard access check, including Manage Server permission and configured staff role rules.</p>
          </div>
        </div>
        <div className="account-actions">
          <ActionLink href="/" primary>Home</ActionLink>
          <ActionLink href="/servers">Servers</ActionLink>
          {hasDiscordOAuthConfig() ? <ActionLink href={loginRouteFor("/auth-status")}>Re-authorize Discord</ActionLink> : null}
          <ActionLink href="/api/auth/logout">Reset Login</ActionLink>
        </div>
      </section>

      <section className="account-grid">
        <div className="card account-info-card">
          <div className="muted account-eyebrow">Session</div>
          <div className="account-info-row"><span>Status</span><strong>Signed in</strong></div>
          <div className="account-info-row"><span>Dashboard access</span><strong>{accessLabel(session)}</strong></div>
          <div className="account-info-row"><span>Access label</span><strong>{session.member?.access_label || accessLabel(session)}</strong></div>
          <div className="account-info-row"><span>Selected server</span><strong>{selectedGuildId || "None selected"}</strong></div>
        </div>

        <div className="card account-info-card">
          <div className="muted account-eyebrow">Server Check</div>
          <div className="account-info-row"><span>Server context source</span><strong>{selectedSource}</strong></div>
          <div className="account-info-row"><span>Guild/member checked</span><strong>{session.authContext?.guild_checked ? "Yes" : "No"}</strong></div>
          <div className="account-info-row"><span>Staff reason</span><strong>{session.authContext?.staff_reason || session.authContext?.access_source || "—"}</strong></div>
          {guildCheckError ? <div className="account-warning">{guildCheckError}</div> : null}
        </div>

        <div className="card account-info-card account-info-wide">
          <div className="muted account-eyebrow">Roles</div>
          {roles.length ? (
            <div className="roles account-role-list">
              {roles.slice(0, 18).map((role) => <span key={role} className="badge">{role}</span>)}
            </div>
          ) : (
            <p className="muted">No role list is available for the selected server yet.</p>
          )}
        </div>
      </section>
    </>
  );
}

function LoginRequiredState({ authError }: { authError?: string }) {
  return (
    <main className="auth-state-page">
      <div className="card auth-state-card">
        <div className="muted auth-state-eyebrow">Dank Shield Dashboard</div>
        <h1>{authError ? "Discord login did not finish" : "No active Discord session"}</h1>
        <p className="muted">
          {authError
            ? "Discord returned an auth error. The reason is shown below so the dashboard does not silently loop back."
            : "The dashboard does not see a valid Discord session cookie yet. Sign in with Discord to continue."}
        </p>
        {authError ? <pre className="account-error-pre">{decodeURIComponent(authError)}</pre> : null}
        <div className="auth-state-actions">
          {hasDiscordOAuthConfig() ? <ActionLink href={loginRouteFor("/auth-status")} primary>{authError ? "Try Discord login again" : "Sign in with Discord"}</ActionLink> : null}
          <ActionLink href="/api/auth/logout">Reset login</ActionLink>
          <ActionLink href="/">Back Home</ActionLink>
        </div>
      </div>
    </main>
  );
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AuthStatusPage({ searchParams }: { searchParams?: SearchParams }) {
  const authError = firstParam(searchParams?.authError);
  const session = await getDashboardAuthSession();

  if (!session) return <LoginRequiredState authError={authError} />;

  return (
    <div className="shell account-page-shell">
      <Sidebar />
      <main className="content account-page-content">
        <SessionCard session={session} />
      </main>
    </div>
  );
}

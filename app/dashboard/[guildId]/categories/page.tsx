import Link from "next/link";
import TicketCategoriesManager from "@/components/dashboard/TicketCategoriesManager";
import AuthStatePage from "@/components/dashboard/AuthStatePage";
import SetupWorkspaceShell from "@/components/dashboard/SetupWorkspaceShell";
import { getDashboardAuthSession, type DashboardAuthSession } from "@/lib/dashboard-auth";

type PageProps = {
  params: { guildId: string };
};

function clean(value: unknown): string {
  return String(value || "").trim();
}

function dashboardBaseHref(guildId: string): string {
  return `/dashboard/${encodeURIComponent(guildId)}`;
}

async function safeDashboardAuthSession(): Promise<DashboardAuthSession | null> {
  try {
    return await getDashboardAuthSession();
  } catch {
    return null;
  }
}

function GuildMismatchState({ routeGuildId, selectedGuildId }: { routeGuildId: string; selectedGuildId: string }) {
  return (
    <main className="auth-state-page">
      <div className="card auth-state-card">
        <div className="muted auth-state-eyebrow">Server Context Required</div>
        <h1>Open categories from the selected server</h1>
        <p className="muted">
          This categories URL is for server {routeGuildId}, but your active selected server is {selectedGuildId || "not set"}. Pick the server from Servers first so access is verified cleanly.
        </p>
        <div className="auth-state-actions">
          <Link href="/servers" className="button primary">Choose Server</Link>
          <Link href="/auth-status" className="button ghost">View Account</Link>
        </div>
      </div>
    </main>
  );
}

function StaffRequiredState({ guildId }: { guildId: string }) {
  return (
    <main className="auth-state-page">
      <div className="card auth-state-card">
        <div className="muted auth-state-eyebrow">Staff Access Required</div>
        <h1>Ticket categories are staff-only</h1>
        <p className="muted">
          You are signed in, but this selected server did not confirm staff or Manage Server access for this page.
        </p>
        <div className="auth-state-actions">
          <Link href="/servers" className="button primary">Choose Server</Link>
          <Link href="/auth-status" className="button ghost">View Account</Link>
          <Link href={dashboardBaseHref(guildId)} className="button ghost">Dashboard</Link>
        </div>
      </div>
    </main>
  );
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function GuildCategoriesPage({ params }: PageProps) {
  const routeGuildId = clean(params.guildId);
  const session = await safeDashboardAuthSession();
  if (!session) {
    return (
      <AuthStatePage
        variant="login"
        message="The dashboard could not validate your Discord session for ticket categories. Use Account → Reset Login once if this keeps happening, then sign in again."
        showReset={true}
        showBack={false}
      />
    );
  }

  const selectedGuildId = clean(session.selectedGuildId);
  if (!routeGuildId || selectedGuildId !== routeGuildId) return <GuildMismatchState routeGuildId={routeGuildId || "unknown"} selectedGuildId={selectedGuildId} />;
  if (!session.isStaff) return <StaffRequiredState guildId={routeGuildId} />;

  const base = dashboardBaseHref(routeGuildId);

  return (
    <SetupWorkspaceShell
      activeStep="categories"
      eyebrow="Step 2 of 3"
      title="Ticket Categories"
      description="Create clear issue types, routing defaults, button labels, and safe category rules before publishing your public ticket panel."
      dashboardBaseHref={base}
      actions={
        <>
          <Link href={base} className="button primary">Dashboard</Link>
          <Link href={`${base}/forms`} className="button ghost">Next: Forms</Link>
        </>
      }
    >
      <TicketCategoriesManager />
    </SetupWorkspaceShell>
  );
}

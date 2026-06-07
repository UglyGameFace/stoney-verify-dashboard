import Link from "next/link";
import TicketFormsManager from "@/components/dashboard/TicketFormsManager";
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
        <h1>Open forms from the selected server</h1>
        <p className="muted">
          This forms URL is for server {routeGuildId}, but your active selected server is {selectedGuildId || "not set"}. Pick the server from Servers first so access is verified cleanly.
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
        <h1>Ticket forms are staff-only</h1>
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

export default async function GuildFormsPage({ params }: PageProps) {
  const routeGuildId = clean(params.guildId);
  const session = await safeDashboardAuthSession();
  if (!session) {
    return (
      <AuthStatePage
        variant="login"
        message="The dashboard could not validate your Discord session for ticket forms. Use Account → Reset Login once if this keeps happening, then sign in again."
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
      activeStep="forms"
      eyebrow="Step 3 of 3"
      title="Ticket Forms"
      description="Control what members answer after choosing an issue type. Smart defaults work automatically, and custom questions override them per category."
      dashboardBaseHref={base}
      actions={
        <>
          <Link href={`${base}/categories`} className="button ghost">Back: Categories</Link>
          <Link href={base} className="button primary">Finish Setup</Link>
        </>
      }
    >
      <TicketFormsManager />
    </SetupWorkspaceShell>
  );
}

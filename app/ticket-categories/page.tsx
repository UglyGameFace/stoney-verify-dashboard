import Link from "next/link";
import TicketCategoriesManager from "@/components/dashboard/TicketCategoriesManager";
import AuthStatePage from "@/components/dashboard/AuthStatePage";
import SetupWorkspaceShell from "@/components/dashboard/SetupWorkspaceShell";
import { getDashboardAuthSession, type DashboardAuthSession } from "@/lib/dashboard-auth";

async function safeDashboardAuthSession(): Promise<DashboardAuthSession | null> {
  try {
    return await getDashboardAuthSession();
  } catch {
    return null;
  }
}

function StaffRequiredState() {
  return (
    <main className="auth-state-page">
      <div className="card auth-state-card">
        <div className="muted auth-state-eyebrow">Staff Access Required</div>
        <h1>Ticket categories are staff-only</h1>
        <p className="muted">
          You are signed in, but this selected server did not confirm staff or Manage Server access for this page. Choose the server again or check Account for the current access state.
        </p>
        <div className="auth-state-actions">
          <Link href="/servers" className="button primary">Choose Server</Link>
          <Link href="/auth-status" className="button ghost">View Account</Link>
          <Link href="/" className="button ghost">Dashboard</Link>
        </div>
      </div>
    </main>
  );
}

function ServerRequiredState() {
  return (
    <main className="auth-state-page">
      <div className="card auth-state-card">
        <div className="muted auth-state-eyebrow">Setup Step Locked</div>
        <h1>Choose a server first</h1>
        <p className="muted">
          Ticket categories belong to one Discord server. Pick the server before creating or editing routing so data never mixes between communities.
        </p>
        <div className="auth-state-actions">
          <Link href="/servers" className="button primary">Choose Server</Link>
          <Link href="/" className="button ghost">Dashboard</Link>
          <Link href="/auth-status" className="button ghost">Auth Status</Link>
        </div>
      </div>
    </main>
  );
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TicketCategoriesPage() {
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

  if (!session.selectedGuildId) return <ServerRequiredState />;
  if (!session.isStaff) return <StaffRequiredState />;

  return (
    <SetupWorkspaceShell
      activeStep="categories"
      eyebrow="Step 2 of 3"
      title="Ticket Categories"
      description="Create clear issue types, routing defaults, button labels, and safe category rules before publishing your public ticket panel."
      actions={
        <>
          <Link href="/" className="button primary">Dashboard</Link>
          <Link href="/ticket-forms" className="button ghost">Next: Forms</Link>
        </>
      }
    >
      <TicketCategoriesManager />
    </SetupWorkspaceShell>
  );
}

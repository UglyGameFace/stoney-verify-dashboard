import Link from "next/link";
import { redirect } from "next/navigation";
import TicketFormsManager from "@/components/dashboard/TicketFormsManager";
import AuthStatePage from "@/components/dashboard/AuthStatePage";
import SetupWorkspaceShell from "@/components/dashboard/SetupWorkspaceShell";
import { getDashboardAuthSession } from "@/lib/dashboard-auth";

function ServerRequiredState() {
  return (
    <main className="auth-state-page">
      <div className="card auth-state-card">
        <div className="muted auth-state-eyebrow">Setup Step Locked</div>
        <h1>Choose a server first</h1>
        <p className="muted">
          Ticket forms depend on the selected Discord server and its categories. Pick the server first so form questions attach to the correct community.
        </p>
        <div className="auth-state-actions">
          <Link href="/servers" className="button primary">Choose Server</Link>
          <Link href="/ticket-categories" className="button ghost">Categories</Link>
          <Link href="/" className="button ghost">Dashboard</Link>
        </div>
      </div>
    </main>
  );
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TicketFormsPage() {
  const session = await getDashboardAuthSession();

  if (!session) {
    return (
      <AuthStatePage
        variant="login"
        message="Sign in with Discord to manage ticket forms. The dashboard will not open Discord authorization until you press the sign-in button."
        showReset={false}
        showBack={false}
      />
    );
  }

  if (!session.isStaff) redirect("/");
  if (!session.selectedGuildId) return <ServerRequiredState />;

  return (
    <SetupWorkspaceShell
      activeStep="forms"
      eyebrow="Step 3 of 3"
      title="Ticket Forms"
      description="Control what members answer after choosing an issue type. Smart defaults work automatically, and custom questions override them per category."
      actions={
        <>
          <Link href="/ticket-categories" className="button ghost">Back: Categories</Link>
          <Link href="/" className="button primary">Finish Setup</Link>
        </>
      }
    >
      <TicketFormsManager />
    </SetupWorkspaceShell>
  );
}

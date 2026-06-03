import Link from "next/link";
import { redirect } from "next/navigation";
import TicketCategoriesManager from "@/components/dashboard/TicketCategoriesManager";
import AuthStatePage from "@/components/dashboard/AuthStatePage";
import SetupWorkspaceShell from "@/components/dashboard/SetupWorkspaceShell";
import { getSession } from "@/lib/auth-server";
import { getSelectedGuildId } from "@/lib/guild-selection";

type SessionLike = {
  isStaff?: boolean;
} | null;

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
  const session = (await getSession()) as SessionLike;

  if (!session) {
    return (
      <AuthStatePage
        variant="login"
        message="Sign in with Discord to manage ticket categories. The dashboard will not open Discord authorization until you press the sign-in button."
        showReset={false}
        showBack={false}
      />
    );
  }

  if (!session?.isStaff) redirect("/");
  if (!getSelectedGuildId()) return <ServerRequiredState />;

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

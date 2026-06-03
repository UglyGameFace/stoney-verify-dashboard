import Link from "next/link";
import { redirect } from "next/navigation";
import TicketCategoriesManager from "@/components/dashboard/TicketCategoriesManager";
import SetupWorkspaceShell from "@/components/dashboard/SetupWorkspaceShell";
import {
  getSession,
  getDiscordLoginUrl,
  hasDiscordOAuthConfig,
} from "@/lib/auth-server";
import { getSelectedGuildId } from "@/lib/guild-selection";

type SessionLike = {
  isStaff?: boolean;
} | null;

function LoginRequiredState() {
  const loginUrl = hasDiscordOAuthConfig() ? getDiscordLoginUrl() : "";

  return (
    <main className="auth-state-page">
      <div className="card auth-state-card">
        <div className="muted auth-state-eyebrow">Dank Shield Dashboard</div>
        <h1>Login Required</h1>
        <p className="muted">Sign in with Discord to manage ticket categories. Navigation stays inside the dashboard until you choose to sign in.</p>
        <div className="auth-state-actions">
          {loginUrl ? <Link href={loginUrl} className="button primary">Sign in with Discord</Link> : null}
          <Link href="/auth-status" className="button ghost">Check Auth Status</Link>
          <Link href="/" className="button ghost">Back Home</Link>
        </div>
      </div>
    </main>
  );
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TicketCategoriesPage() {
  const session = (await getSession()) as SessionLike;

  if (!session) return <LoginRequiredState />;

  if (!session?.isStaff) redirect("/");
  if (!getSelectedGuildId()) redirect("/servers");

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

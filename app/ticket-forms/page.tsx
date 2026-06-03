import Link from "next/link";
import { redirect } from "next/navigation";
import TicketFormsManager from "@/components/dashboard/TicketFormsManager";
import SetupWorkspaceShell from "@/components/dashboard/SetupWorkspaceShell";
import {
  getSession,
  getDiscordLoginUrl,
  hasDiscordOAuthConfig,
} from "@/lib/auth-server";

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
        <p className="muted">Discord login is required to manage ticket forms.</p>
        <div className="auth-state-actions">
          {loginUrl ? <Link href={loginUrl} className="button primary">Sign in with Discord</Link> : null}
          <Link href="/auth-status" className="button ghost">Check Auth Status</Link>
        </div>
      </div>
    </main>
  );
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TicketFormsPage() {
  const session = (await getSession()) as SessionLike;

  if (!session) {
    if (hasDiscordOAuthConfig()) redirect(getDiscordLoginUrl());
    return <LoginRequiredState />;
  }

  if (!session?.isStaff) redirect("/");

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

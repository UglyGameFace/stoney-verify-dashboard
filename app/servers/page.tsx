import Link from "next/link";
import ServerSelector from "@/components/dashboard/ServerSelector";
import SetupWorkspaceShell from "@/components/dashboard/SetupWorkspaceShell";
import {
  getSession,
  getDiscordLoginUrl,
  hasDiscordOAuthConfig,
} from "@/lib/auth-server";

function LoginRequiredState() {
  const loginUrl = hasDiscordOAuthConfig() ? getDiscordLoginUrl() : "";

  return (
    <main className="auth-state-page">
      <div className="card auth-state-card">
        <div className="muted auth-state-eyebrow">Dank Shield Dashboard</div>
        <h1>Login Required</h1>
        <p className="muted">Sign in with Discord to choose which server you want to manage.</p>
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

export default async function ServersPage() {
  const session = await getSession();

  if (!session) return <LoginRequiredState />;

  return (
    <SetupWorkspaceShell
      activeStep="servers"
      eyebrow="Step 1 of 3"
      title="Choose your server"
      description="Pick the Discord server you can manage. Dank Shield will load tickets, forms, categories, and settings for that server only."
      actions={
        <>
          <Link href="/" className="button primary">Dashboard</Link>
          <Link href="/auth-status" className="button ghost">Auth Status</Link>
        </>
      }
    >
      <ServerSelector />
    </SetupWorkspaceShell>
  );
}

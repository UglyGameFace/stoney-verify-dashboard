import Link from "next/link";
import { getDiscordLoginUrl, hasDiscordOAuthConfig } from "@/lib/auth-server";

type AuthStateCardProps = {
  eyebrow?: string;
  title?: string;
  description?: string;
  tone?: "default" | "warning" | "danger";
  showReset?: boolean;
  showBack?: boolean;
  backHref?: string;
  backLabel?: string;
  authError?: string;
};

function safeDecode(value?: string): string {
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export default function AuthStateCard({
  eyebrow = "Dank Shield Dashboard",
  title = "Login Required",
  description = "Discord login is required to use this dashboard. The page no longer redirects automatically, so login problems will not trap you in a Discord authorize loop.",
  tone = "default",
  showReset = false,
  showBack = true,
  backHref = "/",
  backLabel = "Back Home",
  authError = "",
}: AuthStateCardProps) {
  const loginUrl = hasDiscordOAuthConfig() ? getDiscordLoginUrl() : "";
  const decodedError = safeDecode(authError);

  return (
    <main className={`auth-state-page tone-${tone}`}>
      <section className="card auth-state-card unified-auth-card" aria-label={title}>
        <div className="muted auth-state-eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p className="muted">{description}</p>

        {!loginUrl ? (
          <div className="auth-state-alert danger">
            OAuth configuration is missing or incomplete. Check Discord client, redirect URL, guild ID, and site URL environment variables.
          </div>
        ) : null}

        {decodedError ? (
          <div className="auth-state-alert danger">
            <strong>Sign-in detail</strong>
            <span>{decodedError}</span>
          </div>
        ) : null}

        <div className="auth-state-actions">
          {loginUrl ? <Link href={loginUrl} className="button primary">Sign in with Discord</Link> : null}
          <Link href="/auth-status" className="button ghost">Check Auth Status</Link>
          {showReset ? <Link href="/api/auth/logout" className="button ghost">Reset login</Link> : null}
          {showBack ? <Link href={backHref} className="button ghost">{backLabel}</Link> : null}
        </div>
      </section>
    </main>
  );
}

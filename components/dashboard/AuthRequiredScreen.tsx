import Link from "next/link";
import { hasDiscordOAuthConfig } from "@/lib/auth-server";
import { loginRouteFor } from "@/lib/auth-return";

type AuthRequiredScreenProps = {
  eyebrow?: string;
  title?: string;
  description?: string;
  detail?: string;
  tone?: "default" | "warning" | "danger";
  showReset?: boolean;
  backHref?: string;
  backLabel?: string;
  primaryLabel?: string;
  returnTo?: string;
};

export default function AuthRequiredScreen({
  eyebrow = "Dank Shield Dashboard",
  title = "Login Required",
  description = "Sign in with Discord to continue. The dashboard will not auto-launch Discord authorization until you choose to sign in.",
  detail = "",
  tone = "default",
  showReset = true,
  backHref = "/",
  backLabel = "Back Home",
  primaryLabel = "Sign in with Discord",
  returnTo,
}: AuthRequiredScreenProps) {
  const loginUrl = hasDiscordOAuthConfig() ? loginRouteFor(returnTo || backHref || "/auth-status") : "";

  return (
    <main className={`auth-state-page tone-${tone}`} data-auth-state="true">
      <section className="auth-state-card card" aria-label="Authentication required">
        <div className="auth-state-eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>

        {detail ? <div className="auth-state-detail">{detail}</div> : null}

        {!loginUrl ? (
          <div className="auth-state-detail danger">
            OAuth configuration is missing or incomplete. Check Discord client ID, client secret, redirect URI, and app URL settings.
          </div>
        ) : null}

        <div className="auth-state-actions">
          {loginUrl ? <Link href={loginUrl} className="button primary">{primaryLabel}</Link> : null}
          {showReset ? <Link href="/api/auth/logout" className="button ghost">Reset Login</Link> : null}
          <Link href={backHref} className="button ghost">{backLabel}</Link>
        </div>
      </section>
    </main>
  );
}

import Link from "next/link";
import {
  getDiscordLoginUrl,
  hasDiscordOAuthConfig,
} from "@/lib/auth-server";

type AuthStateVariant = "login" | "session" | "error" | "forbidden";

type AuthStatePageProps = {
  variant?: AuthStateVariant;
  eyebrow?: string;
  title?: string;
  message?: string;
  errorDetail?: string;
  showReset?: boolean;
  showBack?: boolean;
  backHref?: string;
  backLabel?: string;
};

function variantDefaults(variant: AuthStateVariant) {
  if (variant === "error") {
    return {
      eyebrow: "Sign-in failed",
      title: "Discord login did not finish",
      message: "The dashboard got an auth error instead of a working Discord session. This page shows the reason so it does not silently loop back to sign-in.",
    };
  }

  if (variant === "forbidden") {
    return {
      eyebrow: "Access needed",
      title: "Staff access required",
      message: "This area is for staff who can manage the selected Discord server.",
    };
  }

  if (variant === "session") {
    return {
      eyebrow: "Not signed in",
      title: "No active Discord session",
      message: "The dashboard does not see a valid Discord session cookie yet. Sign in with Discord to continue.",
    };
  }

  return {
    eyebrow: "Dank Shield Dashboard",
    title: "Login Required",
    message: "Discord login is required to use this dashboard. The page will not automatically open Discord authorization, so login issues will not trap you in a loop.",
  };
}

export default function AuthStatePage({
  variant = "login",
  eyebrow,
  title,
  message,
  errorDetail,
  showReset = true,
  showBack = true,
  backHref = "/",
  backLabel = "Back Home",
}: AuthStatePageProps) {
  const defaults = variantDefaults(variant);
  const loginUrl = hasDiscordOAuthConfig() ? getDiscordLoginUrl() : "";

  return (
    <main className={`auth-state-page auth-only-page tone-${variant === "error" ? "danger" : variant === "session" ? "warning" : "default"}`} data-auth-state="required" data-auth-state-page="true">
      <section className={`card auth-state-card variant-${variant}`}>
        <div className="auth-state-eyebrow">{eyebrow || defaults.eyebrow}</div>
        <h1>{title || defaults.title}</h1>
        <p>{message || defaults.message}</p>

        {!loginUrl ? (
          <div className="auth-state-detail danger">
            OAuth configuration is missing or incomplete. Check Discord client, redirect URL, guild ID, and site URL environment variables.
          </div>
        ) : null}

        {errorDetail ? <pre className="auth-state-detail danger auth-state-error-detail">{errorDetail}</pre> : null}

        <div className="auth-state-actions">
          {loginUrl ? (
            <Link href={loginUrl} className="button primary">Sign in with Discord</Link>
          ) : null}
          <Link href="/auth-status" className="button ghost">Check Auth Status</Link>
          {showReset ? <Link href="/api/auth/logout" className="button ghost">Reset Login</Link> : null}
          {showBack ? <Link href={backHref} className="button ghost">{backLabel}</Link> : null}
        </div>
      </section>
    </main>
  );
}

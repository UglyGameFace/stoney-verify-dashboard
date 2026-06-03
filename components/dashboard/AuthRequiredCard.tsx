import Link from "next/link";

type AuthRequiredCardProps = {
  eyebrow?: string;
  title?: string;
  message?: string;
  loginUrl?: string;
  showReset?: boolean;
  showBackHome?: boolean;
  error?: string;
};

export default function AuthRequiredCard({
  eyebrow = "Dank Shield Dashboard",
  title = "Login Required",
  message = "Discord login is required to use this dashboard. The page will not auto-open Discord, so login issues will not trap you in an authorize loop.",
  loginUrl = "",
  showReset = false,
  showBackHome = false,
  error = "",
}: AuthRequiredCardProps) {
  return (
    <main className="auth-state-page unified-auth-page" data-auth-state="required">
      <section className="card auth-state-card unified-auth-card" aria-label="Discord login required">
        <div className={`auth-state-eyebrow ${error ? "danger" : ""}`}>{eyebrow}</div>
        <h1>{title}</h1>
        <p className="muted">{message}</p>

        {error ? (
          <pre className="unified-auth-error">{error}</pre>
        ) : null}

        <div className="auth-state-actions unified-auth-actions">
          {loginUrl ? (
            <Link href={loginUrl} className="button primary">Sign in with Discord</Link>
          ) : null}
          <Link href="/auth-status" className="button ghost">Check Auth Status</Link>
          {showReset ? <Link href="/api/auth/logout" className="button ghost">Reset login</Link> : null}
          {showBackHome ? <Link href="/" className="button ghost">Back Home</Link> : null}
        </div>
      </section>
    </main>
  );
}

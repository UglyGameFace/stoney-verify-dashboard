import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getSession,
  getDiscordLoginUrl,
  hasDiscordOAuthConfig,
} from "@/lib/auth-server";

type SearchParams = {
  authError?: string | string[];
};

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "#09090b",
        color: "white",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 680,
          border: "1px solid rgba(255,255,255,0.08)",
          background:
            "radial-gradient(circle at top right, rgba(93,255,141,0.08), transparent 28%), rgba(255,255,255,0.035)",
          borderRadius: 22,
          padding: 24,
          boxShadow: "0 24px 80px rgba(0,0,0,0.35)",
        }}
      >
        {children}
      </div>
    </main>
  );
}

function ButtonLink({ href, children, primary = false }: { href: string; children: React.ReactNode; primary?: boolean }) {
  return (
    <Link
      href={href}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 42,
        padding: "10px 14px",
        borderRadius: 14,
        textDecoration: "none",
        fontWeight: 800,
        fontSize: 14,
        border: primary
          ? "1px solid rgba(93,255,141,0.30)"
          : "1px solid rgba(255,255,255,0.10)",
        background: primary ? "rgba(93,255,141,0.12)" : "rgba(255,255,255,0.05)",
        color: "#f8fafc",
      }}
    >
      {children}
    </Link>
  );
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AuthStatusPage({ searchParams }: { searchParams?: SearchParams }) {
  const authError = firstParam(searchParams?.authError);
  const session = await getSession();

  if (session?.isStaff && !authError) {
    redirect("/");
  }

  if (authError) {
    return (
      <Card>
        <div style={{ fontSize: 13, color: "#fca5a5", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Sign-in failed
        </div>
        <h1 style={{ margin: "8px 0 0", fontSize: "clamp(30px, 5vw, 44px)", letterSpacing: "-0.05em" }}>
          Discord login did not finish
        </h1>
        <p style={{ color: "rgba(255,255,255,0.72)", lineHeight: 1.55 }}>
          The dashboard got an auth error instead of a working staff session. This page shows the reason so it does not silently loop back to sign-in.
        </p>
        <pre
          style={{
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(0,0,0,0.24)",
            borderRadius: 14,
            padding: 12,
            color: "#fecaca",
          }}
        >
          {decodeURIComponent(authError)}
        </pre>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
          {hasDiscordOAuthConfig() ? <ButtonLink href={getDiscordLoginUrl()} primary>Try Discord login again</ButtonLink> : null}
          <ButtonLink href="/">Back to dashboard</ButtonLink>
        </div>
      </Card>
    );
  }

  if (!session) {
    return (
      <Card>
        <div style={{ fontSize: 13, color: "#fde68a", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Not signed in
        </div>
        <h1 style={{ margin: "8px 0 0", fontSize: "clamp(30px, 5vw, 44px)", letterSpacing: "-0.05em" }}>
          No active Discord session
        </h1>
        <p style={{ color: "rgba(255,255,255,0.72)", lineHeight: 1.55 }}>
          The dashboard does not see a valid Discord session cookie yet. Sign in with Discord to continue.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
          {hasDiscordOAuthConfig() ? <ButtonLink href={getDiscordLoginUrl()} primary>Sign in with Discord</ButtonLink> : null}
          <ButtonLink href="/">Back</ButtonLink>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div style={{ fontSize: 13, color: session.isStaff ? "#86efac" : "#fde68a", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
        {session.isStaff ? "Signed in" : "Signed in, not staff"}
      </div>
      <h1 style={{ margin: "8px 0 0", fontSize: "clamp(30px, 5vw, 44px)", letterSpacing: "-0.05em" }}>
        {session.isStaff ? "Dashboard access ready" : "Staff access required"}
      </h1>
      <p style={{ color: "rgba(255,255,255,0.72)", lineHeight: 1.55 }}>
        Signed in as <strong>{session.user?.username || session.discordUser?.username || "Discord user"}</strong>.
      </p>
      {!session.isStaff ? (
        <p style={{ color: "rgba(255,255,255,0.72)", lineHeight: 1.55 }}>
          Your Discord account was found, but the dashboard does not see a configured staff role on your member profile. Check <code>STAFF_ROLE_IDS</code>, <code>STAFF_ROLE_NAMES</code>, bot guild access, and the bot token permissions.
        </p>
      ) : null}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
        <ButtonLink href="/" primary>Open dashboard</ButtonLink>
        {hasDiscordOAuthConfig() ? <ButtonLink href={getDiscordLoginUrl()}>Sign in again</ButtonLink> : null}
      </div>
    </Card>
  );
}

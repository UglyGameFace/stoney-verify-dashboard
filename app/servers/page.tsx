import Link from "next/link";
import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import ServerSelector from "@/components/dashboard/ServerSelector";
import {
  getSession,
  getDiscordLoginUrl,
  hasDiscordOAuthConfig,
} from "@/lib/auth-server";

function LoginRequiredState() {
  const loginUrl = hasDiscordOAuthConfig() ? getDiscordLoginUrl() : "";

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
          maxWidth: 560,
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.03)",
          borderRadius: 20,
          padding: 24,
        }}
      >
        <div style={{ color: "#86efac", fontWeight: 900, fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Dank Shield Dashboard
        </div>
        <h1 style={{ margin: "8px 0 0" }}>Login Required</h1>
        <p style={{ color: "rgba(255,255,255,0.72)", lineHeight: 1.5 }}>
          Sign in with Discord to choose which server you want to manage.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
          {loginUrl ? (
            <Link href={loginUrl} className="button primary" style={{ width: "auto", minWidth: 180 }}>
              Sign in with Discord
            </Link>
          ) : null}
          <Link href="/auth-status" className="button ghost" style={{ width: "auto", minWidth: 170 }}>
            Check Auth Status
          </Link>
        </div>
      </div>
    </main>
  );
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ServersPage() {
  const session = await getSession();

  if (!session) {
    return <LoginRequiredState />;
  }

  return (
    <div className="shell">
      <Sidebar />
      <main className="content">
        <div className="content-inner">
          <div className="space">
            <div
              className="card"
              style={{
                background:
                  "radial-gradient(circle at top right, rgba(93,255,141,0.08), transparent 28%), radial-gradient(circle at bottom left, rgba(99,213,255,0.06), transparent 24%), linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015)), linear-gradient(180deg, rgba(14, 25, 35, 0.98), rgba(7, 13, 21, 0.98))",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 14,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="muted" style={{ marginBottom: 8, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    Server Access
                  </div>
                  <h1 style={{ margin: 0, fontSize: "clamp(30px, 5vw, 46px)", lineHeight: 0.96, letterSpacing: "-0.05em" }}>
                    Choose your server
                  </h1>
                  <div className="muted" style={{ marginTop: 12, maxWidth: 860, lineHeight: 1.55 }}>
                    Dank Shield is a public bot. Pick the server you can manage, then the dashboard loads tickets, forms, categories, and settings for that server only.
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <Link href="/" className="button primary" style={{ width: "auto", minWidth: 160 }}>
                    Dashboard
                  </Link>
                  <Link href="/auth-status" className="button ghost" style={{ width: "auto", minWidth: 160 }}>
                    Auth Status
                  </Link>
                </div>
              </div>
            </div>
            <ServerSelector />
          </div>
        </div>
      </main>
    </div>
  );
}

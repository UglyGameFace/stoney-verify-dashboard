import Link from "next/link";
import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import TicketFormsManager from "@/components/dashboard/TicketFormsManager";
import {
  getSession,
  getDiscordLoginUrl,
  hasDiscordOAuthConfig,
} from "@/lib/auth-server";

type SessionLike = {
  isStaff?: boolean;
} | null;

function LoginRequiredState() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        background: "#09090b",
        color: "white",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.03)",
          borderRadius: 20,
          padding: 24,
        }}
      >
        <h1 style={{ marginTop: 0 }}>Login Required</h1>
        <p style={{ color: "rgba(255,255,255,0.72)", lineHeight: 1.5 }}>
          Discord login is required to manage ticket forms.
        </p>
      </div>
    </main>
  );
}

function TopNavButton({ href, label, primary = false }: { href: string; label: string; primary?: boolean }) {
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
        lineHeight: 1,
        border: primary
          ? "1px solid rgba(93,255,141,0.28)"
          : "1px solid rgba(255,255,255,0.08)",
        background: primary ? "rgba(93,255,141,0.10)" : "rgba(255,255,255,0.04)",
        color: "#f8fafc",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </Link>
  );
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TicketFormsPage() {
  const session = (await getSession()) as SessionLike;

  if (!session) {
    if (hasDiscordOAuthConfig()) {
      redirect(getDiscordLoginUrl());
    }
    return <LoginRequiredState />;
  }

  if (!session?.isStaff) {
    redirect("/");
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
                    Staff Tools
                  </div>
                  <h1 style={{ margin: 0, fontSize: "clamp(30px, 5vw, 46px)", lineHeight: 0.96, letterSpacing: "-0.05em" }}>
                    Ticket Form Manager
                  </h1>
                  <div className="muted" style={{ marginTop: 12, maxWidth: 860, lineHeight: 1.55 }}>
                    Manage the questions members answer after choosing an issue type. Smart defaults work automatically, and custom questions override them per category.
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <TopNavButton href="/" label="← Dashboard" primary />
                  <TopNavButton href="/ticket-categories" label="Category Manager" />
                  <TopNavButton href="/#tickets" label="Tickets" />
                </div>
              </div>
            </div>
            <TicketFormsManager />
          </div>
        </div>
      </main>
    </div>
  );
}

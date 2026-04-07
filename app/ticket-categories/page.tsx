import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import TicketCategoriesManager from "@/components/dashboard/TicketCategoriesManager";
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
          Discord login is required to manage ticket categories.
        </p>
        <p style={{ color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>
          OAuth configuration is currently missing or incomplete.
        </p>
      </div>
    </main>
  );
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TicketCategoriesPage() {
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
            <div className="card">
              <div className="muted" style={{ marginBottom: 8 }}>
                Staff Tools
              </div>

              <h1
                style={{
                  margin: 0,
                  fontSize: "clamp(30px, 5vw, 46px)",
                  lineHeight: 0.96,
                  letterSpacing: "-0.05em",
                }}
              >
                Ticket Category Manager
              </h1>

              <div
                className="muted"
                style={{
                  marginTop: 12,
                  maxWidth: 860,
                  lineHeight: 1.55,
                }}
              >
                Manage category routing, defaults, keyword matching, intake types,
                and safe deletion rules from one place. This is the control layer
                behind your ticket categorization and manual override workflow.
              </div>
            </div>

            <TicketCategoriesManager />
          </div>
        </div>
      </main>
    </div>
  );
}

import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import AuthStatePage from "@/components/dashboard/AuthStatePage";
import { getDashboardAuthSession, type DashboardAuthSession } from "@/lib/dashboard-auth";

function clean(value: unknown): string {
  return String(value || "").trim();
}

function dashboardBaseHref(guildId: string): string {
  return `/dashboard/${encodeURIComponent(guildId)}`;
}

async function safeDashboardAuthSession(): Promise<DashboardAuthSession | null> {
  try {
    return await getDashboardAuthSession();
  } catch {
    return null;
  }
}

function DashboardLockedHome() {
  return (
    <section className="card dashboard-locked-home" aria-label="Dashboard locked until server selection">
      <div className="muted dashboard-locked-eyebrow">Dashboard</div>
      <h1>Choose a server before the dashboard loads</h1>
      <p className="muted">
        You are signed in, but no server is selected yet. Pick the Discord server Dank Shield should manage before opening the staff dashboard or member portal.
      </p>
      <div className="dashboard-locked-actions" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link href="/servers" className="button primary">Choose Server</Link>
        <Link href="/auth-status" className="button ghost">View Account</Link>
      </div>
    </section>
  );
}

function StaffShell({ children }: { children: ReactNode }) {
  return (
    <>
      <Sidebar />
      <main className="content">{children}</main>
    </>
  );
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  const session = await safeDashboardAuthSession();
  if (!session) return <AuthStatePage variant="login" showReset={true} showBack={false} />;

  const guildId = clean(session.selectedGuildId);
  if (!guildId) {
    return (
      <StaffShell>
        <DashboardLockedHome />
      </StaffShell>
    );
  }

  redirect(dashboardBaseHref(guildId));
}

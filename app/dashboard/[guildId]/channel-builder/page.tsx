import type { ReactNode } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import AuthStatePage from "@/components/dashboard/AuthStatePage";
import ChannelBuilderDryRunClient from "@/components/channel-style/ChannelBuilderDryRunClient";
import { getDashboardAuthSession, type DashboardAuthSession } from "@/lib/dashboard-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: { guildId: string };
};

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

function StaffShell({ children }: { children: ReactNode }) {
  return (
    <>
      <Sidebar />
      <main className="content">{children}</main>
    </>
  );
}

function GuildMismatchState({ routeGuildId, selectedGuildId }: { routeGuildId: string; selectedGuildId: string }) {
  return (
    <main className="auth-state-page">
      <div className="card auth-state-card">
        <div className="muted auth-state-eyebrow">Server Context Required</div>
        <h1>Open Channel Builder from the selected server</h1>
        <p className="muted">
          This Channel Builder URL is for server {routeGuildId}, but your active selected server is {selectedGuildId || "not set"}.
        </p>
        <div className="auth-state-actions">
          <Link href="/servers" className="button primary">Choose Server</Link>
          <Link href="/auth-status" className="button ghost">View Account</Link>
        </div>
      </div>
    </main>
  );
}

export default async function ChannelBuilderPage({ params }: PageProps) {
  const routeGuildId = clean(params.guildId);
  const session = await safeDashboardAuthSession();
  if (!session) return <AuthStatePage variant="login" showReset={true} showBack={false} />;

  const selectedGuildId = clean(session.selectedGuildId);
  if (!routeGuildId || selectedGuildId !== routeGuildId) {
    return <GuildMismatchState routeGuildId={routeGuildId || "unknown"} selectedGuildId={selectedGuildId} />;
  }

  if (!session.isStaff) {
    return <AuthStatePage variant="forbidden" showReset={true} showBack={true} />;
  }

  return (
    <StaffShell>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <Link href={dashboardBaseHref(routeGuildId)} className="button ghost" style={{ width: "auto" }}>Back to dashboard</Link>
        <Link href={`${dashboardBaseHref(routeGuildId)}/categories`} className="button ghost" style={{ width: "auto" }}>Categories</Link>
        <Link href={`${dashboardBaseHref(routeGuildId)}/forms`} className="button ghost" style={{ width: "auto" }}>Forms</Link>
      </div>
      <ChannelBuilderDryRunClient guildId={routeGuildId} />
    </StaffShell>
  );
}

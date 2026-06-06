import { queueSyncMembers } from "@/lib/botCommands";
import { requireDashboardStaffSession, dashboardAuthJson, type DashboardAuthSession } from "@/lib/dashboard-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ErrorWithStatus = Error & { status?: number };

function errorStatus(error: unknown, fallback: number): number {
  return typeof (error as ErrorWithStatus)?.status === "number" ? Number((error as ErrorWithStatus).status) : fallback;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export async function POST() {
  let session: DashboardAuthSession | null = null;

  try {
    session = await requireDashboardStaffSession();
    const guildId = session.selectedGuildId;
    const actorId = session.user.discord_id;

    if (!guildId) {
      return dashboardAuthJson({ ok: false, queued: false, error: "Select a server before syncing members.", needsServerSelection: true }, 428, session);
    }

    const command = await queueSyncMembers({ guildId, requestedBy: actorId });

    return dashboardAuthJson({ ok: true, queued: true, command }, 200, session);
  } catch (error) {
    return dashboardAuthJson(
      { ok: false, queued: false, error: errorMessage(error, "Member sync failed.") },
      errorStatus(error, 500),
      session
    );
  }
}

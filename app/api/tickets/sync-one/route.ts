import { NextRequest } from "next/server";
import { requireDashboardStaffSession, dashboardAuthJson, dashboardAuthErrorJson, type DashboardAuthSession } from "@/lib/dashboard-auth";
import { parseRouteBody, readBoolean, readString } from "@/lib/ticketActionRoute";
import { queueSyncSingleTicket } from "@/lib/botCommands";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function actorIdFromSession(session: DashboardAuthSession | null): string {
  return String(session?.user?.discord_id || session?.user?.id || session?.discordUser?.id || "").trim();
}

function json(payload: Record<string, unknown>, status = 200, session: DashboardAuthSession | null = null) {
  return dashboardAuthJson(payload, status, session);
}

function missingField(field: string, session: DashboardAuthSession | null) {
  return json({ ok: false, queued: false, error: `Missing ${field}`, error_code: "invalid_request" }, 400, session);
}

export async function POST(req: NextRequest) {
  let session: DashboardAuthSession | null = null;

  try {
    session = await requireDashboardStaffSession();
    const actorId = actorIdFromSession(session);
    if (!actorId) return json({ ok: false, queued: false, error: "Could not identify signed-in staff member.", error_code: "invalid_request" }, 400, session);

    const body = await parseRouteBody(req);
    const channelId = readString(body, ["channelId", "channel_id"]);
    const dryRun = readBoolean(body, ["dryRun", "dry_run"], false);
    const requestedBy = readString(body, ["requestedBy", "requested_by"], actorId) || actorId;

    if (!channelId) return missingField("channelId", session);

    const command = await queueSyncSingleTicket({ channelId, dryRun, requestedBy: actorId });

    return json(
      {
        ok: true,
        queued: true,
        command,
        channelId,
        dryRun,
        requestedBy,
        effectiveRequestedBy: actorId,
      },
      200,
      session
    );
  } catch (error) {
    return dashboardAuthErrorJson(error, session, 500);
  }
}

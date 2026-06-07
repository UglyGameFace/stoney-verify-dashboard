import { NextRequest } from "next/server";
import { queueReopenTicket } from "@/lib/botCommands";
import { requireDashboardStaffSession, dashboardAuthJson, dashboardAuthErrorJson, type DashboardAuthSession } from "@/lib/dashboard-auth";
import { parseRouteBody, readString } from "@/lib/ticketActionRoute";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function actorIdFromSession(session: DashboardAuthSession | null): string {
  return String(session?.user?.discord_id || session?.user?.id || session?.discordUser?.id || "").trim();
}

function json(payload: Record<string, unknown>, status = 200, session: DashboardAuthSession | null = null) {
  return dashboardAuthJson(payload, status, session);
}

function missingField(field: string, session: DashboardAuthSession | null) {
  return json({ ok: false, error: `Missing ${field}`, error_code: "invalid_request" }, 400, session);
}

export async function POST(req: NextRequest) {
  let session: DashboardAuthSession | null = null;

  try {
    session = await requireDashboardStaffSession();
    const actorId = actorIdFromSession(session);
    if (!actorId) return json({ ok: false, error: "Could not identify signed-in staff member.", error_code: "invalid_request" }, 400, session);

    const body = await parseRouteBody(req);
    const channelId = readString(body, ["channelId", "channel_id"]);
    const staffId = readString(body, ["staffId", "staff_id"], actorId);
    const requestedBy = readString(body, ["requestedBy", "requested_by", "actorId", "actor_id"], actorId) || actorId;

    if (!channelId) return missingField("channelId", session);

    const command = await queueReopenTicket({ channelId, requestedBy: actorId });

    return json(
      {
        ok: true,
        queued: true,
        command,
        channelId,
        staffId,
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

import { NextRequest } from "next/server";
import { queueSyncActiveTickets } from "@/lib/botCommands";
import { requireDashboardStaffSession, dashboardAuthJson, dashboardAuthErrorJson, type DashboardAuthSession } from "@/lib/dashboard-auth";
import {
  parseRouteBody,
  readBoolean,
  readString,
} from "@/lib/ticketActionRoute";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  let session: DashboardAuthSession | null = null;

  try {
    session = await requireDashboardStaffSession();
    const guildId = session.selectedGuildId;
    const actorId = session.user.discord_id;

    if (!guildId) {
      return dashboardAuthJson(
        {
          ok: false,
          queued: false,
          error: "Select a server before syncing active tickets.",
          error_code: "selected_server_required",
          needsServerSelection: true,
        },
        428,
        session
      );
    }

    const body = await parseRouteBody(req);
    const dryRun = readBoolean(body, ["dryRun", "dry_run"], false);
    const includeClosedVisibleChannels = readBoolean(
      body,
      ["includeClosedVisibleChannels", "include_closed_visible_channels"],
      true
    );
    const requestedBy = readString(body, ["requestedBy", "requested_by"], actorId) || actorId;

    const command = await queueSyncActiveTickets({
      guildId,
      requestedBy: actorId,
      dryRun,
      includeClosedVisibleChannels,
    });

    return dashboardAuthJson(
      {
        ok: true,
        queued: true,
        selectedGuildId: guildId,
        command,
        dryRun,
        includeClosedVisibleChannels,
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

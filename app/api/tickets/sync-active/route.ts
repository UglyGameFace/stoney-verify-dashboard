import { NextRequest } from "next/server";
import { queueSyncActiveTickets } from "@/lib/botCommands";
import { requireDashboardStaffSession, dashboardAuthJson, type DashboardAuthSession } from "@/lib/dashboard-auth";
import {
  parseRouteBody,
  readBoolean,
  readString,
  toErrorMessage,
} from "@/lib/ticketActionRoute";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ErrorWithStatus = Error & { status?: number };

function errorStatus(error: unknown, fallback: number): number {
  return typeof (error as ErrorWithStatus)?.status === "number" ? Number((error as ErrorWithStatus).status) : fallback;
}

export async function POST(req: NextRequest) {
  let session: DashboardAuthSession | null = null;

  try {
    session = await requireDashboardStaffSession();
    const guildId = session.selectedGuildId;
    const actorId = session.user.discord_id;

    if (!guildId) {
      return dashboardAuthJson(
        { ok: false, queued: false, error: "Select a server before syncing active tickets.", needsServerSelection: true },
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
    return dashboardAuthJson(
      { ok: false, queued: false, error: toErrorMessage(error) },
      errorStatus(error, 500),
      session
    );
  }
}

import { NextRequest } from "next/server";
import { queueSyncActiveTickets } from "@/lib/botCommands";
import { requireStaffSessionForRoute } from "@/lib/auth-server";
import {
  buildRouteJson,
  getActorId,
  parseRouteBody,
  readBoolean,
  readString,
  toErrorMessage,
  unauthorizedRouteResponse,
  type RefreshedTokens,
} from "@/lib/ticketActionRoute";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  let refreshedTokens: RefreshedTokens | null = null;

  try {
    const auth = await requireStaffSessionForRoute();
    refreshedTokens = auth?.refreshedTokens ?? null;

    const actorId = getActorId(auth?.session);
    if (!actorId) {
      return unauthorizedRouteResponse(refreshedTokens);
    }

    const body = await parseRouteBody(req);

    const dryRun = readBoolean(body, ["dryRun", "dry_run"], false);
    const includeClosedVisibleChannels = readBoolean(
      body,
      ["includeClosedVisibleChannels", "include_closed_visible_channels"],
      true
    );
    const requestedBy =
      readString(body, ["requestedBy", "requested_by"], actorId) || actorId;

    const command = await queueSyncActiveTickets({
      requestedBy: actorId,
      dryRun,
      includeClosedVisibleChannels,
    });

    return buildRouteJson(
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
      refreshedTokens
    );
  } catch (error) {
    const message = toErrorMessage(error);

    return buildRouteJson(
      {
        ok: false,
        queued: false,
        error: message,
      },
      message === "Unauthorized" ? 401 : 500,
      refreshedTokens
    );
  }
}

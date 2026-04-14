import { NextRequest } from "next/server";
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
import { queueSyncSingleTicket } from "@/lib/botCommands";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function missingFieldRouteResponse(
  field: string,
  refreshedTokens: RefreshedTokens | null
) {
  return buildRouteJson(
    {
      ok: false,
      error: `Missing ${field}`,
    },
    400,
    refreshedTokens
  );
}

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

    const channelId = readString(body, ["channelId", "channel_id"]);
    const dryRun = readBoolean(body, ["dryRun", "dry_run"], false);
    const requestedBy =
      readString(body, ["requestedBy", "requested_by"], actorId) || actorId;

    if (!channelId) {
      return missingFieldRouteResponse("channelId", refreshedTokens);
    }

    const command = await queueSyncSingleTicket({
      channelId,
      dryRun,
      requestedBy: actorId,
    });

    return buildRouteJson(
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

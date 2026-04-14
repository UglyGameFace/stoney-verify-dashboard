import { NextRequest } from "next/server";
import { queueReopenTicket } from "@/lib/botCommands";
import { requireStaffSessionForRoute } from "@/lib/auth-server";
import {
  buildRouteJson,
  getActorId,
  parseRouteBody,
  readString,
  toErrorMessage,
  unauthorizedRouteResponse,
  type RefreshedTokens,
} from "@/lib/ticketActionRoute";

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
    const staffId = readString(body, ["staffId", "staff_id"], actorId);
    const requestedBy =
      readString(
        body,
        ["requestedBy", "requested_by", "actorId", "actor_id"],
        actorId
      ) || actorId;

    if (!channelId) {
      return missingFieldRouteResponse("channelId", refreshedTokens);
    }

    const command = await queueReopenTicket({
      channelId,
      requestedBy: actorId,
    });

    return buildRouteJson(
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
      refreshedTokens
    );
  } catch (error) {
    const message = toErrorMessage(error);

    return buildRouteJson(
      {
        ok: false,
        error: message,
      },
      message === "Unauthorized" ? 401 : 500,
      refreshedTokens
    );
  }
}

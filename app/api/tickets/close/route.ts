import { NextRequest } from "next/server";
import { queueCloseTicket } from "@/lib/botCommands";
import { requireStaffSessionForRoute } from "@/lib/auth-server";
import {
  buildRouteJson,
  getActorId,
  missingFieldRouteResponse,
  parseRouteBody,
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

    const channelId = readString(body, ["channelId", "channel_id"]);
    const reason = readString(body, ["reason"], "Resolved");

    if (!channelId) {
      return missingFieldRouteResponse("channelId", refreshedTokens);
    }

    const command = await queueCloseTicket({
      channelId,
      reason,
      staffId: actorId,
      requestedBy: actorId,
    });

    return buildRouteJson(
      {
        ok: true,
        queued: true,
        command,
        channelId,
        reason,
        staffId: actorId,
        requestedBy: actorId,
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

import { NextRequest } from "next/server";
import { queueCreateTicket } from "@/lib/botCommands";
import { requireStaffSessionForRoute } from "@/lib/auth-server";
import { insertMemberEvent } from "@/lib/memberEventWrites";
import { env } from "@/lib/env";
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

function getActorName(session: any): string {
  return (
    session?.user?.username ||
    session?.user?.name ||
    session?.discordUser?.username ||
    "Dashboard Staff"
  );
}

function normalizeNullable(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function readStringArray(
  body: Record<string, unknown>,
  keys: string[]
): string[] | null {
  for (const key of keys) {
    const value = body?.[key];
    if (!Array.isArray(value)) continue;

    const cleaned = value
      .map((item) => String(item ?? "").trim())
      .filter(Boolean);

    return cleaned.length ? cleaned : null;
  }

  return null;
}

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
    const actorName = getActorName(auth?.session);
    const guildId = env.guildId || "";

    if (!actorId) {
      return unauthorizedRouteResponse(refreshedTokens);
    }

    const body = await parseRouteBody(req);

    const userId = readString(body, ["userId", "user_id"]);
    const category = readString(body, ["category"], "support");
    const openingMessage = readString(
      body,
      ["openingMessage", "opening_message"],
      ""
    );
    const priority = readString(body, ["priority"], "medium");
    const parentCategoryId = readString(
      body,
      ["parentCategoryId", "parent_category_id"],
      ""
    );
    const allowDuplicate = readBoolean(
      body,
      ["allowDuplicate", "allow_duplicate"],
      false
    );

    const staffRoleIds = readStringArray(body, [
      "staffRoleIds",
      "staff_role_ids",
    ]);

    const entryMethod =
      readString(body, ["entryMethod", "entry_method"], "") || null;

    const verificationSource =
      readString(body, ["verificationSource", "verification_source"], "") || null;

    const sourceTicketId =
      readString(body, ["sourceTicketId", "source_ticket_id"], "") || null;

    const verificationTicketId =
      readString(
        body,
        ["verificationTicketId", "verification_ticket_id"],
        ""
      ) ||
      sourceTicketId ||
      null;

    const invitedBy =
      readString(body, ["invitedBy", "invited_by"], "") || null;

    const invitedByName =
      readString(body, ["invitedByName", "invited_by_name"], "") || null;

    const inviteCode =
      readString(body, ["inviteCode", "invite_code"], "") || null;

    const vouchedBy =
      readString(body, ["vouchedBy", "vouched_by"], "") || null;

    const vouchedByName =
      readString(body, ["vouchedByName", "vouched_by_name"], "") || null;

    const approvedBy =
      readString(body, ["approvedBy", "approved_by"], "") || actorId;

    const approvedByName =
      readString(body, ["approvedByName", "approved_by_name"], "") ||
      actorName;

    const entryReason =
      readString(body, ["entryReason", "entry_reason"], "") || null;

    const approvalReason =
      readString(body, ["approvalReason", "approval_reason"], "") || null;

    if (!userId) {
      return missingFieldRouteResponse("userId", refreshedTokens);
    }

    const command = await queueCreateTicket({
      userId,
      category,
      priority,
      openingMessage,
      ghost: false,
      allowDuplicate,
      requestedBy: actorId,
      parentCategoryId: normalizeNullable(parentCategoryId),
      staffRoleIds,
      entryMethod,
      verificationSource,
      sourceTicketId,
      verificationTicketId,
      invitedBy,
      invitedByName,
      inviteCode,
      vouchedBy,
      vouchedByName,
      approvedBy,
      approvedByName,
      entryReason,
      approvalReason,
    });

    if (guildId) {
      await insertMemberEvent({
        guildId,
        userId,
        actorId,
        actorName,
        eventType: "ticket_created_from_dashboard",
        title: "Ticket Created From Dashboard",
        reason: openingMessage || `Dashboard created ${category} ticket.`,
        metadata: {
          category,
          priority,
          source_ticket_id: sourceTicketId,
          verification_ticket_id: verificationTicketId,
          entry_method: entryMethod,
          verification_source: verificationSource,
          invited_by: invitedBy,
          invited_by_name: invitedByName,
          invite_code: inviteCode,
          vouched_by: vouchedBy,
          vouched_by_name: vouchedByName,
          approved_by: approvedBy,
          approved_by_name: approvedByName,
          command_id: command?.id || null,
          allow_duplicate: allowDuplicate,
          parent_category_id: normalizeNullable(parentCategoryId),
          staff_role_ids: staffRoleIds || [],
        },
      });
    }

    return buildRouteJson(
      {
        ok: true,
        queued: true,
        command,
        userId,
        category,
        priority,
        openingMessage,
        allowDuplicate,
        requestedBy: actorId,
        effectiveRequestedBy: actorId,
        approvedBy,
        approvedByName,
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

import { NextRequest, NextResponse } from "next/server";
import { queueCreateTicket } from "@/lib/botCommands";
import { requireStaffSessionForRoute } from "@/lib/auth-server";
import { insertMemberEvent } from "@/lib/memberEventWrites";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

function getActorId(session: any): string | null {
  const candidates = [
    session?.user?.discord_id,
    session?.user?.id,
    session?.user?.user_id,
    session?.discordUser?.id,
  ];

  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  if (typeof candidates[0] === "number") {
    return String(candidates[0]);
  }

  return null;
}

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

export async function POST(req: NextRequest) {
  try {
    const session = await requireStaffSessionForRoute();
    const actorId = getActorId(session);
    const actorName = getActorName(session);
    const guildId = env.guildId || "";

    if (!actorId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Unauthorized",
        },
        { status: 401 }
      );
    }

    const body = await req.json();

    const userId =
      typeof body?.userId === "string" && body.userId.trim()
        ? body.userId.trim()
        : typeof body?.user_id === "string" && body.user_id.trim()
        ? body.user_id.trim()
        : "";

    const category =
      typeof body?.category === "string" && body.category.trim()
        ? body.category.trim()
        : "support";

    const openingMessage =
      typeof body?.openingMessage === "string"
        ? body.openingMessage
        : typeof body?.opening_message === "string"
        ? body.opening_message
        : "";

    const priority =
      typeof body?.priority === "string" && body.priority.trim()
        ? body.priority.trim()
        : "medium";

    const parentCategoryId =
      typeof body?.parentCategoryId === "string" && body.parentCategoryId.trim()
        ? body.parentCategoryId.trim()
        : typeof body?.parent_category_id === "string" &&
          body.parent_category_id.trim()
        ? body.parent_category_id.trim()
        : null;

    const staffRoleIds = Array.isArray(body?.staffRoleIds)
      ? body.staffRoleIds
          .map((x: unknown) => String(x).trim())
          .filter(Boolean)
      : Array.isArray(body?.staff_role_ids)
      ? body.staff_role_ids
          .map((x: unknown) => String(x).trim())
          .filter(Boolean)
      : null;

    const allowDuplicate = Boolean(
      body?.allowDuplicate ?? body?.allow_duplicate
    );

    const entryMethod =
      normalizeNullable(body?.entryMethod) ||
      normalizeNullable(body?.entry_method);

    const verificationSource =
      normalizeNullable(body?.verificationSource) ||
      normalizeNullable(body?.verification_source);

    const sourceTicketId =
      normalizeNullable(body?.sourceTicketId) ||
      normalizeNullable(body?.source_ticket_id);

    const verificationTicketId =
      normalizeNullable(body?.verificationTicketId) ||
      normalizeNullable(body?.verification_ticket_id) ||
      sourceTicketId;

    const invitedBy =
      normalizeNullable(body?.invitedBy) ||
      normalizeNullable(body?.invited_by);

    const invitedByName =
      normalizeNullable(body?.invitedByName) ||
      normalizeNullable(body?.invited_by_name);

    const inviteCode =
      normalizeNullable(body?.inviteCode) ||
      normalizeNullable(body?.invite_code);

    const vouchedBy =
      normalizeNullable(body?.vouchedBy) ||
      normalizeNullable(body?.vouched_by);

    const vouchedByName =
      normalizeNullable(body?.vouchedByName) ||
      normalizeNullable(body?.vouched_by_name);

    const approvedBy =
      normalizeNullable(body?.approvedBy) ||
      normalizeNullable(body?.approved_by) ||
      actorId;

    const approvedByName =
      normalizeNullable(body?.approvedByName) ||
      normalizeNullable(body?.approved_by_name) ||
      actorName;

    const entryReason =
      normalizeNullable(body?.entryReason) ||
      normalizeNullable(body?.entry_reason);

    const approvalReason =
      normalizeNullable(body?.approvalReason) ||
      normalizeNullable(body?.approval_reason);

    if (!userId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing userId",
        },
        { status: 400 }
      );
    }

    const command = await queueCreateTicket({
      userId,
      category,
      priority,
      openingMessage,
      ghost: false,
      allowDuplicate,
      requestedBy: actorId,
      parentCategoryId,
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
        },
      });
    }

    return NextResponse.json({
      ok: true,
      queued: true,
      command,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: message === "Unauthorized" ? 401 : 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { queueCreateTicket } from "@/lib/botCommands";
import { requireStaffSessionForRoute } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

function getActorId(session: any): string | null {
  const candidates = [
    session?.user?.id,
    session?.user?.user_id,
    session?.user?.discord_id,
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

export async function POST(req: NextRequest) {
  try {
    const session = await requireStaffSessionForRoute();
    const actorId = getActorId(session);

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
    });

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

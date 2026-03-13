import { NextRequest, NextResponse } from "next/server";
import { botCreateTicket } from "@/lib/botApi";

export const dynamic = "force-dynamic";

function getGuildId(): string {
  const guildId =
    process.env.DISCORD_GUILD_ID ||
    process.env.NEXT_PUBLIC_DISCORD_GUILD_ID ||
    "";

  if (!guildId.trim()) {
    throw new Error("Missing DISCORD_GUILD_ID / NEXT_PUBLIC_DISCORD_GUILD_ID");
  }

  return guildId.trim();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const userId = String(body?.userId || body?.user_id || "").trim();
    const category = String(body?.category || "support").trim() || "support";
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
        : undefined;

    const staffRoleIds = Array.isArray(body?.staffRoleIds)
      ? body.staffRoleIds.map((x: unknown) => String(x))
      : Array.isArray(body?.staff_role_ids)
      ? body.staff_role_ids.map((x: unknown) => String(x))
      : undefined;

    const allowDuplicate = Boolean(body?.allowDuplicate ?? body?.allow_duplicate);

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Missing userId" },
        { status: 400 }
      );
    }

    const guildId = getGuildId();

    const result = await botCreateTicket({
      guildId,
      userId,
      category,
      ghost: false,
      openingMessage,
      priority,
      parentCategoryId,
      staffRoleIds,
      allowDuplicate,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: result.error || "Failed to create ticket",
          details: result,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      created: result.created ?? false,
      duplicate: result.duplicate ?? false,
      existing_ticket: result.existing_ticket ?? null,
      ticket: result.ticket ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Unexpected server error",
      },
      { status: 500 }
    );
  }
}

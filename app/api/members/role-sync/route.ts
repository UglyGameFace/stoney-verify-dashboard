import { NextRequest, NextResponse } from "next/server";
import { queueSyncRoleMembers } from "@/lib/botCommands";
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

    const roleId =
      typeof body?.roleId === "string" && body.roleId.trim()
        ? body.roleId.trim()
        : typeof body?.role_id === "string" && body.role_id.trim()
        ? body.role_id.trim()
        : "";

    if (!roleId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing roleId",
        },
        { status: 400 }
      );
    }

    const command = await queueSyncRoleMembers({
      roleId,
      requestedBy: actorId,
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

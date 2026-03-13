import { NextRequest, NextResponse } from "next/server";
import { queueSyncRoleMembers } from "@/lib/botCommands";

export const dynamic = "force-dynamic";

function getRequestedBy(body: any): string | null {
  const candidates = [
    body?.requestedBy,
    body?.requested_by,
    body?.staffId,
    body?.staff_id,
    body?.userId,
    body?.user_id,
  ];

  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
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
      requestedBy: getRequestedBy(body),
    });

    return NextResponse.json({
      ok: true,
      queued: true,
      command,
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

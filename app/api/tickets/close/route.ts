import { NextRequest, NextResponse } from "next/server";
import { queueCloseTicket } from "@/lib/botCommands";

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

    const channelId =
      typeof body?.channelId === "string" && body.channelId.trim()
        ? body.channelId.trim()
        : typeof body?.channel_id === "string" && body.channel_id.trim()
        ? body.channel_id.trim()
        : "";

    const reason =
      typeof body?.reason === "string" && body.reason.trim()
        ? body.reason.trim()
        : "Resolved";

    const staffId =
      typeof body?.staffId === "string" && body.staffId.trim()
        ? body.staffId.trim()
        : typeof body?.staff_id === "string" && body.staff_id.trim()
        ? body.staff_id.trim()
        : null;

    if (!channelId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing channelId",
        },
        { status: 400 }
      );
    }

    const command = await queueCloseTicket({
      channelId,
      reason,
      staffId,
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

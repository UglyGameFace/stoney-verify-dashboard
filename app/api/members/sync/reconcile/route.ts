import { NextRequest, NextResponse } from "next/server";
import { queueReconcileDepartedMembers } from "@/lib/botCommands";

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
    let body: any = {};

    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const command = await queueReconcileDepartedMembers({
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

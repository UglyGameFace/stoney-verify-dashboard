import { NextRequest, NextResponse } from "next/server";
import { queueAssignTicket } from "@/lib/botCommands";
import { requireStaffSessionForRoute, applyAuthCookies } from "@/lib/auth-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
    const { session, refreshedTokens } = await requireStaffSessionForRoute();
    const actorId = getActorId(session);

    if (!actorId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Unauthorized",
        },
        {
          status: 401,
          headers: {
            "Cache-Control": "no-store, max-age=0",
          },
        }
      );
    }

    const body = await req.json().catch(() => ({}));

    const channelId =
      typeof body?.channelId === "string" && body.channelId.trim()
        ? body.channelId.trim()
        : typeof body?.channel_id === "string" && body.channel_id.trim()
        ? body.channel_id.trim()
        : "";

    const staffId =
      typeof body?.staffId === "string" && body.staffId.trim()
        ? body.staffId.trim()
        : typeof body?.staff_id === "string" && body.staff_id.trim()
        ? body.staff_id.trim()
        : actorId;

    if (!channelId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing channelId",
        },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store, max-age=0",
          },
        }
      );
    }

    if (!staffId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing staffId",
        },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store, max-age=0",
          },
        }
      );
    }

    const command = await queueAssignTicket({
      channelId,
      staffId,
      requestedBy: actorId,
    });

    const response = NextResponse.json(
      {
        ok: true,
        queued: true,
        command,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );

    applyAuthCookies(response, refreshedTokens);
    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      {
        status: message === "Unauthorized" ? 401 : 500,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { queueReconcileDepartedMembers } from "@/lib/botCommands";
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
          queued: false,
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

    try {
      await req.json();
    } catch {
      // ignore body intentionally
    }

    const command = await queueReconcileDepartedMembers({
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
      error instanceof Error
        ? error.message
        : "Failed to queue reconcile command";

    return NextResponse.json(
      {
        ok: false,
        queued: false,
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

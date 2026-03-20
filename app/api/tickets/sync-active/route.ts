import { NextRequest, NextResponse } from "next/server";
import { requireStaffSessionForRoute, applyAuthCookies } from "@/lib/auth-server";
import { env } from "@/lib/env";

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

function getBotApiBaseUrl(): string {
  const value =
    process.env.BOT_API_BASE_URL ||
    process.env.NEXT_PRIVATE_BOT_API_BASE_URL ||
    process.env.BOT_STRUCTURED_API_BASE_URL ||
    "";

  const out = String(value || "").trim().replace(/\/+$/, "");
  if (!out) {
    throw new Error(
      "Missing BOT_API_BASE_URL for dashboard ticket sync route"
    );
  }
  return out;
}

function getGuildId(): string {
  const value =
    env.guildId ||
    process.env.DISCORD_GUILD_ID ||
    process.env.GUILD_ID ||
    process.env.NEXT_PUBLIC_DISCORD_GUILD_ID ||
    "";

  const out = String(value || "").trim();
  if (!out) {
    throw new Error("Missing guild id");
  }
  return out;
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
    const dryRun = Boolean(body?.dryRun);
    const includeClosedVisibleChannels = Boolean(
      body?.includeClosedVisibleChannels ?? true
    );

    const baseUrl = getBotApiBaseUrl();
    const guildId = getGuildId();

    const upstream = await fetch(`${baseUrl}/tickets/sync-active`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({
        guild_id: guildId,
        dry_run: dryRun,
        include_closed_visible_channels: includeClosedVisibleChannels,
        requested_by: actorId,
      }),
    });

    const data = await upstream.json().catch(() => null);

    if (!upstream.ok) {
      throw new Error(
        data?.error ||
          `Bot ticket sync request failed (${upstream.status})`
      );
    }

    const response = NextResponse.json(
      {
        ok: true,
        summary: data?.summary || null,
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
      error instanceof Error ? error.message : "Failed to sync active tickets";

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

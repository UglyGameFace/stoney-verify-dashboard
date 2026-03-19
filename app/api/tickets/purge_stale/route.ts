import { NextRequest, NextResponse } from "next/server";
import { requireStaffSessionForRoute, applyAuthCookies } from "@/lib/auth-server";
import { createServerSupabase } from "@/lib/supabase-server";
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

function parseDateMs(value: unknown): number {
  const ms = new Date(String(value || "")).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function isClosedLikeStatus(status: unknown): boolean {
  const value = String(status || "").trim().toLowerCase();
  return value === "closed" || value === "deleted";
}

function hasUsableChannel(ticket: any): boolean {
  return Boolean(
    String(ticket?.channel_id || ticket?.discord_thread_id || "").trim()
  );
}

function isPurgeCandidate(ticket: any, olderThanMinutes: number): boolean {
  if (!ticket || typeof ticket !== "object") return false;

  const missingChannel = !hasUsableChannel(ticket);
  if (!missingChannel) return false;

  if (!isClosedLikeStatus(ticket?.status)) return false;

  const newestMs = Math.max(
    parseDateMs(ticket?.closed_at),
    parseDateMs(ticket?.deleted_at),
    parseDateMs(ticket?.updated_at),
    parseDateMs(ticket?.created_at)
  );

  const ageMs = Date.now() - newestMs;
  return ageMs >= olderThanMinutes * 60 * 1000;
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
    const rawOlderThan = Number(body?.olderThanMinutes);
    const olderThanMinutes =
      Number.isFinite(rawOlderThan) && rawOlderThan > 0
        ? Math.max(1, Math.floor(rawOlderThan))
        : 5;

    const guildId = String(env.guildId || "").trim();
    if (!guildId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing guild id",
        },
        {
          status: 500,
          headers: {
            "Cache-Control": "no-store, max-age=0",
          },
        }
      );
    }

    const supabase = createServerSupabase();

    const { data: tickets, error: ticketsError } = await supabase
      .from("tickets")
      .select("*")
      .eq("guild_id", guildId)
      .order("updated_at", { ascending: false })
      .limit(500);

    if (ticketsError) {
      return NextResponse.json(
        {
          ok: false,
          error: ticketsError.message || "Failed to load tickets",
        },
        {
          status: 500,
          headers: {
            "Cache-Control": "no-store, max-age=0",
          },
        }
      );
    }

    const rows = Array.isArray(tickets) ? tickets : [];
    const candidates = rows.filter((ticket) =>
      isPurgeCandidate(ticket, olderThanMinutes)
    );

    let removed = 0;

    if (!dryRun && candidates.length > 0) {
      const ids = candidates
        .map((ticket) => String(ticket?.id || "").trim())
        .filter(Boolean);

      if (ids.length > 0) {
        const { error: deleteError, count } = await supabase
          .from("tickets")
          .delete({ count: "exact" })
          .in("id", ids);

        if (deleteError) {
          return NextResponse.json(
            {
              ok: false,
              error: deleteError.message || "Failed to purge stale tickets",
            },
            {
              status: 500,
              headers: {
                "Cache-Control": "no-store, max-age=0",
              },
            }
          );
        }

        removed = Number(count || 0);
      }
    }

    await supabase.from("audit_events").insert({
      title: dryRun ? "Stale ticket purge preview" : "Stale tickets purged",
      description: `${
        dryRun ? "Previewed" : "Purged"
      } ${candidates.length} stale ticket row(s) older than ${olderThanMinutes} minute(s). Triggered by ${actorId}.`,
      event_type: dryRun ? "ticket_purge_preview" : "ticket_purge",
      related_id: actorId,
    });

    const response = NextResponse.json(
      {
        ok: true,
        dryRun,
        scanned: rows.length,
        removed,
        candidates: candidates.map((ticket) => ({
          id: ticket?.id || null,
          channel_id: ticket?.channel_id || null,
          discord_thread_id: ticket?.discord_thread_id || null,
          status: ticket?.status || null,
          title: ticket?.title || ticket?.channel_name || null,
          username: ticket?.username || null,
          updated_at: ticket?.updated_at || null,
          closed_at: ticket?.closed_at || null,
          deleted_at: ticket?.deleted_at || null,
          is_ghost: ticket?.is_ghost === true,
        })),
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
      error instanceof Error ? error.message : "Failed to purge stale tickets";

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

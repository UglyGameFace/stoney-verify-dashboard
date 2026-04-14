import { NextRequest } from "next/server";
import { requireStaffSessionForRoute } from "@/lib/auth-server";
import { createServerSupabase } from "@/lib/supabase-server";
import { env } from "@/lib/env";
import {
  buildRouteJson,
  getActorId,
  parseRouteBody,
  readBoolean,
  readString,
  toErrorMessage,
  unauthorizedRouteResponse,
  type RefreshedTokens,
} from "@/lib/ticketActionRoute";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function normalizeString(value: unknown): string {
  return String(value ?? "").trim();
}

function parseDateMs(value: unknown): number {
  const ms = new Date(normalizeString(value)).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function isClosedLikeStatus(status: unknown): boolean {
  const value = normalizeString(status).toLowerCase();
  return value === "closed" || value === "deleted";
}

function hasUsableChannel(ticket: any): boolean {
  return Boolean(
    normalizeString(ticket?.channel_id || ticket?.discord_thread_id)
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

function summarizeCandidate(ticket: any) {
  return {
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
  };
}

function missingGuildIdResponse(refreshedTokens: RefreshedTokens | null) {
  return buildRouteJson(
    {
      ok: false,
      error: "Missing guild id",
    },
    500,
    refreshedTokens
  );
}

export async function POST(req: NextRequest) {
  let refreshedTokens: RefreshedTokens | null = null;

  try {
    const auth = await requireStaffSessionForRoute();
    refreshedTokens = auth?.refreshedTokens ?? null;

    const actorId = getActorId(auth?.session);
    if (!actorId) {
      return unauthorizedRouteResponse(refreshedTokens);
    }

    const body = await parseRouteBody(req);

    const dryRun = readBoolean(body, ["dryRun", "dry_run"], false);
    const requestedBy =
      readString(body, ["requestedBy", "requested_by"], actorId) || actorId;

    const olderThanRaw = Number(
      readString(body, ["olderThanMinutes", "older_than_minutes"], "5")
    );

    const olderThanMinutes =
      Number.isFinite(olderThanRaw) && olderThanRaw > 0
        ? Math.max(1, Math.floor(olderThanRaw))
        : 5;

    const guildId = normalizeString(env.guildId);
    if (!guildId) {
      return missingGuildIdResponse(refreshedTokens);
    }

    const supabase = createServerSupabase();

    const { data: tickets, error: ticketsError } = await supabase
      .from("tickets")
      .select("*")
      .eq("guild_id", guildId)
      .order("updated_at", { ascending: false })
      .limit(500);

    if (ticketsError) {
      throw new Error(ticketsError.message || "Failed to load tickets");
    }

    const rows = Array.isArray(tickets) ? tickets : [];
    const candidates = rows.filter((ticket) =>
      isPurgeCandidate(ticket, olderThanMinutes)
    );

    let removed = 0;

    if (!dryRun && candidates.length > 0) {
      const ids = candidates
        .map((ticket) => normalizeString(ticket?.id))
        .filter(Boolean);

      if (ids.length > 0) {
        const { error: deleteError, count } = await supabase
          .from("tickets")
          .delete({ count: "exact" })
          .in("id", ids);

        if (deleteError) {
          throw new Error(deleteError.message || "Failed to purge stale tickets");
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

    return buildRouteJson(
      {
        ok: true,
        dryRun,
        scanned: rows.length,
        removed,
        olderThanMinutes,
        requestedBy,
        effectiveRequestedBy: actorId,
        candidates: candidates.map((ticket) => summarizeCandidate(ticket)),
      },
      200,
      refreshedTokens
    );
  } catch (error) {
    const message = toErrorMessage(error);

    return buildRouteJson(
      {
        ok: false,
        error: message,
      },
      message === "Unauthorized" ? 401 : 500,
      refreshedTokens
    );
  }
}

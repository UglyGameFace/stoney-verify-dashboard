import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { requireStaffSessionForRoute, applyAuthCookies } from "@/lib/auth-server";
import { getSelectedGuildId } from "@/lib/guild-selection";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RefreshedTokens = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
} | null;

type JsonRecord = Record<string, unknown>;

type SessionLike = {
  user?: {
    discord_id?: string | null;
    id?: string | null;
    user_id?: string | null;
    username?: string | null;
    name?: string | null;
  } | null;
  discordUser?: {
    id?: string | null;
    username?: string | null;
  } | null;
};

function normalizeString(value: unknown): string {
  return String(value || "").trim();
}

function normalizeBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  const clean = normalizeString(value).toLowerCase();
  return clean === "true" || clean === "1" || clean === "yes" || clean === "on";
}

function safeObject<T extends object = JsonRecord>(value: unknown): T {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as T) : ({} as T);
}

function buildJsonResponse(payload: Record<string, unknown>, status = 200, refreshedTokens: RefreshedTokens = null) {
  const response = NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" },
  });
  applyAuthCookies(response, refreshedTokens);
  return response;
}

async function parseRequestBody(request: Request): Promise<JsonRecord> {
  try {
    return safeObject<JsonRecord>(await request.json());
  } catch {
    return {};
  }
}

function getActorIdentity(session: SessionLike | null | undefined) {
  return {
    actorId:
      session?.user?.discord_id ||
      session?.user?.id ||
      session?.user?.user_id ||
      session?.discordUser?.id ||
      null,
    actorName:
      session?.user?.username ||
      session?.user?.name ||
      session?.discordUser?.username ||
      "Dashboard Staff",
  };
}

export async function POST(request: Request) {
  try {
    const { session, refreshedTokens } = await requireStaffSessionForRoute();
    const typedSession = session as SessionLike;
    const guildId = normalizeString(getSelectedGuildId());

    if (!guildId) {
      return buildJsonResponse({ error: "Select a server before resetting categories.", needsServerSelection: true }, 428, refreshedTokens);
    }

    const body = await parseRequestBody(request);
    const confirmText = normalizeString(body.confirmText);
    const understandsSeverity = normalizeBoolean(body.understandsSeverity);
    const resetLinkedTickets = normalizeBoolean(body.resetLinkedTickets);

    if (confirmText !== "RESET CATEGORIES") {
      return buildJsonResponse({ error: "Type RESET CATEGORIES to confirm this destructive action." }, 400, refreshedTokens);
    }

    if (!understandsSeverity) {
      return buildJsonResponse({ error: "Confirm that you understand this removes all dashboard category routing for the selected server." }, 400, refreshedTokens);
    }

    const supabase = createServerSupabase();
    const { actorId, actorName } = getActorIdentity(typedSession);

    const { count: categoryCount, error: countError } = await supabase
      .from("ticket_categories")
      .select("id", { count: "exact", head: true })
      .eq("guild_id", guildId);

    if (countError) return buildJsonResponse({ error: countError.message, selectedGuildId: guildId }, 500, refreshedTokens);

    const { count: linkedTicketCount, error: linkedCountError } = await supabase
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("guild_id", guildId)
      .not("category_id", "is", null);

    if (linkedCountError) return buildJsonResponse({ error: linkedCountError.message, selectedGuildId: guildId }, 500, refreshedTokens);

    if (Number(linkedTicketCount || 0) > 0 && !resetLinkedTickets) {
      return buildJsonResponse(
        {
          error: "Some tickets are linked to dashboard categories. Check the acknowledgement box to clear category links before reset.",
          selectedGuildId: guildId,
          linkedTicketCount: Number(linkedTicketCount || 0),
        },
        409,
        refreshedTokens
      );
    }

    if (resetLinkedTickets) {
      const { error: ticketUpdateError } = await supabase
        .from("tickets")
        .update({
          category_id: null,
          matched_category_id: null,
          matched_category_name: null,
          matched_category_slug: null,
          category_override: false,
        })
        .eq("guild_id", guildId);

      if (ticketUpdateError) return buildJsonResponse({ error: ticketUpdateError.message, selectedGuildId: guildId }, 500, refreshedTokens);
    }

    const { error: deleteError } = await supabase
      .from("ticket_categories")
      .delete()
      .eq("guild_id", guildId);

    if (deleteError) return buildJsonResponse({ error: deleteError.message, selectedGuildId: guildId }, 500, refreshedTokens);

    return buildJsonResponse(
      {
        ok: true,
        selectedGuildId: guildId,
        deletedCategoryCount: Number(categoryCount || 0),
        clearedTicketCategoryLinks: resetLinkedTickets ? Number(linkedTicketCount || 0) : 0,
        audit: {
          action: "categories_reset_all",
          actorId,
          actorName,
        },
      },
      200,
      refreshedTokens
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    return buildJsonResponse({ error: message }, message === "Unauthorized" ? 401 : 400);
  }
}

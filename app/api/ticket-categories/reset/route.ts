import { createServerSupabase } from "@/lib/supabase-server";
import { requireDashboardStaffSession, dashboardAuthJson, dashboardAuthErrorJson } from "@/lib/dashboard-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type JsonRecord = Record<string, unknown>;

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

async function parseRequestBody(request: Request): Promise<JsonRecord> {
  try {
    return safeObject<JsonRecord>(await request.json());
  } catch {
    return {};
  }
}

export async function POST(request: Request) {
  let session = null;

  try {
    session = await requireDashboardStaffSession();
    const guildId = normalizeString(session.selectedGuildId);

    if (!guildId) {
      return dashboardAuthJson({ error: "Select a server before resetting categories.", error_code: "selected_server_required", needsServerSelection: true }, 428, session);
    }

    const body = await parseRequestBody(request);
    const confirmText = normalizeString(body.confirmText);
    const understandsSeverity = normalizeBoolean(body.understandsSeverity);
    const resetLinkedTickets = normalizeBoolean(body.resetLinkedTickets);

    if (confirmText !== "RESET CATEGORIES") {
      return dashboardAuthJson({ error: "Type RESET CATEGORIES to confirm this destructive action.", error_code: "invalid_request" }, 400, session);
    }

    if (!understandsSeverity) {
      return dashboardAuthJson({ error: "Confirm that you understand this removes all dashboard category routing for the selected server.", error_code: "invalid_request" }, 400, session);
    }

    const supabase = createServerSupabase();
    const actorId = session.user.discord_id;
    const actorName = session.user.username || session.discordUser.username || "Dashboard Staff";

    const { count: categoryCount, error: countError } = await supabase
      .from("ticket_categories")
      .select("id", { count: "exact", head: true })
      .eq("guild_id", guildId);

    if (countError) {
      return dashboardAuthJson({ error: countError.message, selectedGuildId: guildId }, 500, session);
    }

    const { count: linkedTicketCount, error: linkedCountError } = await supabase
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("guild_id", guildId)
      .not("category_id", "is", null);

    if (linkedCountError) {
      return dashboardAuthJson({ error: linkedCountError.message, selectedGuildId: guildId }, 500, session);
    }

    if (Number(linkedTicketCount || 0) > 0 && !resetLinkedTickets) {
      return dashboardAuthJson(
        {
          error: "Some tickets are linked to dashboard categories. Check the acknowledgement box to clear category links before reset.",
          error_code: "invalid_request",
          selectedGuildId: guildId,
          linkedTicketCount: Number(linkedTicketCount || 0),
        },
        409,
        session
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

      if (ticketUpdateError) {
        return dashboardAuthJson({ error: ticketUpdateError.message, selectedGuildId: guildId }, 500, session);
      }
    }

    const { error: deleteError } = await supabase
      .from("ticket_categories")
      .delete()
      .eq("guild_id", guildId);

    if (deleteError) {
      return dashboardAuthJson({ error: deleteError.message, selectedGuildId: guildId }, 500, session);
    }

    return dashboardAuthJson(
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
      session
    );
  } catch (error) {
    return dashboardAuthErrorJson(error, session, 400);
  }
}

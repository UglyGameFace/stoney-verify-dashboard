import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { requireStaffSessionForRoute, applyAuthCookies } from "@/lib/auth-server";
import { getSelectedGuildId } from "@/lib/guild-selection";

function normalizeString(value) {
  return String(value || "").trim();
}

function slugify(value) {
  return normalizeString(value)
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizeKeywords(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => normalizeString(item)).filter(Boolean))];
  }

  return [
    ...new Set(
      normalizeString(value)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    ),
  ];
}

function normalizeIntakeType(value) {
  const allowed = new Set([
    "general",
    "verification",
    "appeal",
    "report",
    "partnership",
    "question",
    "custom",
  ]);

  const clean = normalizeString(value).toLowerCase();
  return allowed.has(clean) ? clean : "general";
}

function parseSortOrder(value) {
  if (value === "" || value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeBoolean(value) {
  if (typeof value === "boolean") return value;
  const clean = normalizeString(value).toLowerCase();
  return clean === "true" || clean === "1" || clean === "yes" || clean === "on";
}

function selectedGuildId() {
  return normalizeString(getSelectedGuildId());
}

function buildJsonResponse(payload, status = 200, refreshedTokens = null) {
  const response = NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  });
  applyAuthCookies(response, refreshedTokens);
  return response;
}

function buildErrorResponse(message, status = 500, refreshedTokens = null, extra = {}) {
  return buildJsonResponse({ error: message, ...extra }, status, refreshedTokens);
}

function requireSelectedGuild(refreshedTokens = null) {
  const guildId = selectedGuildId();
  if (guildId) return guildId;
  return buildErrorResponse(
    "Select a server before managing ticket categories.",
    428,
    refreshedTokens,
    { needsServerSelection: true }
  );
}

function buildCategoryPatch(body) {
  const name = normalizeString(body?.name);
  const slug = slugify(body?.slug || name);

  if (!name) throw new Error("Category name is required.");
  if (!slug) throw new Error("Category slug is required.");

  return {
    name,
    slug,
    color: normalizeString(body?.color) || "#45d483",
    description: normalizeString(body?.description),
    intake_type: normalizeIntakeType(body?.intake_type),
    match_keywords: normalizeKeywords(body?.match_keywords),
    button_label: normalizeString(body?.button_label),
    sort_order: parseSortOrder(body?.sort_order),
    is_default: normalizeBoolean(body?.is_default),
  };
}

async function clearOtherDefaults(supabase, guildId, excludeId = null) {
  let query = supabase
    .from("ticket_categories")
    .update({ is_default: false })
    .eq("guild_id", guildId)
    .eq("is_default", true);

  if (excludeId) query = query.neq("id", excludeId);

  const { error } = await query;
  if (error) throw new Error(error.message);
}

async function getCategory(supabase, guildId, categoryId) {
  const { data, error } = await supabase
    .from("ticket_categories")
    .select("*")
    .eq("id", categoryId)
    .eq("guild_id", guildId)
    .single();

  if (error || !data) return null;
  return data;
}

export async function PATCH(request, { params }) {
  let refreshedTokens = null;
  try {
    const auth = await requireStaffSessionForRoute();
    refreshedTokens = auth?.refreshedTokens || null;
    const scopedGuild = requireSelectedGuild(refreshedTokens);
    if (typeof scopedGuild !== "string") return scopedGuild;
    const guildId = scopedGuild;
    const body = await request.json();
    const supabase = createServerSupabase();
    const categoryId = normalizeString(params?.id);

    if (!categoryId) {
      return buildErrorResponse("Missing category id.", 400, refreshedTokens, {
        selectedGuildId: guildId,
      });
    }

    const existing = await getCategory(supabase, guildId, categoryId);
    if (!existing) {
      return buildErrorResponse("Category not found.", 404, refreshedTokens, {
        selectedGuildId: guildId,
      });
    }

    const payload = buildCategoryPatch(body);

    if (payload.is_default) {
      await clearOtherDefaults(supabase, guildId, categoryId);
    }

    const { data, error } = await supabase
      .from("ticket_categories")
      .update(payload)
      .eq("id", categoryId)
      .eq("guild_id", guildId)
      .select("*")
      .single();

    if (error) {
      return buildErrorResponse(error.message, 500, refreshedTokens, {
        selectedGuildId: guildId,
      });
    }

    return buildJsonResponse({ ok: true, selectedGuildId: guildId, category: data }, 200, refreshedTokens);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    const status = message === "Unauthorized" ? 401 : 400;
    return buildErrorResponse(message, status, refreshedTokens);
  }
}

export async function DELETE(_request, { params }) {
  let refreshedTokens = null;
  try {
    const auth = await requireStaffSessionForRoute();
    refreshedTokens = auth?.refreshedTokens || null;
    const scopedGuild = requireSelectedGuild(refreshedTokens);
    if (typeof scopedGuild !== "string") return scopedGuild;
    const guildId = scopedGuild;
    const supabase = createServerSupabase();
    const categoryId = normalizeString(params?.id);

    if (!categoryId) {
      return buildErrorResponse("Missing category id.", 400, refreshedTokens, {
        selectedGuildId: guildId,
      });
    }

    const existing = await getCategory(supabase, guildId, categoryId);
    if (!existing) {
      return buildErrorResponse("Category not found.", 404, refreshedTokens, {
        selectedGuildId: guildId,
      });
    }

    if (existing.is_default) {
      return buildErrorResponse(
        "You cannot delete the default category until another default is set.",
        409,
        refreshedTokens,
        { selectedGuildId: guildId }
      );
    }

    const { data: linkedTickets, error: linkedError } = await supabase
      .from("tickets")
      .select("id,title,status,category_id,matched_category_id")
      .eq("guild_id", guildId)
      .or(`category_id.eq.${categoryId},matched_category_id.eq.${categoryId}`)
      .limit(20);

    if (linkedError) {
      return buildErrorResponse(linkedError.message, 500, refreshedTokens, {
        selectedGuildId: guildId,
      });
    }

    if (Array.isArray(linkedTickets) && linkedTickets.length > 0) {
      return buildJsonResponse(
        {
          error: "This category is still linked to tickets. Reassign those tickets before deleting it.",
          selectedGuildId: guildId,
          linkedTickets: linkedTickets.map((ticket) => ({
            id: ticket?.id || null,
            title: ticket?.title || "Untitled",
            status: ticket?.status || "unknown",
          })),
        },
        409,
        refreshedTokens
      );
    }

    const { error } = await supabase
      .from("ticket_categories")
      .delete()
      .eq("id", categoryId)
      .eq("guild_id", guildId);

    if (error) {
      return buildErrorResponse(error.message, 500, refreshedTokens, {
        selectedGuildId: guildId,
      });
    }

    return buildJsonResponse({ ok: true, selectedGuildId: guildId, deletedId: categoryId }, 200, refreshedTokens);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    const status = message === "Unauthorized" ? 401 : 400;
    return buildErrorResponse(message, status, refreshedTokens);
  }
}

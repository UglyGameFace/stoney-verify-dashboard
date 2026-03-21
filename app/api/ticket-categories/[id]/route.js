import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { requireStaffSessionForRoute, applyAuthCookies } from "@/lib/auth-server";
import { env } from "@/lib/env";

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

function buildCategoryPatch(body) {
  const name = normalizeString(body?.name);
  const slug = slugify(body?.slug || name);

  if (!name) {
    throw new Error("Category name is required.");
  }

  if (!slug) {
    throw new Error("Category slug is required.");
  }

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

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { error } = await query;
  if (error) {
    throw new Error(error.message);
  }
}

export async function PATCH(request, { params }) {
  try {
    const { refreshedTokens } = await requireStaffSessionForRoute();
    const body = await request.json();
    const supabase = createServerSupabase();
    const guildId = env.guildId;
    const categoryId = params?.id;

    if (!guildId) {
      return NextResponse.json({ error: "Missing guild id." }, { status: 500 });
    }

    if (!categoryId) {
      return NextResponse.json({ error: "Missing category id." }, { status: 400 });
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
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const response = NextResponse.json({ category: data });
    applyAuthCookies(response, refreshedTokens);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { refreshedTokens } = await requireStaffSessionForRoute();
    const supabase = createServerSupabase();
    const guildId = env.guildId;
    const categoryId = params?.id;

    if (!guildId) {
      return NextResponse.json({ error: "Missing guild id." }, { status: 500 });
    }

    if (!categoryId) {
      return NextResponse.json({ error: "Missing category id." }, { status: 400 });
    }

    const { error } = await supabase
      .from("ticket_categories")
      .delete()
      .eq("id", categoryId)
      .eq("guild_id", guildId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const response = NextResponse.json({ ok: true });
    applyAuthCookies(response, refreshedTokens);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

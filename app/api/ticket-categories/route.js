import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { requireStaffSessionForRoute, applyAuthCookies } from "@/lib/auth-server";
import { env } from "@/lib/env";

const PRESET_KEYWORDS = {
  verification: [
    "verification",
    "verify",
    "verification issue",
    "id verification",
    "secure upload",
    "verify in vc",
    "vc verify",
  ],
  appeal: [
    "appeal",
    "ban appeal",
    "timeout appeal",
    "unban",
    "unmute",
  ],
  report: [
    "report",
    "incident",
    "scam",
    "abuse",
    "harassment",
  ],
  partnership: [
    "partnership",
    "partner",
    "collab",
    "collaboration",
    "sponsor",
  ],
  question: [
    "question",
    "questions",
    "help question",
    "how to",
    "how do i",
  ],
  general: [
    "support",
    "help",
    "general support",
  ],
};

const COD_SERVICE_KEYWORDS = [
  "cod",
  "call of duty",
  "cod service",
  "cod services",
  "cod recovery",
  "recovery",
  "recoveries",
  "challenge lobby",
  "challenge lobbies",
  "modded lobby",
  "modded lobbies",
  "unlock all",
  "prestige",
  "rank unlock",
  "camo unlock",
  "account recovery",
  "old cod",
  "older cod",
  "legacy cod",
  "bo1",
  "bo2",
  "bo3",
  "black ops 1",
  "black ops 2",
  "black ops 3",
  "mw2",
  "mw3",
  "modern warfare 2",
  "modern warfare 3",
  "waw",
  "world at war",
  "bot lobby",
  "zombies rank",
];

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeText(value) {
  return normalizeString(value)
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

  return [...new Set(
    normalizeString(value)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  )];
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

function containsAny(haystack, needles) {
  const cleanHaystack = normalizeText(haystack);
  if (!cleanHaystack) return false;
  return needles.some((needle) => {
    const cleanNeedle = normalizeText(needle);
    return cleanNeedle ? cleanHaystack.includes(cleanNeedle) : false;
  });
}

function buildPresetKeywords(payload) {
  const keywords = new Set();
  const intakeType = normalizeIntakeType(payload?.intake_type);
  const haystack = [
    payload?.name,
    payload?.slug,
    payload?.description,
    payload?.button_label,
    intakeType,
    ...(Array.isArray(payload?.match_keywords) ? payload.match_keywords : []),
  ].join(" ");

  for (const item of PRESET_KEYWORDS[intakeType] || []) {
    keywords.add(normalizeString(item));
  }

  if (containsAny(haystack, COD_SERVICE_KEYWORDS)) {
    for (const item of COD_SERVICE_KEYWORDS) {
      keywords.add(normalizeString(item));
    }
  }

  return [...keywords].filter(Boolean);
}

function mergeKeywords(...groups) {
  const out = [];
  for (const group of groups) {
    const items = Array.isArray(group) ? group : [];
    for (const item of items) {
      const clean = normalizeString(item);
      if (clean && !out.some((existing) => existing.toLowerCase() === clean.toLowerCase())) {
        out.push(clean);
      }
    }
  }
  return out;
}

function buildCategoryPayload(body, guildId) {
  const name = normalizeString(body?.name);
  const slug = slugify(body?.slug || name);

  if (!name) {
    throw new Error("Category name is required.");
  }

  if (!slug) {
    throw new Error("Category slug is required.");
  }

  const basePayload = {
    guild_id: guildId,
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

  return {
    ...basePayload,
    match_keywords: mergeKeywords(
      basePayload.match_keywords,
      buildPresetKeywords(basePayload)
    ),
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

export async function GET() {
  const supabase = createServerSupabase();

  const { data, error } = await supabase
    .from("ticket_categories")
    .select("*")
    .eq("guild_id", env.guildId)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ categories: data || [] });
}

export async function POST(request) {
  try {
    const { refreshedTokens } = await requireStaffSessionForRoute();
    const body = await request.json();
    const supabase = createServerSupabase();
    const guildId = env.guildId;

    if (!guildId) {
      return NextResponse.json({ error: "Missing guild id." }, { status: 500 });
    }

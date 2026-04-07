import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import {
  requireStaffSessionForRoute,
  applyAuthCookies,
} from "@/lib/auth-server";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RefreshedTokens = unknown;
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

type TicketCategoryRow = {
  id?: string | null;
  guild_id?: string | null;
  name?: string | null;
  slug?: string | null;
  color?: string | null;
  description?: string | null;
  intake_type?: string | null;
  match_keywords?: string[] | null;
  button_label?: string | null;
  sort_order?: number | null;
  is_default?: boolean | null;
  created_at?: string | null;
};

type TicketRow = {
  id?: string | null;
  title?: string | null;
  status?: string | null;
  category?: string | null;
  category_id?: string | null;
  matched_category_id?: string | null;
  matched_category_name?: string | null;
  matched_category_slug?: string | null;
  category_override?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

const PRESET_KEYWORDS: Record<string, string[]> = {
  verification: [
    "verification",
    "verify",
    "verification issue",
    "id verification",
    "secure upload",
    "verify in vc",
    "vc verify",
    "face check",
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
    "threat",
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
    "assistance",
  ],
  custom: [],
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
  "camo service",
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

const ALLOWED_INTAKE_TYPES = new Set([
  "general",
  "verification",
  "appeal",
  "report",
  "partnership",
  "question",
  "custom",
]);

function normalizeString(value: unknown): string {
  return String(value || "").trim();
}

function normalizeText(value: unknown): string {
  return normalizeString(value)
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLower(value: unknown): string {
  return normalizeString(value).toLowerCase();
}

function normalizeBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  const clean = normalizeString(value).toLowerCase();
  return clean === "true" || clean === "1" || clean === "yes" || clean === "on";
}

function normalizeNumber(value: unknown, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function safeArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function safeObject<T extends object = JsonRecord>(value: unknown): T {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as T)
    : ({} as T);
}

function slugify(value: unknown): string {
  return normalizeString(value)
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizeKeywords(value: unknown): string[] {
  if (Array.isArray(value)) {
    return [
      ...new Set(
        value
          .map((item) => normalizeString(item))
          .filter(Boolean)
      ),
    ];
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

function normalizeIntakeType(value: unknown): string {
  const clean = normalizeLower(value);
  return ALLOWED_INTAKE_TYPES.has(clean) ? clean : "general";
}

function parseSortOrder(value: unknown): number | null {
  if (value === "" || value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function containsAny(haystack: unknown, needles: string[]): boolean {
  const cleanHaystack = normalizeText(haystack);
  if (!cleanHaystack) return false;

  return needles.some((needle) => {
    const cleanNeedle = normalizeText(needle);
    return cleanNeedle ? cleanHaystack.includes(cleanNeedle) : false;
  });
}

function mergeKeywords(...groups: unknown[]): string[] {
  const out: string[] = [];

  for (const group of groups) {
    const items = Array.isArray(group) ? group : [];
    for (const item of items) {
      const clean = normalizeString(item);
      if (!clean) continue;

      if (!out.some((existing) => existing.toLowerCase() === clean.toLowerCase())) {
        out.push(clean);
      }
    }
  }

  return out;
}

function buildPresetKeywords(payload: Partial<TicketCategoryRow>): string[] {
  const keywords = new Set<string>();
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

function buildCategoryPayload(
  body: JsonRecord,
  guildId: string,
  existing?: TicketCategoryRow | null
): TicketCategoryRow {
  const existingRow = existing || {};
  const name = normalizeString(body?.name ?? existingRow?.name);
  const slug = slugify(body?.slug ?? existingRow?.slug ?? name);

  if (!name) {
    throw new Error("Category name is required.");
  }

  if (!slug) {
    throw new Error("Category slug is required.");
  }

  const basePayload: TicketCategoryRow = {
    guild_id: guildId,
    name,
    slug,
    color: normalizeString(body?.color ?? existingRow?.color) || "#45d483",
    description: normalizeString(body?.description ?? existingRow?.description),
    intake_type: normalizeIntakeType(body?.intake_type ?? existingRow?.intake_type),
    match_keywords: normalizeKeywords(
      body?.match_keywords ?? existingRow?.match_keywords ?? []
    ),
    button_label: normalizeString(body?.button_label ?? existingRow?.button_label),
    sort_order: parseSortOrder(body?.sort_order ?? existingRow?.sort_order),
    is_default: normalizeBoolean(body?.is_default ?? existingRow?.is_default ?? false),
  };

  return {
    ...basePayload,
    match_keywords: mergeKeywords(
      basePayload.match_keywords,
      buildPresetKeywords(basePayload)
    ),
  };
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

function buildJsonResponse(
  payload: Record<string, unknown>,
  status = 200,
  refreshedTokens: RefreshedTokens | null = null
) {
  const response = NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  });

  applyAuthCookies(response, refreshedTokens);
  return response;
}

function buildErrorResponse(
  message: string,
  status = 400,
  refreshedTokens: RefreshedTokens | null = null
) {
  return buildJsonResponse({ error: message }, status, refreshedTokens);
}

async function parseRequestBody(request: Request): Promise<JsonRecord> {
  try {
    const body = await request.json();
    return safeObject<JsonRecord>(body);
  } catch {
    return {};
  }
}

async function clearOtherDefaults(
  supabase: ReturnType<typeof createServerSupabase>,
  guildId: string,
  excludeId: string | null = null
) {
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

async function getCategoryById(
  supabase: ReturnType<typeof createServerSupabase>,
  guildId: string,
  id: string
): Promise<TicketCategoryRow | null> {
  const { data, error } = await supabase
    .from("ticket_categories")
    .select("*")
    .eq("guild_id", guildId)
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return data as TicketCategoryRow;
}

async function getCategoryBySlug(
  supabase: ReturnType<typeof createServerSupabase>,
  guildId: string,
  slug: string
): Promise<TicketCategoryRow | null> {
  const { data, error } = await supabase
    .from("ticket_categories")
    .select("*")
    .eq("guild_id", guildId)
    .eq("slug", slug)
    .single();

  if (error || !data) return null;
  return data as TicketCategoryRow;
}

async function assertSlugAvailable(
  supabase: ReturnType<typeof createServerSupabase>,
  guildId: string,
  slug: string,
  excludeId: string | null = null
) {
  const existing = await getCategoryBySlug(supabase, guildId, slug);
  if (!existing) return;

  if (excludeId && normalizeString(existing.id) === excludeId) return;

  throw new Error("That category slug is already in use.");
}

function buildCategoryUsage(
  categories: TicketCategoryRow[],
  tickets: TicketRow[]
) {
  const byId = new Map<
    string,
    {
      total: number;
      open: number;
      claimed: number;
      closed: number;
      deleted: number;
      manualOverrideCount: number;
      latestTicketAt: string | null;
      linkedTicketIds: string[];
    }
  >();

  for (const category of categories) {
    const id = normalizeString(category.id);
    if (!id) continue;

    byId.set(id, {
      total: 0,
      open: 0,
      claimed: 0,
      closed: 0,
      deleted: 0,
      manualOverrideCount: 0,
      latestTicketAt: null,
      linkedTicketIds: [],
    });
  }

  for (const ticket of tickets) {
    const linkedIds = [
      normalizeString(ticket.category_id),
      normalizeString(ticket.matched_category_id),
    ].filter(Boolean);

    for (const categoryId of linkedIds) {
      const stats = byId.get(categoryId);
      if (!stats) continue;

      stats.total += 1;

      const status = normalizeLower(ticket.status);
      if (status === "open") stats.open += 1;
      else if (status === "claimed") stats.claimed += 1;
      else if (status === "closed") stats.closed += 1;
      else if (status === "deleted") stats.deleted += 1;

      if (ticket.category_override === true) {
        stats.manualOverrideCount += 1;
      }

      const latestAt =
        normalizeString(ticket.updated_at) ||
        normalizeString(ticket.created_at) ||
        null;

      if (
        latestAt &&
        (!stats.latestTicketAt ||
          new Date(latestAt).getTime() > new Date(stats.latestTicketAt).getTime())
      ) {
        stats.latestTicketAt = latestAt;
      }

      const ticketId = normalizeString(ticket.id);
      if (ticketId && !stats.linkedTicketIds.includes(ticketId)) {
        stats.linkedTicketIds.push(ticketId);
      }
    }
  }

  return byId;
}

async function fetchCategoryTickets(
  supabase: ReturnType<typeof createServerSupabase>,
  guildId: string
): Promise<TicketRow[]> {
  const { data, error } = await supabase
    .from("tickets")
    .select(
      "id,title,status,category,category_id,matched_category_id,matched_category_name,matched_category_slug,category_override,created_at,updated_at"
    )
    .eq("guild_id", guildId);

  if (error) {
    throw new Error(error.message);
  }

  return safeArray<TicketRow>(data || []);
}

function enrichCategories(
  categories: TicketCategoryRow[],
  tickets: TicketRow[]
) {
  const usage = buildCategoryUsage(categories, tickets);

  return categories
    .map((category) => {
      const id = normalizeString(category.id);
      const stats = usage.get(id);

      return {
        ...category,
        keyword_count: Array.isArray(category.match_keywords)
          ? category.match_keywords.length
          : 0,
        usage: {
          total: stats?.total || 0,
          open: stats?.open || 0,
          claimed: stats?.claimed || 0,
          closed: stats?.closed || 0,
          deleted: stats?.deleted || 0,
          manualOverrideCount: stats?.manualOverrideCount || 0,
          latestTicketAt: stats?.latestTicketAt || null,
        },
      };
    })
    .sort((a, b) => {
      const sortA = a.sort_order ?? 9999;
      const sortB = b.sort_order ?? 9999;
      if (sortA !== sortB) return sortA - sortB;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
}

export async function GET() {
  try {
    const supabase = createServerSupabase();
    const guildId = normalizeString(env.guildId);

    if (!guildId) {
      return buildErrorResponse("Missing guild id.", 500);
    }

    const [categoriesRes, tickets] = await Promise.all([
      supabase
        .from("ticket_categories")
        .select("*")
        .eq("guild_id", guildId)
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("name", { ascending: true }),
      fetchCategoryTickets(supabase, guildId),
    ]);

    if (categoriesRes.error) {
      return buildErrorResponse(categoriesRes.error.message, 500);
    }

    const categories = enrichCategories(
      safeArray<TicketCategoryRow>(categoriesRes.data || []),
      tickets
    );

    const defaultCategory =
      categories.find((row) => row.is_default) || null;

    return buildJsonResponse({
      categories,
      defaultCategoryId: defaultCategory?.id || null,
      presets: PRESET_KEYWORDS,
      codServiceKeywords: COD_SERVICE_KEYWORDS,
    });
  } catch (error) {
    return buildErrorResponse(
      error instanceof Error ? error.message : "Failed to load categories.",
      500
    );
  }
}

export async function POST(request: Request) {
  try {
    const { session, refreshedTokens } = await requireStaffSessionForRoute();
    const typedSession = session as SessionLike;
    const body = await parseRequestBody(request);
    const supabase = createServerSupabase();
    const guildId = normalizeString(env.guildId);
    const { actorId, actorName } = getActorIdentity(typedSession);

    if (!guildId) {
      return buildErrorResponse("Missing guild id.", 500, refreshedTokens);
    }

    const payload = buildCategoryPayload(body, guildId);

    await assertSlugAvailable(supabase, guildId, normalizeString(payload.slug));

    if (payload.is_default) {
      await clearOtherDefaults(supabase, guildId);
    }

    const { data, error } = await supabase
      .from("ticket_categories")
      .insert({
        ...payload,
        created_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (error) {
      return buildErrorResponse(error.message, 500, refreshedTokens);
    }

    return buildJsonResponse(
      {
        ok: true,
        category: data,
        audit: {
          action: "category_created",
          actorId,
          actorName,
        },
      },
      200,
      refreshedTokens
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    return buildErrorResponse(
      message,
      message === "Unauthorized" ? 401 : 400
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { session, refreshedTokens } = await requireStaffSessionForRoute();
    const typedSession = session as SessionLike;
    const body = await parseRequestBody(request);
    const supabase = createServerSupabase();
    const guildId = normalizeString(env.guildId);
    const { actorId, actorName } = getActorIdentity(typedSession);

    if (!guildId) {
      return buildErrorResponse("Missing guild id.", 500, refreshedTokens);
    }

    const categoryId = normalizeString(body?.id);
    if (!categoryId) {
      return buildErrorResponse("Category id is required.", 400, refreshedTokens);
    }

    const existing = await getCategoryById(supabase, guildId, categoryId);
    if (!existing) {
      return buildErrorResponse("Category not found.", 404, refreshedTokens);
    }

    const payload = buildCategoryPayload(body, guildId, existing);

    await assertSlugAvailable(
      supabase,
      guildId,
      normalizeString(payload.slug),
      categoryId
    );

    if (payload.is_default) {
      await clearOtherDefaults(supabase, guildId, categoryId);
    }

    const { data, error } = await supabase
      .from("ticket_categories")
      .update(payload)
      .eq("guild_id", guildId)
      .eq("id", categoryId)
      .select("*")
      .single();

    if (error) {
      return buildErrorResponse(error.message, 500, refreshedTokens);
    }

    return buildJsonResponse(
      {
        ok: true,
        category: data,
        audit: {
          action: "category_updated",
          actorId,
          actorName,
          previous_slug: existing.slug || null,
          next_slug: payload.slug || null,
        },
      },
      200,
      refreshedTokens
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    return buildErrorResponse(
      message,
      message === "Unauthorized" ? 401 : 400
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { session, refreshedTokens } = await requireStaffSessionForRoute();
    const typedSession = session as SessionLike;
    const supabase = createServerSupabase();
    const guildId = normalizeString(env.guildId);
    const { actorId, actorName } = getActorIdentity(typedSession);
    const url = new URL(request.url);
    const body = await parseRequestBody(request);

    if (!guildId) {
      return buildErrorResponse("Missing guild id.", 500, refreshedTokens);
    }

    const categoryId =
      normalizeString(url.searchParams.get("id")) ||
      normalizeString(body?.id);

    if (!categoryId) {
      return buildErrorResponse("Category id is required.", 400, refreshedTokens);
    }

    const existing = await getCategoryById(supabase, guildId, categoryId);
    if (!existing) {
      return buildErrorResponse("Category not found.", 404, refreshedTokens);
    }

    if (existing.is_default) {
      return buildErrorResponse(
        "You cannot delete the default category until another default is set.",
        409,
        refreshedTokens
      );
    }

    const { data: linkedTickets, error: ticketError } = await supabase
      .from("tickets")
      .select("id,title,status,category_id,matched_category_id")
      .eq("guild_id", guildId)
      .or(`category_id.eq.${categoryId},matched_category_id.eq.${categoryId}`)
      .limit(20);

    if (ticketError) {
      return buildErrorResponse(ticketError.message, 500, refreshedTokens);
    }

    const linked = safeArray<TicketRow>(linkedTickets || []);
    if (linked.length > 0) {
      return buildJsonResponse(
        {
          error:
            "This category is still linked to tickets. Reassign those tickets before deleting it.",
          linkedTickets: linked.map((ticket) => ({
            id: ticket.id || null,
            title: ticket.title || "Untitled",
            status: ticket.status || "unknown",
          })),
        },
        409,
        refreshedTokens
      );
    }

    const { error } = await supabase
      .from("ticket_categories")
      .delete()
      .eq("guild_id", guildId)
      .eq("id", categoryId);

    if (error) {
      return buildErrorResponse(error.message, 500, refreshedTokens);
    }

    return buildJsonResponse(
      {
        ok: true,
        deletedId: categoryId,
        audit: {
          action: "category_deleted",
          actorId,
          actorName,
          deleted_slug: existing.slug || null,
          deleted_name: existing.name || null,
        },
      },
      200,
      refreshedTokens
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    return buildErrorResponse(
      message,
      message === "Unauthorized" ? 401 : 400
    );
  }
}

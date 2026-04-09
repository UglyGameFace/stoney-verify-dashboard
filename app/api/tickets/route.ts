import { createServerSupabase } from "@/lib/supabase-server";
import { classifyTicket, suggestModerationAction } from "@/lib/moderation";
import { derivePriority } from "@/lib/priority";
import { enrichTicketWithMatchedCategory } from "@/lib/ticketCategoryMatching";
import { insertMemberEvent } from "@/lib/memberEventWrites";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type JsonRecord = Record<string, unknown>;

type TicketRow = {
  id?: string | null;
  guild_id?: string | null;
  user_id?: string | null;
  username?: string | null;
  title?: string | null;
  category?: string | null;
  raw_category?: string | null;
  matched_category_id?: string | null;
  matched_category_name?: string | null;
  matched_category_slug?: string | null;
  matched_intake_type?: string | null;
  matched_category_reason?: string | null;
  matched_category_score?: number | null;
  matched_category_keywords?: string[] | null;
  status?: string | null;
  priority?: string | null;
  initial_message?: string | null;
  ai_category_confidence?: number | null;
  mod_suggestion?: string | null;
  mod_suggestion_confidence?: number | null;
  mod_suggestion_reason?: string | null;
  mod_suggestion_mode?: string | null;
  flagged?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
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
};

type TicketMessageInsert = {
  ticket_id: string;
  author_id: string | null;
  author_name: string;
  content: string;
  message_type: string;
  attachments?: JsonRecord[];
  source?: string;
};

type AuditEventInsert = {
  title: string;
  description: string;
  event_type: string;
  related_id: string;
  metadata?: JsonRecord;
};

type ClassificationResult = {
  category?: string;
  confidence?: number;
  autoApplied?: boolean;
};

type ModerationSuggestion = {
  suggestion?: string;
  confidence?: number;
  reason?: string;
  mode?: string;
};

type TicketCreateBody = {
  guild_id?: string | null;
  user_id?: string | null;
  username?: string | null;
  title?: string | null;
  category?: string | null;
  message?: string | null;
  flagged?: boolean | null;
  source?: string | null;
  attachments?: JsonRecord[] | null;
};

function normalizeString(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeLower(value: unknown): string {
  return normalizeString(value).toLowerCase();
}

function normalizeNumber(value: unknown, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  const raw = normalizeLower(value);
  return raw === "true" || raw === "1" || raw === "yes" || raw === "on";
}

function safeObject<T extends object = JsonRecord>(value: unknown): T {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as T;
  }
  return {} as T;
}

function safeArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function normalizeStringArray(value: unknown): string[] {
  return safeArray(value)
    .map((item) => normalizeString(item))
    .filter(Boolean);
}

function parseInteger(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isMissingColumnError(error: unknown, column?: string): boolean {
  const text = String(
    (error as { message?: string })?.message ??
      (error as { details?: string })?.details ??
      error ??
      ""
  );

  if (!text) return false;
  if (!column) {
    return (
      text.includes("PGRST204") ||
      text.includes("Could not find the") ||
      text.includes("schema cache") ||
      text.includes("column")
    );
  }

  return (
    text.includes("PGRST204") &&
    text.includes("schema cache") &&
    text.includes(column)
  );
}

function buildJsonResponse(payload: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  });
}

function buildErrorResponse(message: string, status = 500): Response {
  return buildJsonResponse({ error: message }, status);
}

function mapTicket(row: TicketRow): TicketRow {
  return {
    ...row,
    id: row?.id || null,
    guild_id: row?.guild_id || null,
    user_id: row?.user_id || null,
    username: row?.username || "",
    title: row?.title || "",
    category: row?.category || null,
    raw_category: row?.raw_category || null,
    matched_category_id: row?.matched_category_id || null,
    matched_category_name: row?.matched_category_name || null,
    matched_category_slug: row?.matched_category_slug || null,
    matched_intake_type: row?.matched_intake_type || null,
    matched_category_reason: row?.matched_category_reason || null,
    matched_category_score:
      row?.matched_category_score == null
        ? null
        : normalizeNumber(row.matched_category_score, 0),
    matched_category_keywords: normalizeStringArray(row?.matched_category_keywords),
    status: row?.status || "open",
    priority: row?.priority || null,
    initial_message: row?.initial_message || "",
    ai_category_confidence:
      row?.ai_category_confidence == null
        ? null
        : normalizeNumber(row.ai_category_confidence, 0),
    mod_suggestion: row?.mod_suggestion || null,
    mod_suggestion_confidence:
      row?.mod_suggestion_confidence == null
        ? null
        : normalizeNumber(row.mod_suggestion_confidence, 0),
    mod_suggestion_reason: row?.mod_suggestion_reason || null,
    mod_suggestion_mode: row?.mod_suggestion_mode || null,
    flagged: Boolean(row?.flagged),
    created_at: row?.created_at || null,
    updated_at: row?.updated_at || null,
  };
}

async function parseBody(request: Request): Promise<TicketCreateBody> {
  try {
    return safeObject<TicketCreateBody>(await request.json());
  } catch {
    return {};
  }
}

function buildTicketTitle(
  explicitTitle: string,
  explicitCategory: string,
  classifiedCategory: string
): string {
  if (explicitTitle) return explicitTitle;

  const chosen = explicitCategory || classifiedCategory || "support";
  return chosen
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

async function fetchCategoriesForGuild(
  supabase: ReturnType<typeof createServerSupabase>,
  guildId: string
): Promise<TicketCategoryRow[]> {
  if (!guildId) return [];

  const { data } = await supabase
    .from("ticket_categories")
    .select("*")
    .eq("guild_id", guildId)
    .order("sort_order", { ascending: true });

  return safeArray<TicketCategoryRow>(data);
}

async function insertTicketWithFallbacks(
  supabase: ReturnType<typeof createServerSupabase>,
  payload: Record<string, unknown>
): Promise<{ data: TicketRow | null; error: { message?: string } | null }> {
  let result = await supabase.from("tickets").insert(payload).select("*").single();

  if (!result.error) {
    return {
      data: (result.data as TicketRow) || null,
      error: null,
    };
  }

  const strippedCategoryMatchPayload = { ...payload };
  delete strippedCategoryMatchPayload.raw_category;
  delete strippedCategoryMatchPayload.matched_category_id;
  delete strippedCategoryMatchPayload.matched_category_name;
  delete strippedCategoryMatchPayload.matched_category_slug;
  delete strippedCategoryMatchPayload.matched_intake_type;
  delete strippedCategoryMatchPayload.matched_category_reason;
  delete strippedCategoryMatchPayload.matched_category_score;
  delete strippedCategoryMatchPayload.matched_category_keywords;

  if (isMissingColumnError(result.error)) {
    result = await supabase
      .from("tickets")
      .insert(strippedCategoryMatchPayload)
      .select("*")
      .single();

    if (!result.error) {
      return {
        data: (result.data as TicketRow) || null,
        error: null,
      };
    }
  }

  const strippedAiPayload = { ...strippedCategoryMatchPayload };
  delete strippedAiPayload.ai_category_confidence;
  delete strippedAiPayload.mod_suggestion;
  delete strippedAiPayload.mod_suggestion_confidence;
  delete strippedAiPayload.mod_suggestion_reason;
  delete strippedAiPayload.mod_suggestion_mode;
  delete strippedAiPayload.flagged;

  if (isMissingColumnError(result.error)) {
    result = await supabase
      .from("tickets")
      .insert(strippedAiPayload)
      .select("*")
      .single();

    if (!result.error) {
      return {
        data: (result.data as TicketRow) || null,
        error: null,
      };
    }
  }

  return {
    data: null,
    error: result.error,
  };
}

export async function GET(request: Request) {
  try {
    const supabase = createServerSupabase();
    const { searchParams } = new URL(request.url);

    const guildId = normalizeString(searchParams.get("guild_id"));
    const status = normalizeLower(searchParams.get("status"));
    const userId = normalizeString(searchParams.get("user_id"));
    const includeClosed = normalizeBoolean(searchParams.get("include_closed"));
    const limit = Math.min(Math.max(parseInteger(searchParams.get("limit"), 200), 1), 500);

    let query = supabase
      .from("tickets")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (guildId) {
      query = query.eq("guild_id", guildId);
    }

    if (userId) {
      query = query.eq("user_id", userId);
    }

    if (status) {
      query = query.eq("status", status);
    } else if (!includeClosed) {
      query = query.neq("status", "closed").neq("status", "deleted");
    }

    const { data, error } = await query;

    if (error) {
      return buildErrorResponse(error.message || "Failed to load tickets.", 500);
    }

    const rawRows = safeArray<TicketRow>(data);
    const categories = guildId ? await fetchCategoriesForGuild(supabase, guildId) : [];

    const tickets = rawRows.map((row) => {
      const mapped = mapTicket(row);
      const enriched = categories.length
        ? (enrichTicketWithMatchedCategory(mapped, categories) as TicketRow)
        : mapped;

      return {
        ...mapped,
        ...safeObject<TicketRow>(enriched),
        priority:
          mapped.priority ||
          derivePriority({
            category:
              enriched?.matched_category_slug ||
              enriched?.matched_intake_type ||
              mapped.category,
            status: mapped.status || "open",
            created_at: mapped.created_at || new Date().toISOString(),
            flagged: Boolean(mapped.flagged),
          }),
      };
    });

    return buildJsonResponse({
      tickets,
      count: tickets.length,
    });
  } catch (error) {
    return buildErrorResponse(
      error instanceof Error ? error.message : "Failed to load tickets.",
      500
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await parseBody(request);
    const supabase = createServerSupabase();

    const guildId = normalizeString(body.guild_id);
    const userId = normalizeString(body.user_id);
    const username = normalizeString(body.username || body.user_id);
    const message = normalizeString(body.message);
    const explicitCategory = normalizeString(body.category);
    const explicitTitle = normalizeString(body.title);
    const source = normalizeString(body.source) || "dashboard";
    const attachments = safeArray<JsonRecord>(body.attachments);
    const flagged = normalizeBoolean(body.flagged);

    if (!guildId) {
      return buildErrorResponse("guild_id is required.", 400);
    }

    if (!userId) {
      return buildErrorResponse("user_id is required.", 400);
    }

    if (!message) {
      return buildErrorResponse("message is required.", 400);
    }

    const classification = classifyTicket(message) as ClassificationResult;
    const suggestion = suggestModerationAction(message) as ModerationSuggestion;
    const categories = await fetchCategoriesForGuild(supabase, guildId);

    const draftTicket: TicketRow = {
      guild_id: guildId,
      user_id: userId,
      username: username || userId,
      title: buildTicketTitle(
        explicitTitle,
        explicitCategory,
        normalizeString(classification?.category)
      ),
      category: explicitCategory || normalizeString(classification?.category) || "other",
      status: "open",
      initial_message: message,
      flagged,
      ai_category_confidence: normalizeNumber(classification?.confidence, 0),
      mod_suggestion: normalizeString(suggestion?.suggestion) || null,
      mod_suggestion_confidence: normalizeNumber(suggestion?.confidence, 0),
      mod_suggestion_reason: normalizeString(suggestion?.reason) || null,
      mod_suggestion_mode: normalizeString(suggestion?.mode) || null,
      created_at: new Date().toISOString(),
    };

    const enrichedDraft = categories.length
      ? (enrichTicketWithMatchedCategory(draftTicket, categories) as TicketRow)
      : draftTicket;

    const chosenCategory =
      explicitCategory ||
      normalizeString(enrichedDraft?.matched_category_slug) ||
      normalizeString(enrichedDraft?.matched_intake_type) ||
      normalizeString(classification?.category) ||
      "other";

    const createdAt = new Date().toISOString();

    const payload: Record<string, unknown> = {
      guild_id: guildId,
      user_id: userId,
      username: username || userId,
      title: buildTicketTitle(
        explicitTitle,
        chosenCategory,
        normalizeString(classification?.category)
      ),
      category: chosenCategory,
      status: "open",
      priority: derivePriority({
        category: chosenCategory,
        status: "open",
        created_at: createdAt,
        flagged,
      }),
      initial_message: message,
      flagged,
      ai_category_confidence: normalizeNumber(classification?.confidence, 0),
      mod_suggestion: normalizeString(suggestion?.suggestion) || null,
      mod_suggestion_confidence: normalizeNumber(suggestion?.confidence, 0),
      mod_suggestion_reason: normalizeString(suggestion?.reason) || null,
      mod_suggestion_mode: normalizeString(suggestion?.mode) || null,
      raw_category: explicitCategory || null,
      matched_category_id: enrichedDraft?.matched_category_id || null,
      matched_category_name: enrichedDraft?.matched_category_name || null,
      matched_category_slug: enrichedDraft?.matched_category_slug || null,
      matched_intake_type: enrichedDraft?.matched_intake_type || null,
      matched_category_reason: enrichedDraft?.matched_category_reason || null,
      matched_category_score:
        enrichedDraft?.matched_category_score == null
          ? null
          : normalizeNumber(enrichedDraft.matched_category_score, 0),
      matched_category_keywords: normalizeStringArray(
        enrichedDraft?.matched_category_keywords
      ),
    };

    const inserted = await insertTicketWithFallbacks(supabase, payload);

    if (inserted.error || !inserted.data) {
      return buildErrorResponse(
        inserted.error?.message || "Failed to create ticket.",
        500
      );
    }

    const createdTicket = mapTicket(inserted.data);

    const messageInsert: TicketMessageInsert = {
      ticket_id: String(createdTicket.id || ""),
      author_id: userId || null,
      author_name: username || userId,
      content: message,
      message_type: "user",
      attachments,
      source,
    };

    const auditInsert: AuditEventInsert = {
      title: "Ticket created",
      description: `New ${createdTicket.category || "support"} ticket for ${username || userId}`,
      event_type: "ticket_created",
      related_id: String(createdTicket.id || ""),
      metadata: {
        guild_id: guildId,
        user_id: userId,
        username: username || userId,
        category: createdTicket.category || null,
        matched_category_id: createdTicket.matched_category_id || null,
        matched_category_name: createdTicket.matched_category_name || null,
        matched_category_slug: createdTicket.matched_category_slug || null,
        priority: createdTicket.priority || null,
        source,
      },
    };

    await Promise.allSettled([
      supabase.from("ticket_messages").insert(messageInsert),
      supabase.from("audit_events").insert(auditInsert),
      insertMemberEvent(
        {
          guildId,
          userId,
          actorId: userId,
          actorName: username || userId,
          eventType: "ticket_created",
          title: "Ticket Created",
          reason: `Created ${createdTicket.category || "support"} ticket.`,
          metadata: {
            ticket_id: createdTicket.id || null,
            category: createdTicket.category || null,
            matched_category_id: createdTicket.matched_category_id || null,
            matched_category_name: createdTicket.matched_category_name || null,
            matched_category_slug: createdTicket.matched_category_slug || null,
            matched_intake_type: createdTicket.matched_intake_type || null,
            priority: createdTicket.priority || null,
            source,
            mod_suggestion: createdTicket.mod_suggestion || null,
            mod_suggestion_confidence:
              createdTicket.mod_suggestion_confidence ?? null,
          },
        },
        supabase
      ),
    ]);

    return buildJsonResponse({
      ticket: createdTicket,
      classification,
      suggestion,
    });
  } catch (error) {
    return buildErrorResponse(
      error instanceof Error ? error.message : "Failed to create ticket.",
      500
    );
  }
}

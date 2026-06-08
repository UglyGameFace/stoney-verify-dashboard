import { createServerSupabase } from "@/lib/supabase-server";
import {
  requireDashboardStaffSession,
  dashboardAuthJson,
  dashboardAuthErrorJson,
  type DashboardAuthSession,
} from "@/lib/dashboard-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type JsonRecord = Record<string, unknown>;

type ImportItem = {
  source?: string;
  alreadyExists?: boolean;
  form?: JsonRecord;
};

const ALLOWED_INTAKE_TYPES = new Set([
  "general",
  "verification",
  "appeal",
  "report",
  "partnership",
  "question",
  "custom",
]);

const PRESET_KEYWORDS: Record<string, string[]> = {
  verification: ["verification", "verify", "verification issue", "id verification", "vc verify", "role issue"],
  appeal: ["appeal", "ban appeal", "timeout appeal", "unban", "unmute"],
  report: ["report", "incident", "scam", "abuse", "harassment", "threat"],
  partnership: ["partnership", "partner", "collab", "collaboration", "sponsor"],
  question: ["question", "questions", "help question", "how to", "how do i"],
  general: ["support", "help", "general support", "assistance"],
  custom: [],
};

const COD_SERVICE_KEYWORDS = [
  "cod",
  "call of duty",
  "cod service",
  "cod services",
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
  "bo1",
  "bo2",
  "bo3",
  "mw2",
  "mw3",
  "world at war",
  "bot lobby",
];

function clean(value: unknown): string {
  return String(value || "").trim();
}

function lower(value: unknown): string {
  return clean(value).toLowerCase();
}

function safeArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function safeObject(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function slugify(value: unknown): string {
  return clean(value)
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizeBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  const text = lower(value);
  return text === "true" || text === "1" || text === "yes" || text === "on";
}

function normalizeIntakeType(value: unknown): string {
  const text = lower(value);
  return ALLOWED_INTAKE_TYPES.has(text) ? text : "general";
}

function normalizeKeywords(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : clean(value).split(",");
  const out: string[] = [];
  for (const item of raw) {
    const text = clean(item);
    if (text && !out.some((existing) => existing.toLowerCase() === text.toLowerCase())) out.push(text);
  }
  return out;
}

function mergeKeywords(...groups: unknown[]): string[] {
  const out: string[] = [];
  for (const group of groups) {
    for (const item of safeArray(group)) {
      const text = clean(item);
      if (text && !out.some((existing) => existing.toLowerCase() === text.toLowerCase())) out.push(text);
    }
  }
  return out;
}

function parseSortOrder(value: unknown, fallback: number): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function itemForm(item: ImportItem | JsonRecord): JsonRecord {
  const object = safeObject(item);
  return safeObject(object.form).name || safeObject(object.form).slug ? safeObject(object.form) : object;
}

function buildImportPayload(item: ImportItem | JsonRecord, guildId: string, actorId: string, sortFallback: number): JsonRecord | null {
  const form = itemForm(item);
  const name = clean(form.name || form.title || form.discord_channel_name);
  const slug = slugify(form.slug || name);
  if (!name || !slug) return null;

  const intakeType = normalizeIntakeType(form.intake_type || form.intakeType);
  const baseKeywords = normalizeKeywords(form.match_keywords || form.keywords || []);
  const presetKeywords = PRESET_KEYWORDS[intakeType] || [];
  const haystack = [name, slug, form.description, form.button_label, ...baseKeywords].join(" ").toLowerCase();
  const codKeywords = COD_SERVICE_KEYWORDS.some((word) => haystack.includes(word)) ? COD_SERVICE_KEYWORDS : [];

  return {
    guild_id: guildId,
    name,
    slug,
    color: clean(form.color) || "#45d483",
    description: clean(form.description) || `Imported from existing Discord category: ${name}.`,
    intake_type: intakeType,
    match_keywords: mergeKeywords(baseKeywords, presetKeywords, codKeywords),
    button_label: clean(form.button_label) || `Open ${name} Ticket`,
    sort_order: parseSortOrder(form.sort_order, sortFallback),
    is_default: normalizeBoolean(form.is_default),
    created_at: new Date().toISOString(),
  };
}

async function requestBody(request: Request): Promise<JsonRecord> {
  try {
    return safeObject(await request.json());
  } catch {
    return {};
  }
}

export async function POST(request: Request) {
  let session: DashboardAuthSession | null = null;

  try {
    session = await requireDashboardStaffSession();
    const guildId = clean(session.selectedGuildId);

    if (!guildId) {
      return dashboardAuthJson(
        {
          ok: false,
          error: "Select a server before importing categories.",
          error_code: "selected_server_required",
          needsServerSelection: true,
        },
        428,
        session
      );
    }

    const body = await requestBody(request);
    const rawItems = safeArray<ImportItem | JsonRecord>(body.suggestions || body.categories || body.items);
    const items = rawItems.filter((item) => !Boolean(safeObject(item).alreadyExists));

    if (!items.length) {
      return dashboardAuthJson(
        {
          ok: false,
          error: "No new detected categories were selected for import.",
          error_code: "invalid_request",
        },
        400,
        session
      );
    }

    const supabase = createServerSupabase();
    const { data: existingRows, error: existingError } = await supabase
      .from("ticket_categories")
      .select("id,slug,is_default")
      .eq("guild_id", guildId);

    if (existingError) throw new Error(existingError.message);

    const existingSlugs = new Set(safeArray<JsonRecord>(existingRows).map((row) => slugify(row.slug)).filter(Boolean));
    const hasDefault = safeArray<JsonRecord>(existingRows).some((row) => Boolean(row.is_default));
    const seenBatchSlugs = new Set<string>();
    const skipped: Array<{ slug: string; reason: string }> = [];
    const rows: JsonRecord[] = [];

    items.forEach((item, index) => {
      const payload = buildImportPayload(item, guildId, session?.user.discord_id || "dashboard", (index + 1) * 10);
      if (!payload) {
        skipped.push({ slug: "", reason: "missing_name_or_slug" });
        return;
      }

      const slug = clean(payload.slug);
      if (existingSlugs.has(slug)) {
        skipped.push({ slug, reason: "slug_already_exists" });
        return;
      }
      if (seenBatchSlugs.has(slug)) {
        skipped.push({ slug, reason: "duplicate_in_batch" });
        return;
      }

      seenBatchSlugs.add(slug);
      rows.push(payload);
    });

    if (!rows.length) {
      return dashboardAuthJson(
        {
          ok: false,
          selectedGuildId: guildId,
          error: "All detected categories already exist or were invalid.",
          error_code: "invalid_request",
          skipped,
        },
        400,
        session
      );
    }

    if (!hasDefault && !rows.some((row) => Boolean(row.is_default))) {
      rows[0].is_default = true;
    }

    if (rows.some((row) => Boolean(row.is_default))) {
      const { error: clearError } = await supabase
        .from("ticket_categories")
        .update({ is_default: false })
        .eq("guild_id", guildId)
        .eq("is_default", true);
      if (clearError) throw new Error(clearError.message);
    }

    const { data, error } = await supabase
      .from("ticket_categories")
      .insert(rows)
      .select("*");

    if (error) throw new Error(error.message);

    try {
      await supabase.from("audit_logs").insert({
        guild_id: guildId,
        action: "ticket_categories_bulk_imported",
        staff_id: session.user.discord_id,
        meta: {
          imported_count: safeArray(data).length,
          skipped,
          source: clean(body.source) || "auto_detect",
        },
      });
    } catch {
      // audit is best effort only
    }

    return dashboardAuthJson(
      {
        ok: true,
        selectedGuildId: guildId,
        importedCount: safeArray(data).length,
        skippedCount: skipped.length,
        skipped,
        categories: data || [],
        audit: {
          action: "ticket_categories_bulk_imported",
          actorId: session.user.discord_id,
          actorName: session.user.username,
        },
      },
      200,
      session
    );
  } catch (error) {
    return dashboardAuthErrorJson(error, session, 500);
  }
}

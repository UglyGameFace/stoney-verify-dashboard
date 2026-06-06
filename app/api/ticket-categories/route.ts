import { createServerSupabase } from "@/lib/supabase-server";
import { requireDashboardStaffSession, dashboardAuthJson, type DashboardAuthSession } from "@/lib/dashboard-auth";
import { getExplicitSelectedGuildId, hasSelectedGuildManagerProof } from "@/lib/guild-selection";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type JsonRecord = Record<string, unknown>;
type ErrorWithStatus = Error & { status?: number };
type NormalizedFormQuestion = {
  key: string;
  label: string;
  placeholder: string;
  required: boolean;
  style: "short" | "paragraph";
  max_length: number;
};
type CategoryRouteAccess = {
  guildId: string;
  session: DashboardAuthSession | null;
  actorId: string;
  actorName: string;
  accessMode: "session" | "selected_server_proof";
};

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
  "cod", "call of duty", "cod service", "cod services", "recovery", "recoveries",
  "challenge lobby", "challenge lobbies", "modded lobby", "modded lobbies", "unlock all",
  "prestige", "rank unlock", "camo unlock", "account recovery", "bo1", "bo2", "bo3",
  "mw2", "mw3", "world at war", "bot lobby",
];

const ALLOWED_INTAKE_TYPES = new Set(["general", "verification", "appeal", "report", "partnership", "question", "custom"]);
const ALLOWED_FORM_STYLES = new Set(["short", "paragraph"]);

function clean(value: unknown): string { return String(value || "").trim(); }
function lower(value: unknown): string { return clean(value).toLowerCase(); }
function safeArray<T = unknown>(value: unknown): T[] { return Array.isArray(value) ? (value as T[]) : []; }
function safeObject(value: unknown): JsonRecord { return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {}; }
function errorStatus(error: unknown, fallback: number): number { return typeof (error as ErrorWithStatus)?.status === "number" ? Number((error as ErrorWithStatus).status) : fallback; }
function errorMessage(error: unknown, fallback: string): string { return error instanceof Error ? error.message : fallback; }

function slugify(value: unknown): string {
  return clean(value).toLowerCase().replace(/['"]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
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
  return [...new Set(raw.map(clean).filter(Boolean))];
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

function parseSortOrder(value: unknown): number | null {
  if (value === "" || value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function parseMaxLength(value: unknown): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return 700;
  return Math.max(50, Math.min(Math.round(num), 4000));
}

function normalizeFormQuestions(value: unknown): NormalizedFormQuestion[] {
  return safeArray<JsonRecord>(value)
    .map((item): NormalizedFormQuestion | null => {
      const label = clean(item.label || item.question || item.name || item.title).slice(0, 45);
      if (!label) return null;
      const rawStyle = lower(item.style || item.type || "paragraph");
      const style: "short" | "paragraph" = ALLOWED_FORM_STYLES.has(rawStyle) && rawStyle === "short" ? "short" : "paragraph";
      return {
        key: slugify(item.key || item.name || label).slice(0, 80),
        label,
        placeholder: clean(item.placeholder || item.description || item.help_text).slice(0, 100),
        required: normalizeBoolean(item.required ?? true),
        style,
        max_length: parseMaxLength(item.max_length ?? item.maxLength),
      };
    })
    .filter((item): item is NormalizedFormQuestion => item !== null)
    .slice(0, 5);
}

function formSettingsTouched(body: JsonRecord): boolean {
  return ["form_enabled", "form_questions", "form_config"].some((key) => Object.prototype.hasOwnProperty.call(body, key));
}

function formConfig(value: unknown): JsonRecord {
  const config = safeObject(value);
  return { ...config, disable_default_template: normalizeBoolean(config.disable_default_template), forms_disabled: normalizeBoolean(config.forms_disabled) };
}

function buildPayload(body: JsonRecord, guildId: string, existing: JsonRecord = {}, actorId = "dashboard"): JsonRecord {
  const name = clean(body.name ?? existing.name);
  const slug = slugify(body.slug ?? existing.slug ?? name);
  if (!name) throw new Error("Category name is required.");
  if (!slug) throw new Error("Category slug is required.");

  const intakeType = normalizeIntakeType(body.intake_type ?? existing.intake_type);
  const baseKeywords = normalizeKeywords(body.match_keywords ?? existing.match_keywords ?? []);
  const presetKeywords = PRESET_KEYWORDS[intakeType] || [];
  const haystack = [name, slug, body.description, body.button_label, ...baseKeywords].join(" ").toLowerCase();
  const codKeywords = COD_SERVICE_KEYWORDS.some((word) => haystack.includes(word)) ? COD_SERVICE_KEYWORDS : [];

  const payload: JsonRecord = {
    guild_id: guildId,
    name,
    slug,
    color: clean(body.color ?? existing.color) || "#45d483",
    description: clean(body.description ?? existing.description),
    intake_type: intakeType,
    match_keywords: mergeKeywords(baseKeywords, presetKeywords, codKeywords),
    button_label: clean(body.button_label ?? existing.button_label) || `Open ${name} Ticket`,
    sort_order: parseSortOrder(body.sort_order ?? existing.sort_order),
    is_default: normalizeBoolean(body.is_default ?? existing.is_default ?? false),
  };

  if (formSettingsTouched(body)) {
    payload.form_enabled = normalizeBoolean(body.form_enabled ?? existing.form_enabled ?? false);
    payload.form_questions = normalizeFormQuestions(body.form_questions ?? existing.form_questions ?? []);
    payload.form_config = formConfig(body.form_config ?? existing.form_config ?? {});
    payload.form_updated_at = new Date().toISOString();
    payload.form_updated_by = actorId;
  }

  return payload;
}

async function bodyJson(request: Request): Promise<JsonRecord> { try { return safeObject(await request.json()); } catch { return {}; } }

async function clearOtherDefaults(supabase: ReturnType<typeof createServerSupabase>, guildId: string, excludeId = "") {
  let query = supabase.from("ticket_categories").update({ is_default: false }).eq("guild_id", guildId).eq("is_default", true);
  if (excludeId) query = query.neq("id", excludeId);
  const { error } = await query;
  if (error) throw new Error(error.message);
}

async function getCategory(supabase: ReturnType<typeof createServerSupabase>, guildId: string, id: string) {
  const { data, error } = await supabase.from("ticket_categories").select("*").eq("guild_id", guildId).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data || null;
}

async function assertSlugAvailable(supabase: ReturnType<typeof createServerSupabase>, guildId: string, slug: string, excludeId = "") {
  const { data, error } = await supabase.from("ticket_categories").select("id").eq("guild_id", guildId).eq("slug", slug).maybeSingle();
  if (error) throw new Error(error.message);
  if (data?.id && data.id !== excludeId) throw new Error("That category slug is already in use.");
}

async function loadCategories(supabase: ReturnType<typeof createServerSupabase>, guildId: string): Promise<JsonRecord[]> {
  const [categoriesRes, ticketsRes] = await Promise.all([
    supabase.from("ticket_categories").select("*").eq("guild_id", guildId).order("sort_order", { ascending: true, nullsFirst: false }).order("name", { ascending: true }),
    supabase.from("tickets").select("id,status,category_id,matched_category_id,updated_at,created_at").eq("guild_id", guildId),
  ]);
  if (categoriesRes.error) throw new Error(categoriesRes.error.message);
  const tickets = safeArray<JsonRecord>(ticketsRes.data || []);
  return safeArray<JsonRecord>(categoriesRes.data || []).map((category): JsonRecord => {
    const id = clean(category.id);
    const linked = tickets.filter((ticket) => clean(ticket.category_id) === id || clean(ticket.matched_category_id) === id);
    return {
      ...category,
      keyword_count: safeArray(category.match_keywords).length,
      form_question_count: safeArray(category.form_questions).length,
      usage: {
        total: linked.length,
        open: linked.filter((ticket) => lower(ticket.status) === "open").length,
        claimed: linked.filter((ticket) => lower(ticket.status) === "claimed").length,
        closed: linked.filter((ticket) => lower(ticket.status) === "closed").length,
        deleted: linked.filter((ticket) => lower(ticket.status) === "deleted").length,
        manualOverrideCount: 0,
        latestTicketAt: linked.map((ticket) => clean(ticket.updated_at || ticket.created_at)).filter(Boolean).sort().pop() || null,
      },
    };
  });
}

async function getCategoryRouteAccess(): Promise<CategoryRouteAccess> {
  try {
    const session = await requireDashboardStaffSession();
    const guildId = clean(session.selectedGuildId);
    if (!guildId) {
      const error = new Error("Select a server before managing ticket categories.") as ErrorWithStatus;
      error.status = 428;
      throw error;
    }
    return {
      guildId,
      session,
      actorId: clean(session.user.discord_id) || "dashboard",
      actorName: clean(session.user.username) || "Dashboard",
      accessMode: "session",
    };
  } catch (error) {
    const guildId = clean(getExplicitSelectedGuildId());
    if (guildId && hasSelectedGuildManagerProof()) {
      return {
        guildId,
        session: null,
        actorId: "dashboard-proof",
        actorName: "Dashboard",
        accessMode: "selected_server_proof",
      };
    }
    throw error;
  }
}

function audit(action: string, access: CategoryRouteAccess) {
  return {
    action,
    actorId: access.actorId,
    actorName: access.actorName,
    accessMode: access.accessMode,
  };
}

export async function GET() {
  let session: DashboardAuthSession | null = null;
  try {
    const access = await getCategoryRouteAccess();
    session = access.session;
    const supabase = createServerSupabase();
    const categories = await loadCategories(supabase, access.guildId);
    const defaultCategory = categories.find((row) => Boolean(row.is_default)) || null;
    return dashboardAuthJson({ selectedGuildId: access.guildId, categories, defaultCategoryId: defaultCategory ? clean(defaultCategory.id) || null : null, presets: PRESET_KEYWORDS, codServiceKeywords: COD_SERVICE_KEYWORDS, accessMode: access.accessMode }, 200, session);
  } catch (error) {
    return dashboardAuthJson({ error: errorMessage(error, "Failed to load categories.") }, errorStatus(error, 500), session);
  }
}

export async function POST(request: Request) {
  let session: DashboardAuthSession | null = null;
  try {
    const access = await getCategoryRouteAccess();
    session = access.session;
    const supabase = createServerSupabase();
    const body = await bodyJson(request);
    const payload = buildPayload(body, access.guildId, {}, access.actorId);
    await assertSlugAvailable(supabase, access.guildId, clean(payload.slug));
    if (Boolean(payload.is_default)) await clearOtherDefaults(supabase, access.guildId);
    const { data, error } = await supabase.from("ticket_categories").insert({ ...payload, created_at: new Date().toISOString() }).select("*").single();
    if (error) throw new Error(error.message);
    return dashboardAuthJson({ ok: true, selectedGuildId: access.guildId, category: data, audit: audit("category_created", access) }, 200, session);
  } catch (error) {
    return dashboardAuthJson({ error: errorMessage(error, "Failed to create category.") }, errorStatus(error, 400), session);
  }
}

export async function PATCH(request: Request) {
  let session: DashboardAuthSession | null = null;
  try {
    const access = await getCategoryRouteAccess();
    session = access.session;
    const supabase = createServerSupabase();
    const body = await bodyJson(request);
    const id = clean(body.id);
    if (!id) return dashboardAuthJson({ error: "Category id is required." }, 400, session);
    const existing = await getCategory(supabase, access.guildId, id);
    if (!existing) return dashboardAuthJson({ error: "Category not found." }, 404, session);
    const payload = buildPayload(body, access.guildId, existing, access.actorId);
    await assertSlugAvailable(supabase, access.guildId, clean(payload.slug), id);
    if (Boolean(payload.is_default)) await clearOtherDefaults(supabase, access.guildId, id);
    const { data, error } = await supabase.from("ticket_categories").update(payload).eq("guild_id", access.guildId).eq("id", id).select("*").single();
    if (error) throw new Error(error.message);
    return dashboardAuthJson({ ok: true, selectedGuildId: access.guildId, category: data, audit: audit("category_updated", access) }, 200, session);
  } catch (error) {
    return dashboardAuthJson({ error: errorMessage(error, "Failed to update category.") }, errorStatus(error, 400), session);
  }
}

export async function DELETE(request: Request) {
  let session: DashboardAuthSession | null = null;
  try {
    const access = await getCategoryRouteAccess();
    session = access.session;
    const supabase = createServerSupabase();
    const url = new URL(request.url);
    const body = await bodyJson(request);
    const id = clean(url.searchParams.get("id") || body.id);
    if (!id) return dashboardAuthJson({ error: "Category id is required." }, 400, session);
    const existing = await getCategory(supabase, access.guildId, id);
    if (!existing) return dashboardAuthJson({ error: "Category not found." }, 404, session);
    if (existing.is_default) return dashboardAuthJson({ error: "You cannot delete the default category until another default is set." }, 409, session);
    const { count, error: linkedError } = await supabase.from("tickets").select("*", { count: "exact", head: true }).eq("guild_id", access.guildId).or(`category_id.eq.${id},matched_category_id.eq.${id}`);
    if (linkedError) throw new Error(linkedError.message);
    if (Number(count || 0) > 0) return dashboardAuthJson({ error: "This category is still linked to tickets. Reassign those tickets before deleting it." }, 409, session);
    const { error } = await supabase.from("ticket_categories").delete().eq("guild_id", access.guildId).eq("id", id);
    if (error) throw new Error(error.message);
    return dashboardAuthJson({ ok: true, selectedGuildId: access.guildId, deletedId: id, audit: audit("category_deleted", access) }, 200, session);
  } catch (error) {
    return dashboardAuthJson({ error: errorMessage(error, "Failed to delete category.") }, errorStatus(error, 400), session);
  }
}

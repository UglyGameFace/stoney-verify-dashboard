import { createServerSupabase } from "@/lib/supabase-server";
import { requireDashboardStaffSession, dashboardAuthJson } from "@/lib/dashboard-auth";

function clean(value) {
  return String(value || "").trim();
}

function slugify(value) {
  return clean(value)
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizeKeywords(value) {
  if (Array.isArray(value)) return [...new Set(value.map(clean).filter(Boolean))];
  return [...new Set(clean(value).split(",").map((item) => item.trim()).filter(Boolean))];
}

function normalizeIntakeType(value) {
  const allowed = new Set(["general", "verification", "appeal", "report", "partnership", "question", "custom"]);
  const text = clean(value).toLowerCase();
  return allowed.has(text) ? text : "general";
}

function parseSortOrder(value) {
  if (value === "" || value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeBoolean(value) {
  if (typeof value === "boolean") return value;
  const text = clean(value).toLowerCase();
  return text === "true" || text === "1" || text === "yes" || text === "on";
}

function buildCategoryPatch(body) {
  const name = clean(body?.name);
  const slug = slugify(body?.slug || name);
  if (!name) throw new Error("Category name is required.");
  if (!slug) throw new Error("Category slug is required.");
  return {
    name,
    slug,
    color: clean(body?.color) || "#45d483",
    description: clean(body?.description),
    intake_type: normalizeIntakeType(body?.intake_type),
    match_keywords: normalizeKeywords(body?.match_keywords),
    button_label: clean(body?.button_label),
    sort_order: parseSortOrder(body?.sort_order),
    is_default: normalizeBoolean(body?.is_default),
  };
}

async function clearOtherDefaults(supabase, guildId, excludeId = null) {
  let query = supabase.from("ticket_categories").update({ is_default: false }).eq("guild_id", guildId).eq("is_default", true);
  if (excludeId) query = query.neq("id", excludeId);
  const { error } = await query;
  if (error) throw new Error(error.message);
}

async function getCategory(supabase, guildId, categoryId) {
  const { data, error } = await supabase.from("ticket_categories").select("*").eq("id", categoryId).eq("guild_id", guildId).maybeSingle();
  if (error) throw new Error(error.message);
  return data || null;
}

function statusFor(error, fallback = 400) {
  return typeof error?.status === "number" ? error.status : fallback;
}

export async function PATCH(request, { params }) {
  let session = null;
  try {
    session = await requireDashboardStaffSession();
    const guildId = clean(session.selectedGuildId);
    if (!guildId) return dashboardAuthJson({ error: "Select a server before managing ticket categories.", needsServerSelection: true }, 428, session);
    const body = await request.json().catch(() => ({}));
    const supabase = createServerSupabase();
    const categoryId = clean(params?.id);
    if (!categoryId) return dashboardAuthJson({ error: "Missing category id.", selectedGuildId: guildId }, 400, session);
    const existing = await getCategory(supabase, guildId, categoryId);
    if (!existing) return dashboardAuthJson({ error: "Category not found.", selectedGuildId: guildId }, 404, session);
    const payload = buildCategoryPatch(body);
    if (payload.is_default) await clearOtherDefaults(supabase, guildId, categoryId);
    const { data, error } = await supabase.from("ticket_categories").update(payload).eq("id", categoryId).eq("guild_id", guildId).select("*").single();
    if (error) throw new Error(error.message);
    return dashboardAuthJson({ ok: true, selectedGuildId: guildId, category: data }, 200, session);
  } catch (error) {
    return dashboardAuthJson({ error: error?.message || "Failed to update category." }, statusFor(error), session);
  }
}

export async function DELETE(_request, { params }) {
  let session = null;
  try {
    session = await requireDashboardStaffSession();
    const guildId = clean(session.selectedGuildId);
    if (!guildId) return dashboardAuthJson({ error: "Select a server before managing ticket categories.", needsServerSelection: true }, 428, session);
    const supabase = createServerSupabase();
    const categoryId = clean(params?.id);
    if (!categoryId) return dashboardAuthJson({ error: "Missing category id.", selectedGuildId: guildId }, 400, session);
    const existing = await getCategory(supabase, guildId, categoryId);
    if (!existing) return dashboardAuthJson({ error: "Category not found.", selectedGuildId: guildId }, 404, session);
    if (existing.is_default) return dashboardAuthJson({ error: "You cannot delete the default category until another default is set.", selectedGuildId: guildId }, 409, session);
    const { data: linkedTickets, error: linkedError } = await supabase.from("tickets").select("id,title,status,category_id,matched_category_id").eq("guild_id", guildId).or(`category_id.eq.${categoryId},matched_category_id.eq.${categoryId}`).limit(20);
    if (linkedError) throw new Error(linkedError.message);
    if (Array.isArray(linkedTickets) && linkedTickets.length > 0) {
      return dashboardAuthJson({
        error: "This category is still linked to tickets. Reassign those tickets before deleting it.",
        selectedGuildId: guildId,
        linkedTickets: linkedTickets.map((ticket) => ({ id: ticket?.id || null, title: ticket?.title || "Untitled", status: ticket?.status || "unknown" })),
      }, 409, session);
    }
    const { error } = await supabase.from("ticket_categories").delete().eq("id", categoryId).eq("guild_id", guildId);
    if (error) throw new Error(error.message);
    return dashboardAuthJson({ ok: true, selectedGuildId: guildId, deletedId: categoryId }, 200, session);
  } catch (error) {
    return dashboardAuthJson({ error: error?.message || "Failed to delete category." }, statusFor(error), session);
  }
}

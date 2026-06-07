import { createServerSupabase } from "@/lib/supabase-server";
import { requireDashboardStaffSession, dashboardAuthJson, dashboardAuthErrorJson, type DashboardAuthSession } from "@/lib/dashboard-auth";
import { discordBotFetch } from "@/lib/discord-api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type DiscordChannel = {
  id?: string;
  name?: string;
  type?: number;
  parent_id?: string | null;
  position?: number | null;
};

type ExistingCategory = {
  id?: string | null;
  name?: string | null;
  slug?: string | null;
};

const TICKET_WORDS = ["ticket", "tickets", "support", "help", "verify", "verification", "appeal", "report", "reports", "incident", "modmail", "claim"];
const VERIFY_WORDS = ["verify", "verification", "id", "vc verify", "unverified", "verified"];
const APPEAL_WORDS = ["appeal", "appeals", "ban", "unban", "timeout", "mute"];
const REPORT_WORDS = ["report", "reports", "incident", "scam", "abuse", "modmail"];
const QUESTION_WORDS = ["question", "questions", "faq", "help"];
const PARTNER_WORDS = ["partner", "partnership", "collab", "sponsor"];
const SERVICE_WORDS = ["service", "services", "cod", "call of duty", "order", "orders", "paid", "shop"];

function clean(value: unknown): string {
  return String(value || "").trim();
}

function normalizeText(value: unknown): string {
  return clean(value).toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function slugify(value: unknown): string {
  return clean(value)
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function includesAny(haystack: string, words: string[]) {
  return words.some((word) => haystack.includes(normalizeText(word)));
}

function unique(values: string[]) {
  const out: string[] = [];
  for (const value of values) {
    const item = clean(value);
    if (item && !out.some((existing) => existing.toLowerCase() === item.toLowerCase())) out.push(item);
  }
  return out;
}

function inferIntakeType(haystack: string) {
  if (includesAny(haystack, VERIFY_WORDS)) return "verification";
  if (includesAny(haystack, APPEAL_WORDS)) return "appeal";
  if (includesAny(haystack, REPORT_WORDS)) return "report";
  if (includesAny(haystack, PARTNER_WORDS)) return "partnership";
  if (includesAny(haystack, QUESTION_WORDS)) return "question";
  if (includesAny(haystack, SERVICE_WORDS)) return "custom";
  return "general";
}

function colorForType(type: string) {
  if (type === "verification") return "#63d5ff";
  if (type === "appeal") return "#ffd36b";
  if (type === "report") return "#ff6f8e";
  if (type === "partnership") return "#b26dff";
  if (type === "question") return "#78ddff";
  if (type === "custom") return "#b26dff";
  return "#45d483";
}

function defaultKeywords(type: string, name: string, childNames: string[]) {
  const base = [name, slugify(name).replace(/-/g, " "), ...childNames.map((item) => item.replace(/-/g, " "))];
  if (type === "verification") return unique([...base, "verification", "verify", "id verification", "vc verify", "role issue"]);
  if (type === "appeal") return unique([...base, "appeal", "ban appeal", "unban", "staff review"]);
  if (type === "report") return unique([...base, "report", "incident", "scam", "abuse", "harassment"]);
  if (type === "partnership") return unique([...base, "partnership", "partner", "collab"]);
  if (type === "question") return unique([...base, "question", "questions", "help", "how to"]);
  if (type === "custom") return unique([...base, "service", "services", "support", "order"]);
  return unique([...base, "support", "help", "general support", "assistance"]);
}

function buttonLabelForType(type: string, name: string) {
  if (type === "verification") return "Open Verification Ticket";
  if (type === "appeal") return "Open Appeal Ticket";
  if (type === "report") return "Open Report Ticket";
  if (type === "partnership") return "Open Partnership Ticket";
  if (type === "question") return "Ask a Question";
  if (type === "custom") return `Open ${name} Ticket`;
  return "Open Support Ticket";
}

export async function GET() {
  let session: DashboardAuthSession | null = null;

  try {
    session = await requireDashboardStaffSession();
    const guildId = clean(session.selectedGuildId);
    if (!guildId) {
      return dashboardAuthJson({ error: "Select a server before detecting categories.", error_code: "selected_server_required", needsServerSelection: true }, 428, session);
    }

    const supabase = createServerSupabase();
    const [channels, existingRes] = await Promise.all([
      discordBotFetch(`/guilds/${guildId}/channels`),
      supabase.from("ticket_categories").select("id,name,slug").eq("guild_id", guildId),
    ]);

    if (existingRes.error) {
      return dashboardAuthJson({ error: existingRes.error.message, selectedGuildId: guildId }, 500, session);
    }

    const allChannels = Array.isArray(channels) ? (channels as DiscordChannel[]) : [];
    const existing = Array.isArray(existingRes.data) ? (existingRes.data as ExistingCategory[]) : [];
    const existingSlugs = new Set(existing.map((row) => slugify(row.slug || row.name)).filter(Boolean));
    const childrenByParent = new Map<string, DiscordChannel[]>();

    for (const channel of allChannels) {
      const parentId = clean(channel.parent_id);
      if (!parentId) continue;
      const list = childrenByParent.get(parentId) || [];
      list.push(channel);
      childrenByParent.set(parentId, list);
    }

    const categoryChannels = allChannels.filter((channel) => Number(channel.type) === 4);
    const suggestions = categoryChannels
      .map((category, index) => {
        const name = clean(category.name);
        if (!name) return null;
        const children = (childrenByParent.get(clean(category.id)) || []).sort((a, b) => Number(a.position || 0) - Number(b.position || 0));
        const childNames = children.map((child) => clean(child.name)).filter(Boolean);
        const haystack = normalizeText([name, ...childNames].join(" "));
        const looksTicketRelated = includesAny(haystack, TICKET_WORDS) || childNames.length > 0;
        if (!looksTicketRelated) return null;
        const intakeType = inferIntakeType(haystack);
        const slug = slugify(name);
        const confidence = includesAny(haystack, TICKET_WORDS) ? 92 : Math.min(75, 45 + childNames.length * 8);
        return {
          source: "discord_category",
          discord_channel_id: clean(category.id),
          discord_channel_name: name,
          child_channel_count: childNames.length,
          child_channel_names: childNames.slice(0, 8),
          alreadyExists: existingSlugs.has(slug),
          confidence,
          reason: childNames.length
            ? `Detected Discord category with ${childNames.length} child channel${childNames.length === 1 ? "" : "s"}.`
            : "Detected ticket-related Discord category name.",
          form: {
            name,
            slug,
            color: colorForType(intakeType),
            description: `Imported from existing Discord category: ${name}.`,
            intake_type: intakeType,
            match_keywords: defaultKeywords(intakeType, name, childNames),
            button_label: buttonLabelForType(intakeType, name),
            sort_order: String((index + 1) * 10),
            is_default: index === 0 && !existing.some((row) => clean(row.slug)),
          },
        };
      })
      .filter(Boolean);

    return dashboardAuthJson({
      ok: true,
      selectedGuildId: guildId,
      scannedChannels: allChannels.length,
      scannedCategories: categoryChannels.length,
      existingCategoryCount: existing.length,
      suggestions,
    }, 200, session);
  } catch (error) {
    return dashboardAuthErrorJson(error, session, 500);
  }
}

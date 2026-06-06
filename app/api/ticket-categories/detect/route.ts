import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerSupabase } from "@/lib/supabase-server";
import { applyAuthCookies, refreshAccessToken } from "@/lib/auth-server";
import { getSelectedGuildId } from "@/lib/guild-selection";
import { discordBotFetch, discordUserFetch } from "@/lib/discord-api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MANAGE_GUILD = BigInt(1 << 5);
const ADMINISTRATOR = BigInt(1 << 3);
const ACCESS_COOKIE = "discord_access_token";
const REFRESH_COOKIE = "discord_refresh_token";
const EXPIRES_COOKIE = "discord_expires_at";

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

type DiscordUserGuild = {
  id?: string | null;
  owner?: boolean | null;
  permissions?: string | number | null;
};

type RefreshedTokens = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
} | null;

type BearerSession = {
  bearer: string;
  refreshedTokens: RefreshedTokens;
};

const TICKET_WORDS = ["ticket", "tickets", "support", "help", "verify", "verification", "appeal", "report", "reports", "incident", "modmail", "claim"];
const VERIFY_WORDS = ["verify", "verification", "id", "vc verify", "unverified", "verified"];
const APPEAL_WORDS = ["appeal", "appeals", "ban", "unban", "timeout", "mute"];
const REPORT_WORDS = ["report", "reports", "incident", "scam", "abuse", "modmail"];
const QUESTION_WORDS = ["question", "questions", "faq", "help"];
const PARTNER_WORDS = ["partner", "partnership", "collab", "sponsor"];
const SERVICE_WORDS = ["service", "services", "cod", "call of duty", "order", "orders", "paid", "shop"];

function normalizeString(value: unknown): string {
  return String(value || "").trim();
}

function normalizeText(value: unknown): string {
  return normalizeString(value).toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function slugify(value: unknown): string {
  return normalizeString(value)
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
    const clean = normalizeString(value);
    if (!clean) continue;
    if (!out.some((existing) => existing.toLowerCase() === clean.toLowerCase())) out.push(clean);
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

function hasManageGuildPermission(guild: DiscordUserGuild | null | undefined): boolean {
  if (!guild) return false;
  if (guild.owner) return true;
  try {
    const raw = BigInt(normalizeString(guild.permissions || "0"));
    return (raw & ADMINISTRATOR) === ADMINISTRATOR || (raw & MANAGE_GUILD) === MANAGE_GUILD;
  } catch {
    return false;
  }
}

async function refreshBearer(refreshToken: string): Promise<BearerSession | null> {
  const token = normalizeString(refreshToken);
  if (!token) return null;

  try {
    const refreshedTokens = (await refreshAccessToken(token)) as RefreshedTokens;
    const bearer = normalizeString(refreshedTokens?.access_token);
    if (!bearer) return null;
    return { bearer, refreshedTokens };
  } catch {
    return null;
  }
}

async function getBearerSession(): Promise<BearerSession | null> {
  const store = cookies();
  const accessToken = normalizeString(store.get(ACCESS_COOKIE)?.value);
  const refreshToken = normalizeString(store.get(REFRESH_COOKIE)?.value);
  const expiresAt = Number(store.get(EXPIRES_COOKIE)?.value || 0);

  if (!accessToken && !refreshToken) return null;

  const shouldRefresh = !accessToken || Boolean(expiresAt && Date.now() > expiresAt - 60_000);
  if (shouldRefresh) return await refreshBearer(refreshToken);

  return { bearer: accessToken, refreshedTokens: null };
}

async function fetchManageableGuilds(session: BearerSession): Promise<{ session: BearerSession; guilds: DiscordUserGuild[] }> {
  try {
    const guilds = (await discordUserFetch("/users/@me/guilds", session.bearer)) as DiscordUserGuild[];
    return { session, guilds: Array.isArray(guilds) ? guilds : [] };
  } catch (error) {
    const refreshToken = normalizeString(cookies().get(REFRESH_COOKIE)?.value || session.refreshedTokens?.refresh_token);
    const retrySession = await refreshBearer(refreshToken);
    if (!retrySession) throw error;
    const guilds = (await discordUserFetch("/users/@me/guilds", retrySession.bearer)) as DiscordUserGuild[];
    return { session: retrySession, guilds: Array.isArray(guilds) ? guilds : [] };
  }
}

function buildJsonResponse(payload: Record<string, unknown>, status = 200, refreshedTokens: RefreshedTokens = null) {
  const response = NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" },
  });
  applyAuthCookies(response, refreshedTokens);
  return response;
}

export async function GET() {
  let bearerSession: BearerSession | null = null;

  try {
    bearerSession = await getBearerSession();
    if (!bearerSession) {
      return buildJsonResponse({ error: "Discord login required. Open Account and sign in again." }, 401);
    }

    const guildId = normalizeString(getSelectedGuildId());
    if (!guildId) {
      return buildJsonResponse({ error: "Select a server before detecting categories.", needsServerSelection: true }, 428, bearerSession.refreshedTokens);
    }

    const access = await fetchManageableGuilds(bearerSession);
    bearerSession = access.session;
    const selectedGuild = access.guilds.find((guild) => normalizeString(guild.id) === guildId);

    if (!hasManageGuildPermission(selectedGuild)) {
      return buildJsonResponse({ error: "You need Manage Server or Administrator permission for the selected server before auto-detect can scan categories.", selectedGuildId: guildId }, 403, bearerSession.refreshedTokens);
    }

    const supabase = createServerSupabase();
    const [channels, existingRes] = await Promise.all([
      discordBotFetch(`/guilds/${guildId}/channels`),
      supabase.from("ticket_categories").select("id,name,slug").eq("guild_id", guildId),
    ]);

    if (existingRes.error) {
      return buildJsonResponse({ error: existingRes.error.message, selectedGuildId: guildId }, 500, bearerSession.refreshedTokens);
    }

    const allChannels = Array.isArray(channels) ? (channels as DiscordChannel[]) : [];
    const existing = Array.isArray(existingRes.data) ? (existingRes.data as ExistingCategory[]) : [];
    const existingSlugs = new Set(existing.map((row) => slugify(row.slug || row.name)).filter(Boolean));
    const childrenByParent = new Map<string, DiscordChannel[]>();

    for (const channel of allChannels) {
      const parentId = normalizeString(channel.parent_id);
      if (!parentId) continue;
      const list = childrenByParent.get(parentId) || [];
      list.push(channel);
      childrenByParent.set(parentId, list);
    }

    const categoryChannels = allChannels.filter((channel) => Number(channel.type) === 4);
    const suggestions = categoryChannels
      .map((category, index) => {
        const name = normalizeString(category.name);
        if (!name) return null;
        const children = (childrenByParent.get(normalizeString(category.id)) || []).sort((a, b) => Number(a.position || 0) - Number(b.position || 0));
        const childNames = children.map((child) => normalizeString(child.name)).filter(Boolean);
        const haystack = normalizeText([name, ...childNames].join(" "));
        const looksTicketRelated = includesAny(haystack, TICKET_WORDS) || childNames.length > 0;
        if (!looksTicketRelated) return null;
        const intakeType = inferIntakeType(haystack);
        const slug = slugify(name);
        const confidence = includesAny(haystack, TICKET_WORDS) ? 92 : Math.min(75, 45 + childNames.length * 8);
        return {
          source: "discord_category",
          discord_channel_id: normalizeString(category.id),
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
            is_default: index === 0 && !existing.some((row) => normalizeString(row.slug)),
          },
        };
      })
      .filter(Boolean);

    return buildJsonResponse({
      ok: true,
      selectedGuildId: guildId,
      scannedChannels: allChannels.length,
      scannedCategories: categoryChannels.length,
      existingCategoryCount: existing.length,
      suggestions,
    }, 200, bearerSession.refreshedTokens);
  } catch (error) {
    const raw = error instanceof Error ? error.message : "Failed to detect Discord categories.";
    const lower = raw.toLowerCase();
    const message = lower.includes("session expired") || lower.includes("401") || lower.includes("unauthorized")
      ? "Discord session could not be refreshed for auto-detect. Use Account → Reset Login once, then return to Categories."
      : raw;
    return buildJsonResponse({ error: message }, lower.includes("session") || lower.includes("401") ? 401 : 500, bearerSession?.refreshedTokens || null);
  }
}

import { NextResponse } from "next/server";
import { discordBotFetch, discordUserFetch } from "@/lib/discord-api";
import {
  getSelectedGuildId,
  setSelectedGuildCookie,
} from "@/lib/guild-selection";
import { createServerSupabase } from "@/lib/supabase-server";
import { env } from "@/lib/env";
import {
  applyRouteSession,
  getRouteSession,
  type RouteSession,
} from "@/lib/route-session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MANAGE_GUILD = BigInt(1 << 5);
const ADMINISTRATOR = BigInt(1 << 3);
const DEFAULT_BOT_INVITE_PERMISSIONS = "8";

type DiscordUserGuild = {
  id?: string | null;
  name?: string | null;
  icon?: string | null;
  owner?: boolean | null;
  permissions?: string | number | null;
};

type BotGuild = {
  id?: string | null;
  name?: string | null;
  icon?: string | null;
};

type BotGuildLookup = {
  ok: boolean;
  error: string | null;
  guilds: Map<string, BotGuild>;
};

type JsonRecord = Record<string, unknown>;

function normalizeString(value: unknown): string {
  return String(value || "").trim();
}

function guildIconUrl(guildId: string, icon: string | null | undefined): string | null {
  const cleanIcon = normalizeString(icon);
  if (!guildId || !cleanIcon) return null;
  const animated = cleanIcon.startsWith("a_");
  return `https://cdn.discordapp.com/icons/${guildId}/${cleanIcon}.${animated ? "gif" : "png"}?size=128`;
}

function hasManageGuildPermission(guild: DiscordUserGuild): boolean {
  if (guild.owner) return true;
  try {
    const raw = BigInt(normalizeString(guild.permissions || "0"));
    return (raw & ADMINISTRATOR) === ADMINISTRATOR || (raw & MANAGE_GUILD) === MANAGE_GUILD;
  } catch {
    return false;
  }
}

function buildBotInviteUrl(guildId: string): string | null {
  const clientId = normalizeString(env.discordClientId || process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID);
  if (!clientId) return null;

  const params = new URLSearchParams({
    client_id: clientId,
    permissions: normalizeString(process.env.DISCORD_BOT_INVITE_PERMISSIONS) || DEFAULT_BOT_INVITE_PERMISSIONS,
    scope: "bot applications.commands",
  });

  if (guildId) {
    params.set("guild_id", guildId);
    params.set("disable_guild_select", "true");
  }

  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

async function fetchBotGuilds(): Promise<BotGuildLookup> {
  if (!normalizeString(env.discordToken)) {
    return {
      ok: false,
      error: "Dashboard bot credential is missing, so bot installation could not be verified from Discord.",
      guilds: new Map(),
    };
  }

  try {
    const rows = (await discordBotFetch("/users/@me/guilds")) as BotGuild[];
    const guilds = new Map(
      (Array.isArray(rows) ? rows : [])
        .map((guild) => [normalizeString(guild.id), guild] as const)
        .filter(([id]) => Boolean(id))
    );
    return { ok: true, error: null, guilds };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Bot guild check failed.",
      guilds: new Map(),
    };
  }
}

async function fetchKnownDashboardGuildIds(guildIds: string[]): Promise<Set<string>> {
  const ids = guildIds.map(normalizeString).filter(Boolean);
  const found = new Set<string>();
  if (!ids.length) return found;

  try {
    const supabase = createServerSupabase();
    const tables = ["guild_members", "guild_roles", "ticket_categories", "tickets", "activity_feed_events"];

    await Promise.all(
      tables.map(async (table) => {
        try {
          const response = await supabase
            .from(table)
            .select("guild_id")
            .in("guild_id", ids)
            .limit(ids.length);

          const rows = Array.isArray(response?.data) ? response.data : [];
          for (const row of rows) {
            const id = normalizeString(row?.guild_id);
            if (id) found.add(id);
          }
        } catch {
          // Some deployments do not have every table yet. Other tables can still prove bot presence.
        }
      })
    );
  } catch {
    // If Supabase is not available, Discord bot membership remains the source of truth.
  }

  return found;
}

function buildJsonResponse(payload: JsonRecord, status = 200, routeSession: RouteSession | null = null) {
  const response = NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  });
  applyRouteSession(response, routeSession);
  return response;
}

function resolveInstallState(guildId: string, botLookup: BotGuildLookup, knownDashboardGuildIds: Set<string>): "installed" | "missing" | "unknown" {
  const defaultGuildId = normalizeString(env.guildId || env.discordGuildId);

  if (botLookup.guilds.has(guildId)) return "installed";
  if (knownDashboardGuildIds.has(guildId)) return "installed";

  // If Discord's bot-guild lookup is unavailable, the configured default guild is very likely
  // the live bot server. Do not incorrectly show "Bot not installed" for it.
  if (!botLookup.ok && defaultGuildId && defaultGuildId === guildId) return "installed";

  if (!botLookup.ok) return "unknown";
  return "missing";
}

export async function GET() {
  const routeSession = await getRouteSession();

  if (!routeSession) {
    return buildJsonResponse({ error: "Discord login required." }, 401);
  }

  try {
    const [userGuildsRaw, botLookup] = await Promise.all([
      discordUserFetch("/users/@me/guilds", routeSession.bearer) as Promise<DiscordUserGuild[]>,
      fetchBotGuilds(),
    ]);

    const userGuilds = Array.isArray(userGuildsRaw) ? userGuildsRaw : [];
    const selectedGuildId = getSelectedGuildId();
    const manageableSource = userGuilds.filter(hasManageGuildPermission);
    const knownDashboardGuildIds = await fetchKnownDashboardGuildIds(
      manageableSource.map((guild) => normalizeString(guild.id))
    );

    const manageable = manageableSource
      .map((guild) => {
        const id = normalizeString(guild.id);
        const botGuild = botLookup.guilds.get(id);
        const installState = resolveInstallState(id, botLookup, knownDashboardGuildIds);
        const installed = installState === "installed";
        const name = normalizeString(botGuild?.name || guild.name || "Unknown Server");
        const icon = normalizeString(botGuild?.icon || guild.icon || "");
        return {
          id,
          name,
          icon,
          icon_url: guildIconUrl(id, icon),
          owner: Boolean(guild.owner),
          can_manage: true,
          bot_installed: installed,
          bot_install_state: installState,
          bot_check_ok: botLookup.ok,
          bot_check_error: botLookup.error,
          bot_invite_url: installed ? null : buildBotInviteUrl(id),
          selected: selectedGuildId === id,
          is_default_env_guild: normalizeString(env.guildId || env.discordGuildId) === id,
        };
      })
      .filter((guild) => guild.id)
      .sort((a, b) => {
        if (a.bot_installed !== b.bot_installed) return a.bot_installed ? -1 : 1;
        if (a.selected !== b.selected) return a.selected ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

    return buildJsonResponse({
      ok: true,
      selectedGuildId,
      servers: manageable,
      installedCount: manageable.filter((guild) => guild.bot_installed).length,
      manageableCount: manageable.length,
      botCheckOk: botLookup.ok,
      botCheckError: botLookup.error,
    }, 200, routeSession);
  } catch (error) {
    return buildJsonResponse(
      {
        error: error instanceof Error ? error.message : "Failed to load Discord servers.",
      },
      500,
      routeSession
    );
  }
}

export async function POST(request: Request) {
  const routeSession = await getRouteSession();

  if (!routeSession) {
    return buildJsonResponse({ error: "Discord login required." }, 401);
  }

  try {
    const body = (await request.json().catch(() => ({}))) as JsonRecord;
    const requestedGuildId = normalizeString(body.guild_id || body.guildId);
    if (!requestedGuildId) {
      return buildJsonResponse({ error: "Server id is required." }, 400, routeSession);
    }

    const [userGuildsRaw, botLookup, knownDashboardGuildIds] = await Promise.all([
      discordUserFetch("/users/@me/guilds", routeSession.bearer) as Promise<DiscordUserGuild[]>,
      fetchBotGuilds(),
      fetchKnownDashboardGuildIds([requestedGuildId]),
    ]);

    const userGuild = (Array.isArray(userGuildsRaw) ? userGuildsRaw : []).find(
      (guild) => normalizeString(guild.id) === requestedGuildId
    );

    if (!userGuild || !hasManageGuildPermission(userGuild)) {
      return buildJsonResponse(
        { error: "You need Manage Server or Administrator permission for that server." },
        403,
        routeSession
      );
    }

    const installState = resolveInstallState(requestedGuildId, botLookup, knownDashboardGuildIds);
    if (installState !== "installed") {
      const inviteUrl = buildBotInviteUrl(requestedGuildId);
      return buildJsonResponse(
        {
          error:
            installState === "unknown"
              ? "The dashboard could not verify bot access for that server. Refresh, then use the invite link if needed."
              : "Dank Shield is not installed in that server yet.",
          bot_install_state: installState,
          bot_invite_url: inviteUrl,
          bot_check_error: botLookup.error,
        },
        installState === "unknown" ? 503 : 409,
        routeSession
      );
    }

    const response = buildJsonResponse({ ok: true, selectedGuildId: requestedGuildId }, 200, routeSession);
    setSelectedGuildCookie(response, requestedGuildId);
    return response;
  } catch (error) {
    return buildJsonResponse(
      {
        error: error instanceof Error ? error.message : "Failed to select server.",
      },
      500,
      routeSession
    );
  }
}

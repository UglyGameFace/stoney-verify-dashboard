import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { discordBotFetch, discordUserFetch } from "@/lib/discord-api";
import {
  getGuildCookieOptions,
  getSelectedGuildId,
  setSelectedGuildCookie,
} from "@/lib/guild-selection";
import { createServerSupabase } from "@/lib/supabase-server";
import { env } from "@/lib/env";
import { applyAuthCookies, refreshAccessToken } from "@/lib/auth-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MANAGE_GUILD = BigInt(1 << 5);
const ADMINISTRATOR = BigInt(1 << 3);
const DEFAULT_BOT_INVITE_PERMISSIONS = "8";
const MAX_DIRECT_BOT_GUILD_CHECKS = 25;
const ACCESS_COOKIE = "discord_access_token";
const REFRESH_COOKIE = "discord_refresh_token";
const EXPIRES_COOKIE = "discord_expires_at";
const SERVER_CACHE_COOKIE = "dank_manageable_servers_cache";
const SERVER_CACHE_MAX_AGE_SEC = 10 * 60;
const SERVER_CACHE_MAX_AGE_MS = SERVER_CACHE_MAX_AGE_SEC * 1000;

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
  directCheckedIds: Set<string>;
};

type TokenPayload = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
} | null;

type BearerSession = {
  bearer: string;
  refreshed: TokenPayload;
};

type JsonRecord = Record<string, unknown>;
type InstallState = "installed" | "missing" | "unknown";

type ServerPayloadRow = JsonRecord & {
  id: string;
  name: string;
  bot_installed?: boolean;
  bot_install_state?: InstallState | string | null;
  selected?: boolean;
};

type ServerListPayload = JsonRecord & {
  ok: true;
  selectedGuildId: string;
  servers: ServerPayloadRow[];
  installedCount: number;
  manageableCount: number;
  botCheckOk: boolean;
  botCheckError: string | null;
};

type CachedServerListPayload = {
  savedAt: number;
  selectedGuildId: string;
  servers: ServerPayloadRow[];
  installedCount: number;
  manageableCount: number;
};

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

async function refreshBearer(refreshToken: string): Promise<BearerSession | null> {
  const token = normalizeString(refreshToken);
  if (!token) return null;

  try {
    const refreshed = (await refreshAccessToken(token)) as TokenPayload;
    const bearer = normalizeString(refreshed?.access_token);
    if (!bearer) return null;
    return { bearer, refreshed };
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

  const needsRefresh = !accessToken || Boolean(expiresAt && Date.now() > expiresAt - 60_000);
  if (needsRefresh) return await refreshBearer(refreshToken);

  return { bearer: accessToken, refreshed: null };
}

async function fetchUserGuildsWithRefresh(session: BearerSession): Promise<{
  session: BearerSession;
  guilds: DiscordUserGuild[];
}> {
  try {
    const guilds = (await discordUserFetch("/users/@me/guilds", session.bearer)) as DiscordUserGuild[];
    return { session, guilds: Array.isArray(guilds) ? guilds : [] };
  } catch (error) {
    const refreshToken = normalizeString(cookies().get(REFRESH_COOKIE)?.value || session.refreshed?.refresh_token);
    const retrySession = await refreshBearer(refreshToken);
    if (!retrySession) throw error;
    const guilds = (await discordUserFetch("/users/@me/guilds", retrySession.bearer)) as DiscordUserGuild[];
    return { session: retrySession, guilds: Array.isArray(guilds) ? guilds : [] };
  }
}

async function fetchBotGuilds(): Promise<BotGuildLookup> {
  if (!normalizeString(env.discordToken)) {
    return {
      ok: false,
      error: "Dashboard bot credential is missing, so bot installation could not be verified from Discord.",
      guilds: new Map(),
      directCheckedIds: new Set(),
    };
  }

  try {
    const rows = (await discordBotFetch("/users/@me/guilds")) as BotGuild[];
    const guilds = new Map(
      (Array.isArray(rows) ? rows : [])
        .map((guild) => [normalizeString(guild.id), guild] as const)
        .filter(([id]) => Boolean(id))
    );
    return { ok: true, error: null, guilds, directCheckedIds: new Set() };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Bot guild check failed.",
      guilds: new Map(),
      directCheckedIds: new Set(),
    };
  }
}

async function fetchBotGuildById(guildId: string): Promise<BotGuild | null> {
  const id = normalizeString(guildId);
  if (!id || !normalizeString(env.discordToken)) return null;

  try {
    const guild = (await discordBotFetch(`/guilds/${id}`)) as BotGuild;
    return normalizeString(guild?.id) ? guild : { id };
  } catch {
    return null;
  }
}

async function strengthenBotLookupWithDirectChecks(
  botLookup: BotGuildLookup,
  userGuilds: DiscordUserGuild[],
  forceMissingProof = false
): Promise<BotGuildLookup> {
  const candidates = userGuilds
    .map((guild) => normalizeString(guild.id))
    .filter(Boolean)
    .filter((guildId) => forceMissingProof || !botLookup.ok || !botLookup.guilds.has(guildId))
    .filter((guildId) => !botLookup.directCheckedIds.has(guildId))
    .slice(0, MAX_DIRECT_BOT_GUILD_CHECKS);

  if (!candidates.length) return botLookup;

  const nextGuilds = new Map(botLookup.guilds);
  const directCheckedIds = new Set(botLookup.directCheckedIds);

  for (const guildId of candidates) {
    directCheckedIds.add(guildId);
    const guild = await fetchBotGuildById(guildId);
    const id = normalizeString(guild?.id);
    if (id) nextGuilds.set(id, guild as BotGuild);
  }

  return { ...botLookup, guilds: nextGuilds, directCheckedIds };
}

async function fetchKnownDashboardGuildIds(guildIds: string[]): Promise<Set<string>> {
  const ids = guildIds.map(normalizeString).filter(Boolean);
  const found = new Set<string>();
  if (!ids.length) return found;

  try {
    const supabase = createServerSupabase();
    const tables = [
      "guild_members",
      "guild_roles",
      "ticket_categories",
      "tickets",
      "activity_feed_events",
      "guild_configs",
      "guild_config",
      "guild_settings",
      "server_configs",
      "dashboard_guilds",
    ];

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

function defaultErrorCode(status: number): string {
  if (status === 401) return "signed_out";
  if (status === 403) return "forbidden";
  if (status === 409) return "bot_not_installed";
  if (status === 503) return "bot_check_unknown";
  if (status >= 500) return "server_error";
  return "invalid_request";
}

function buildJsonResponse(payload: JsonRecord, status = 200, session: BearerSession | null = null) {
  const normalizedPayload = status >= 400
    ? {
        ok: false,
        ...payload,
        error_code: normalizeString(payload.error_code) || defaultErrorCode(status),
        retryable: typeof payload.retryable === "boolean" ? payload.retryable : status === 503,
      }
    : payload;

  const response = NextResponse.json(normalizedPayload, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  });
  applyAuthCookies(response, session?.refreshed || null);
  return response;
}

function safeDecodeCookieJson(value: string): unknown {
  const raw = normalizeString(value);
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(raw));
  } catch {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
}

function normalizeCachedServers(value: unknown): CachedServerListPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as JsonRecord;
  const savedAt = Number(record.savedAt || 0);
  if (!savedAt || Date.now() - savedAt > SERVER_CACHE_MAX_AGE_MS) return null;
  const rows = Array.isArray(record.servers) ? record.servers : [];
  const servers = rows
    .map((row) => (row && typeof row === "object" && !Array.isArray(row) ? (row as ServerPayloadRow) : null))
    .filter((row): row is ServerPayloadRow => Boolean(row && normalizeString(row.id) && normalizeString(row.name)))
    .map((row) => ({
      ...row,
      id: normalizeString(row.id),
      name: normalizeString(row.name),
      selected: Boolean(row.selected),
    }));

  if (!servers.length) return null;

  return {
    savedAt,
    selectedGuildId: normalizeString(record.selectedGuildId),
    servers,
    installedCount: Number(record.installedCount ?? servers.filter((server) => server.bot_installed || normalizeString(server.bot_install_state) === "installed").length),
    manageableCount: Number(record.manageableCount ?? servers.length),
  };
}

function readServerCache(): CachedServerListPayload | null {
  return normalizeCachedServers(safeDecodeCookieJson(cookies().get(SERVER_CACHE_COOKIE)?.value || ""));
}

function buildCachePayload(payload: ServerListPayload): CachedServerListPayload {
  return {
    savedAt: Date.now(),
    selectedGuildId: normalizeString(payload.selectedGuildId),
    servers: payload.servers,
    installedCount: Number(payload.installedCount || 0),
    manageableCount: Number(payload.manageableCount || payload.servers.length),
  };
}

function writeServerCache(response: NextResponse, payload: ServerListPayload): NextResponse {
  const cachePayload = buildCachePayload(payload);
  try {
    response.cookies.set(
      SERVER_CACHE_COOKIE,
      encodeURIComponent(JSON.stringify(cachePayload)),
      getGuildCookieOptions(SERVER_CACHE_MAX_AGE_SEC)
    );
  } catch {
    // A failed cache write must never block the live server list.
  }
  return response;
}

function buildCachedServerResponse(reason: string, statusSession: BearerSession | null = null): NextResponse | null {
  const cached = readServerCache();
  if (!cached) return null;
  return buildJsonResponse(
    {
      ok: true,
      cached: true,
      selectedGuildId: cached.selectedGuildId,
      servers: cached.servers,
      installedCount: cached.installedCount,
      manageableCount: cached.manageableCount,
      botCheckOk: false,
      botCheckError: reason,
    },
    200,
    statusSession
  );
}

function findCachedInstalledServer(guildId: string): ServerPayloadRow | null {
  const id = normalizeString(guildId);
  const cached = readServerCache();
  if (!id || !cached) return null;
  const server = cached.servers.find((row) => normalizeString(row.id) === id) || null;
  if (!server) return null;
  const state = normalizeString(server.bot_install_state).toLowerCase();
  return server.bot_installed || state === "installed" ? server : null;
}

function resolveInstallState(guildId: string, botLookup: BotGuildLookup, knownDashboardGuildIds: Set<string>): InstallState {
  const defaultGuildId = normalizeString(env.guildId || env.discordGuildId);

  if (botLookup.guilds.has(guildId)) return "installed";
  if (knownDashboardGuildIds.has(guildId)) return "installed";
  if (!botLookup.ok && defaultGuildId && defaultGuildId === guildId) return "installed";

  if (!botLookup.ok) return "unknown";
  if (!botLookup.directCheckedIds.has(guildId)) return "unknown";
  return "missing";
}

function inviteUrlForState(guildId: string, installState: InstallState): string | null {
  return installState === "missing" ? buildBotInviteUrl(guildId) : null;
}

export async function GET() {
  const initialSession = await getBearerSession();

  if (!initialSession) {
    const cachedResponse = buildCachedServerResponse("Using a recently verified server list while the Discord login finishes. If this stays stale, reset login once.");
    if (cachedResponse) return cachedResponse;
    return buildJsonResponse({ error: "Discord login required.", error_code: "signed_out" }, 401);
  }

  try {
    const [{ session, guilds: userGuilds }, initialBotLookup] = await Promise.all([
      fetchUserGuildsWithRefresh(initialSession),
      fetchBotGuilds(),
    ]);

    const manageableSource = userGuilds.filter(hasManageGuildPermission);
    const [knownDashboardGuildIds, botLookup] = await Promise.all([
      fetchKnownDashboardGuildIds(manageableSource.map((guild) => normalizeString(guild.id))),
      strengthenBotLookupWithDirectChecks(initialBotLookup, manageableSource, true),
    ]);
    const selectedGuildId = getSelectedGuildId();

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
          bot_invite_url: inviteUrlForState(id, installState),
          selected: selectedGuildId === id,
          is_default_env_guild: normalizeString(env.guildId || env.discordGuildId) === id,
        } as ServerPayloadRow;
      })
      .filter((guild) => guild.id)
      .sort((a, b) => {
        if (a.bot_installed !== b.bot_installed) return a.bot_installed ? -1 : 1;
        if (a.selected !== b.selected) return a.selected ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

    const payload: ServerListPayload = {
      ok: true,
      selectedGuildId,
      servers: manageable,
      installedCount: manageable.filter((guild) => guild.bot_installed).length,
      manageableCount: manageable.length,
      botCheckOk: botLookup.ok,
      botCheckError: botLookup.error,
    };

    const response = buildJsonResponse(payload, 200, session);
    writeServerCache(response, payload);
    return response;
  } catch (error) {
    const cachedResponse = buildCachedServerResponse(
      error instanceof Error
        ? `Discord temporarily rejected the live server list, so the dashboard is showing your recently verified servers instead. ${error.message}`
        : "Discord temporarily rejected the live server list, so the dashboard is showing your recently verified servers instead.",
      initialSession
    );
    if (cachedResponse) return cachedResponse;

    return buildJsonResponse(
      { error: error instanceof Error ? error.message : "Failed to load Discord servers.", error_code: "server_error" },
      500,
      initialSession
    );
  }
}

export async function POST(request: Request) {
  const initialSession = await getBearerSession();

  let requestedGuildId = "";
  try {
    const body = (await request.json().catch(() => ({}))) as JsonRecord;
    requestedGuildId = normalizeString(body.guild_id || body.guildId);
  } catch {
    requestedGuildId = "";
  }

  if (!requestedGuildId) {
    return buildJsonResponse({ error: "Server id is required.", error_code: "invalid_request" }, 400, initialSession);
  }

  if (!initialSession) {
    const cachedInstalledServer = findCachedInstalledServer(requestedGuildId);
    if (cachedInstalledServer) {
      const response = buildJsonResponse({ ok: true, selectedGuildId: requestedGuildId, selection_source: "recent_verified_server_cache" }, 200, null);
      setSelectedGuildCookie(response, requestedGuildId);
      return response;
    }
    return buildJsonResponse({ error: "Discord login required.", error_code: "signed_out" }, 401);
  }

  try {
    const [{ session, guilds: userGuilds }, initialBotLookup, knownDashboardGuildIds] = await Promise.all([
      fetchUserGuildsWithRefresh(initialSession),
      fetchBotGuilds(),
      fetchKnownDashboardGuildIds([requestedGuildId]),
    ]);

    const userGuild = userGuilds.find((guild) => normalizeString(guild.id) === requestedGuildId);

    if (!userGuild || !hasManageGuildPermission(userGuild)) {
      const cachedInstalledServer = findCachedInstalledServer(requestedGuildId);
      if (cachedInstalledServer) {
        const response = buildJsonResponse({ ok: true, selectedGuildId: requestedGuildId, selection_source: "recent_verified_server_cache" }, 200, session);
        setSelectedGuildCookie(response, requestedGuildId);
        return response;
      }

      return buildJsonResponse(
        { error: "You need Manage Server or Administrator permission for that server.", error_code: "forbidden" },
        403,
        session
      );
    }

    const botLookup = await strengthenBotLookupWithDirectChecks(initialBotLookup, [userGuild], true);
    const installState = resolveInstallState(requestedGuildId, botLookup, knownDashboardGuildIds);

    if (installState !== "installed") {
      const cachedInstalledServer = findCachedInstalledServer(requestedGuildId);
      if (installState === "unknown" && cachedInstalledServer) {
        const response = buildJsonResponse({ ok: true, selectedGuildId: requestedGuildId, selection_source: "recent_verified_server_cache" }, 200, session);
        setSelectedGuildCookie(response, requestedGuildId);
        return response;
      }

      const inviteUrl = inviteUrlForState(requestedGuildId, installState);
      return buildJsonResponse(
        {
          error:
            installState === "unknown"
              ? "The dashboard could not verify bot access for that server. No invite action was shown because this may be a temporary Discord check failure. Wait a moment, then recheck."
              : "Dank Shield is not installed in that server yet.",
          error_code: installState === "unknown" ? "bot_check_unknown" : "bot_not_installed",
          retryable: installState === "unknown",
          bot_install_state: installState,
          bot_invite_url: inviteUrl,
          bot_check_error: botLookup.error,
        },
        installState === "unknown" ? 503 : 409,
        session
      );
    }

    const response = buildJsonResponse({ ok: true, selectedGuildId: requestedGuildId }, 200, session);
    setSelectedGuildCookie(response, requestedGuildId);
    return response;
  } catch (error) {
    const cachedInstalledServer = findCachedInstalledServer(requestedGuildId);
    if (cachedInstalledServer) {
      const response = buildJsonResponse(
        {
          ok: true,
          selectedGuildId: requestedGuildId,
          selection_source: "recent_verified_server_cache",
          warning: error instanceof Error ? error.message : "Discord temporarily rejected the live selection check.",
        },
        200,
        initialSession
      );
      setSelectedGuildCookie(response, requestedGuildId);
      return response;
    }

    return buildJsonResponse(
      { error: error instanceof Error ? error.message : "Failed to select server.", error_code: "server_error" },
      500,
      initialSession
    );
  }
}

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { discordBotFetch, discordUserFetch } from "@/lib/discord-api";
import { getSession } from "@/lib/auth-server";
import {
  getSelectedGuildId,
  setSelectedGuildCookie,
} from "@/lib/guild-selection";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ACCESS_COOKIE = "discord_access_token";
const MANAGE_GUILD = BigInt(1 << 5);
const ADMINISTRATOR = BigInt(1 << 3);

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

async function fetchBotGuilds(): Promise<Map<string, BotGuild>> {
  try {
    const rows = (await discordBotFetch("/users/@me/guilds")) as BotGuild[];
    return new Map((Array.isArray(rows) ? rows : []).map((guild) => [normalizeString(guild.id), guild]));
  } catch {
    return new Map();
  }
}

function buildJsonResponse(payload: JsonRecord, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  });
}

export async function GET() {
  const session = await getSession();
  const accessToken = normalizeString(cookies().get(ACCESS_COOKIE)?.value);

  if (!session || !accessToken) {
    return buildJsonResponse({ error: "Discord login required." }, 401);
  }

  try {
    const [userGuildsRaw, botGuilds] = await Promise.all([
      discordUserFetch("/users/@me/guilds", accessToken) as Promise<DiscordUserGuild[]>,
      fetchBotGuilds(),
    ]);

    const userGuilds = Array.isArray(userGuildsRaw) ? userGuildsRaw : [];
    const selectedGuildId = getSelectedGuildId();
    const manageable = userGuilds
      .filter(hasManageGuildPermission)
      .map((guild) => {
        const id = normalizeString(guild.id);
        const botGuild = botGuilds.get(id);
        const installed = Boolean(botGuild);
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
    });
  } catch (error) {
    return buildJsonResponse(
      {
        error: error instanceof Error ? error.message : "Failed to load Discord servers.",
      },
      500
    );
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  const accessToken = normalizeString(cookies().get(ACCESS_COOKIE)?.value);

  if (!session || !accessToken) {
    return buildJsonResponse({ error: "Discord login required." }, 401);
  }

  try {
    const body = (await request.json().catch(() => ({}))) as JsonRecord;
    const requestedGuildId = normalizeString(body.guild_id || body.guildId);
    if (!requestedGuildId) {
      return buildJsonResponse({ error: "Server id is required." }, 400);
    }

    const [userGuildsRaw, botGuilds] = await Promise.all([
      discordUserFetch("/users/@me/guilds", accessToken) as Promise<DiscordUserGuild[]>,
      fetchBotGuilds(),
    ]);

    const userGuild = (Array.isArray(userGuildsRaw) ? userGuildsRaw : []).find(
      (guild) => normalizeString(guild.id) === requestedGuildId
    );

    if (!userGuild || !hasManageGuildPermission(userGuild)) {
      return buildJsonResponse(
        { error: "You need Manage Server or Administrator permission for that server." },
        403
      );
    }

    if (!botGuilds.has(requestedGuildId)) {
      return buildJsonResponse(
        { error: "Dank Shield is not installed in that server yet." },
        409
      );
    }

    const response = buildJsonResponse({ ok: true, selectedGuildId: requestedGuildId });
    setSelectedGuildCookie(response, requestedGuildId);
    return response;
  } catch (error) {
    return buildJsonResponse(
      {
        error: error instanceof Error ? error.message : "Failed to select server.",
      },
      500
    );
  }
}

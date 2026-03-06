import "server-only";

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

type RoleInfo = { id: string; name: string; color?: number | null };
type ResolvedUser = {
  id: string;
  displayName: string;
  username?: string | null;
  avatarUrl?: string | null;
  roleIds: string[];
  roles: RoleInfo[];
};

const TTL_MS = 5 * 60 * 1000;

let _rolesCache:
  | { at: number; guildId: string; roles: RoleInfo[]; roleById: Record<string, RoleInfo> }
  | null = null;

function pickEnv(...keys: string[]) {
  for (const k of keys) {
    const v = (process.env[k] || "").trim();
    if (v) return v;
  }
  return "";
}

function avatarUrlFor(id: string, avatarHash?: string | null) {
  if (avatarHash) return `https://cdn.discordapp.com/avatars/${id}/${avatarHash}.png?size=128`;
  return `https://cdn.discordapp.com/embed/avatars/${Number(id) % 6}.png`;
}

async function discordGET(path: string, botToken: string) {
  const r = await fetch(`https://discord.com/api/v10${path}`, {
    headers: {
      authorization: `Bot ${botToken}`,
      "user-agent": "stoney-verify-dashboard (vercel)",
    },
    cache: "no-store",
  });
  return r;
}

async function getGuildRoles(guildId: string, botToken: string) {
  const now = Date.now();
  if (_rolesCache && _rolesCache.guildId === guildId && now - _rolesCache.at < TTL_MS) return _rolesCache;

  const r = await discordGET(`/guilds/${guildId}/roles`, botToken);
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`Discord roles fetch failed (${r.status}): ${txt || r.statusText}`);
  }
  const roles = (await r.json()) as any[];
  const norm: RoleInfo[] = roles
    .map((x) => ({
      id: String(x.id),
      name: String(x.name),
      color: typeof x.color === "number" ? x.color : null,
    }))
    .sort((a, b) => (a.name === "@everyone" ? 1 : 0) - (b.name === "@everyone" ? 1 : 0));

  const roleById: Record<string, RoleInfo> = {};
  for (const rr of norm) roleById[rr.id] = rr;

  _rolesCache = { at: now, guildId, roles: norm, roleById };
  return _rolesCache;
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { ids?: string[]; guildId?: string | null } | null;
  const ids = Array.isArray(body?.ids) ? body!.ids.map(String) : [];
  if (!ids.length) return NextResponse.json({ ok: true, users: {} });

  const botToken = pickEnv("DISCORD_BOT_TOKEN", "DISCORD_TOKEN", "BOT_TOKEN");
  if (!botToken) {
    return NextResponse.json({ ok: false, error: "Missing DISCORD_BOT_TOKEN env var on Vercel" }, { status: 500 });
  }

  const guildId = String((session as any).guildId || body?.guildId || pickEnv("GUILD_ID", "DISCORD_GUILD_ID") || "");
  if (!guildId) {
    return NextResponse.json({ ok: false, error: "Missing guildId" }, { status: 400 });
  }

  const roleCache = await getGuildRoles(guildId, botToken);

  const users: Record<string, ResolvedUser> = {};
  for (const id of ids) {
    const uid = String(id || "").trim();
    if (!uid) continue;

    const r = await discordGET(`/guilds/${guildId}/members/${uid}`, botToken);
    if (r.status === 404) continue;
    if (!r.ok) continue;

    const m = (await r.json()) as any;
    const u = m?.user || {};
    const username = u?.username ? String(u.username) : null;
    const displayName =
      (u?.global_name ? String(u.global_name) : null) ||
      username ||
      `@${uid.slice(0, 4)}…${uid.slice(-4)}`;
    const avatarUrl = avatarUrlFor(uid, u?.avatar ? String(u.avatar) : null);

    const roleIds = Array.isArray(m?.roles) ? (m.roles as any[]).map((x) => String(x)) : [];
    const roles: RoleInfo[] = roleIds.map((rid) => roleCache.roleById[rid]).filter(Boolean);

    users[uid] = { id: uid, displayName, username, avatarUrl, roleIds, roles };
  }

  return NextResponse.json({ ok: true, guildId, users });
}

export async function GET() {
  return NextResponse.json({ ok: false, error: "Use POST" }, { status: 405 });
}

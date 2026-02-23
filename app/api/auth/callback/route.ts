import { NextResponse } from "next/server";
import { mustGet } from "@/lib/env";
import { setSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type DiscordTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
};

type DiscordUser = {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
};

async function exchangeCodeForToken(code: string): Promise<DiscordTokenResponse> {
  const clientId = mustGet("DISCORD_CLIENT_ID");
  const clientSecret = mustGet("DISCORD_CLIENT_SECRET");
  const redirectUri = mustGet("DISCORD_REDIRECT_URI");

  const body = new URLSearchParams();
  body.set("client_id", clientId);
  body.set("client_secret", clientSecret);
  body.set("grant_type", "authorization_code");
  body.set("code", code);
  body.set("redirect_uri", redirectUri);

  const res = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Token exchange failed: ${res.status} ${txt}`);
  }

  return (await res.json()) as DiscordTokenResponse;
}

async function fetchDiscordUser(accessToken: string): Promise<DiscordUser> {
  const res = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Fetch user failed: ${res.status} ${txt}`);
  }
  return (await res.json()) as DiscordUser;
}

async function fetchMemberRoles(accessToken: string, guildId: string): Promise<string[]> {
  const res = await fetch(`https://discord.com/api/users/@me/guilds/${guildId}/member`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { roles?: string[] };
  return Array.isArray(data.roles) ? data.roles.map(String) : [];
}

function parseAllowedRoleIds(): string[] {
  const raw = (process.env.STAFF_ROLE_IDS || "").trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function isStaffByRoles(memberRoleIds: string[], allowedStaffRoleIds: string[]): boolean {
  if (!allowedStaffRoleIds.length) return false;
  const set = new Set(memberRoleIds.map(String));
  return allowedStaffRoleIds.some((rid) => set.has(String(rid)));
}

async function auditStaffLogin(userId: string, token?: string | null) {
  const sb = getSupabaseAdmin();
  if (!sb) return;

  // Your schema: audit_logs(action, token, staff_id, meta, created_at)
  await sb.from("audit_logs").insert([
    {
      action: "staff_login",
      token: token ?? null,
      staff_id: userId,
      meta: {},
    },
  ]);
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    if (error) {
      return NextResponse.redirect(new URL(`/login?err=${encodeURIComponent(error)}`, url.origin));
    }
    if (!code) {
      return NextResponse.redirect(new URL(`/login?err=${encodeURIComponent("missing_code")}`, url.origin));
    }

    const guildId = mustGet("DISCORD_GUILD_ID");
    const allowedStaffRoleIds = parseAllowedRoleIds();
    if (!allowedStaffRoleIds.length) {
      return NextResponse.redirect(new URL(`/login?err=${encodeURIComponent("notstaff")}`, url.origin));
    }

    const token = await exchangeCodeForToken(code);
    const user = await fetchDiscordUser(token.access_token);
    const memberRoles = await fetchMemberRoles(token.access_token, guildId);

    if (!isStaffByRoles(memberRoles, allowedStaffRoleIds)) {
      return NextResponse.redirect(new URL(`/login?err=${encodeURIComponent("notstaff")}`, url.origin));
    }

    await setSession({
      userId: user.id,
      username: user.global_name || user.username,
      roles: memberRoles,
      avatar: user.avatar ?? null,
      guildId: guildId || null,
      id: user.id,
      sub: user.id,
    });

    await auditStaffLogin(user.id, null);

    return NextResponse.redirect(new URL("/dashboard", url.origin));
  } catch (e: any) {
    const msg = encodeURIComponent(String(e?.message || e || "callback_error"));
    return NextResponse.redirect(new URL(`/login?err=${msg}`, new URL(req.url).origin));
  }
}

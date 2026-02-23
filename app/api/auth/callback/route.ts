// app/api/auth/callback/route.ts
import { NextResponse } from "next/server";
import { setSessionCookie, StaffSession } from "@/lib/session";

function mustGet(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

async function exchangeCodeForToken(code: string) {
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
    throw new Error(`Discord token exchange failed (${res.status}): ${txt}`);
  }

  return res.json() as Promise<{ access_token: string; token_type: string; expires_in: number }>;
}

async function fetchDiscordUser(accessToken: string) {
  const res = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Discord /users/@me failed (${res.status}): ${txt}`);
  }

  return res.json() as Promise<{ id: string; username: string; avatar?: string | null }>;
}

async function fetchGuildMember(accessToken: string, guildId: string) {
  const res = await fetch(`https://discord.com/api/users/@me/guilds/${guildId}/member`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    // If user isn't in guild, Discord returns 404
    throw new Error(`Discord guild member lookup failed (${res.status}): ${txt}`);
  }

  return res.json() as Promise<{ roles?: string[] }>;
}

function parseStaffRoleIds(): Set<string> {
  const raw = (process.env.DISCORD_STAFF_ROLE_IDS || "").trim();
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return new Set(ids);
}

function isStaff(memberRoles: string[], staffRoleIds: Set<string>): boolean {
  if (!staffRoleIds.size) return false;
  return memberRoles.some((r) => staffRoleIds.has(String(r)));
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state") || "";
    const nextPath = decodeURIComponent(state || "") || "/dashboard";

    if (!code) {
      return NextResponse.redirect(new URL("/?error=missing_code", url.origin));
    }

    const guildId = mustGet("DISCORD_GUILD_ID");
    const staffRoleIds = parseStaffRoleIds();

    const token = await exchangeCodeForToken(code);
    const user = await fetchDiscordUser(token.access_token);

    const member = await fetchGuildMember(token.access_token, guildId);
    const roles = (member.roles || []).map(String);

    if (!isStaff(roles, staffRoleIds)) {
      // Not staff => no session
      return NextResponse.redirect(new URL("/?error=not_staff", url.origin));
    }

    const now = Math.floor(Date.now() / 1000);
    const session: StaffSession = {
      userId: user.id,
      username: user.username,
      avatar: user.avatar ?? null,
      roles,
      guildId,
      iat: now,
      exp: now + 60 * 60 * 8, // 8 hours
    };

    // ✅ Cookie MUST be set on the response we return
    const res = NextResponse.redirect(new URL(nextPath.startsWith("/") ? nextPath : "/dashboard", url.origin));
    setSessionCookie(res, session);
    return res;
  } catch (e: any) {
    const msg = encodeURIComponent(String(e?.message || e || "callback_error"));
    const origin = new URL(req.url).origin;
    return NextResponse.redirect(`${origin}/?error=${msg}`);
  }
}

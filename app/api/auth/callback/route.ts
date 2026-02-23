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
  const res = await fetch(
    `https://discord.com/api/users/@me/guilds/${guildId}/member`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("Member fetch failed:", res.status, txt);
    return [];
  }

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
  const memberSet = new Set(memberRoleIds.map(String));
  return allowedStaffRoleIds.some((rid) => memberSet.has(String(rid)));
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
      return NextResponse.redirect(new URL(`/login?err=missing_code`, url.origin));
    }

    const token = await exchangeCodeForToken(code);
    const user = await fetchDiscordUser(token.access_token);

    const guildId = mustGet("DISCORD_GUILD_ID");
    const allowedStaffRoleIds = parseAllowedRoleIds();

    const memberRoles = await fetchMemberRoles(token.access_token, guildId);

    console.log("User:", user.id);
    console.log("Member roles:", memberRoles);
    console.log("Allowed staff roles:", allowedStaffRoleIds);

    if (!isStaffByRoles(memberRoles, allowedStaffRoleIds)) {
      return NextResponse.redirect(new URL(`/login?err=not_staff`, url.origin));
    }

    await setSession({
      userId: user.id,
      username: user.global_name || user.username,
      roles: memberRoles,
      avatar: user.avatar ?? null,
      guildId,
    });

    try {
      const sb = getSupabaseAdmin();
      if (sb) {
        await sb.from("audit_logs").insert([
          {
            at: new Date().toISOString(),
            actor_id: user.id,
            actor_name: user.global_name || user.username,
            action: "staff_login",
            meta: {},
          },
        ]);
      }
    } catch (err) {
      console.warn("Audit insert failed:", err);
    }

    return NextResponse.redirect(new URL("/dashboard", url.origin));
  } catch (e: any) {
    console.error("OAuth callback error:", e);
    return NextResponse.redirect(
      new URL(`/login?err=${encodeURIComponent(e?.message || "callback_error")}`, new URL(req.url).origin)
    );
  }
}

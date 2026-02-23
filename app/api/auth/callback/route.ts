import { NextResponse } from "next/server";
import { exchangeCode, discordMe, discordGuildMember } from "@/lib/discord";
import { setSession } from "@/lib/session";
import { getCsv, mustGet } from "@/lib/env";

function parseState(state: string | null) {
  if (!state) return "/dashboard";
  const parts = state.split(":");
  if (parts.length < 2) return "/dashboard";
  try {
    return Buffer.from(parts.slice(1).join(":"), "base64url").toString("utf8") || "/dashboard";
  } catch {
    return "/dashboard";
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const nextPath = parseState(state);

  if (!code) return NextResponse.redirect(new URL("/?error=missing_code", url.origin));

  try {
    const tok = await exchangeCode(code);
    const me = await discordMe(tok.access_token);

    const guildId = mustGet("DISCORD_GUILD_ID");
    const member = await discordGuildMember(tok.access_token, guildId);
    const roles = (member.roles || []).map(String);

    const staffRoleIds = getCsv("DISCORD_STAFF_ROLE_IDS");
    const isStaff = staffRoleIds.some((rid) => roles.includes(rid));

    if (!isStaff) {
      return NextResponse.redirect(new URL("/?error=not_staff", url.origin));
    }

    const username = `${me.username}#${me.discriminator}`;
    await setSession({ sub: me.id, username, roles });

    const dest = nextPath.startsWith("/") ? nextPath : "/dashboard";
    return NextResponse.redirect(new URL(dest, url.origin));
  } catch (e: any) {
    return NextResponse.redirect(new URL(`/?error=oauth_failed`, url.origin));
  }
}

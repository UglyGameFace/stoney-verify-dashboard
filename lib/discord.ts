import { mustGet } from "@/lib/env";

export function discordAuthUrl(state: string) {
  const clientId = mustGet("DISCORD_CLIENT_ID");
  const redirect = mustGet("DISCORD_REDIRECT_URI");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirect,
    response_type: "code",
    scope: "identify guilds.members.read",
    state,
    prompt: "none",
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

export async function exchangeCode(code: string) {
  const clientId = mustGet("DISCORD_CLIENT_ID");
  const clientSecret = mustGet("DISCORD_CLIENT_SECRET");
  const redirect = mustGet("DISCORD_REDIRECT_URI");

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirect,
  });

  const r = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  if (!r.ok) throw new Error(`Discord token exchange failed: ${r.status}`);
  return (await r.json()) as { access_token: string; token_type: string; expires_in: number; scope: string };
}

export async function discordMe(accessToken: string) {
  const r = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`Discord /users/@me failed: ${r.status}`);
  return (await r.json()) as { id: string; username: string; discriminator: string };
}

export async function discordGuildMember(accessToken: string, guildId: string) {
  // Uses OAuth2 token with guilds.members.read
  const r = await fetch(`https://discord.com/api/users/@me/guilds/${guildId}/member`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`Discord guild member lookup failed: ${r.status}`);
  return (await r.json()) as { roles: string[]; nick?: string; joined_at?: string; user?: any };
}

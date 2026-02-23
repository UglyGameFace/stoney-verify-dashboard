// app/api/auth/login/route.ts
import { NextResponse } from "next/server";

function mustGet(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  const clientId = mustGet("DISCORD_CLIENT_ID");
  const redirectUri = mustGet("DISCORD_REDIRECT_URI");

  // optional "next" path (where to land after login)
  const nextPath = url.searchParams.get("next") || "/dashboard";

  // Discord OAuth2 authorize URL
  const auth = new URL("https://discord.com/api/oauth2/authorize");
  auth.searchParams.set("client_id", clientId);
  auth.searchParams.set("redirect_uri", redirectUri);
  auth.searchParams.set("response_type", "code");
  auth.searchParams.set("scope", "identify guilds.members.read");

  // Pass next through state (simple + safe enough for internal tool)
  // If you want extra-hard security later, we can sign/verify state.
  auth.searchParams.set("state", encodeURIComponent(nextPath));

  return NextResponse.redirect(auth.toString());
}

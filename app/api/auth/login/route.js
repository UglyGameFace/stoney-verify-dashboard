import { NextResponse } from "next/server"
import { getDiscordLoginUrl } from "@/lib/auth-server"
import { env } from "@/lib/env"

export async function GET() {
  if (!env.discordClientId || !env.discordRedirectUri) {
    return NextResponse.json({ error: "Missing Discord OAuth configuration." }, { status: 500 })
  }
  return NextResponse.redirect(getDiscordLoginUrl())
}

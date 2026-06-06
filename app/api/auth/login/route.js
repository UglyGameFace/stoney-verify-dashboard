import { NextResponse } from "next/server"
import { getDiscordLoginUrl } from "@/lib/auth-server"
import { env } from "@/lib/env"
import { normalizeAuthReturnTo } from "@/lib/auth-return"
import { createSignedOAuthState } from "@/lib/oauth-state"

export async function GET(request) {
  if (!env.discordClientId || !env.discordRedirectUri) {
    return NextResponse.json({ error: "Missing Discord OAuth configuration." }, { status: 500 })
  }

  const url = new URL(request.url)
  const referrer = request.headers.get("referer") || ""
  let referrerPath = ""

  try {
    if (referrer) {
      const referrerUrl = new URL(referrer)
      if (referrerUrl.origin === url.origin) {
        referrerPath = `${referrerUrl.pathname}${referrerUrl.search}${referrerUrl.hash}`
      }
    }
  } catch {
    referrerPath = ""
  }

  const returnTo = normalizeAuthReturnTo(
    url.searchParams.get("return_to") || url.searchParams.get("next") || referrerPath,
    "/auth-status"
  )

  const discordUrl = new URL(getDiscordLoginUrl())
  discordUrl.searchParams.set("state", createSignedOAuthState(returnTo))

  return NextResponse.redirect(discordUrl)
}

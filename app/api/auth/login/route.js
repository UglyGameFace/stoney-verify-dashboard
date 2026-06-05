import { NextResponse } from "next/server"
import { getDiscordLoginUrl, getCookieOptions } from "@/lib/auth-server"
import { env } from "@/lib/env"
import {
  AUTH_RETURN_TO_COOKIE,
  OAUTH_STATE_COOKIE,
  createOAuthState,
  normalizeAuthReturnTo,
} from "@/lib/auth-return"

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
  const state = createOAuthState()
  const discordUrl = new URL(getDiscordLoginUrl())
  discordUrl.searchParams.set("state", state)

  const response = NextResponse.redirect(discordUrl)
  response.cookies.set(OAUTH_STATE_COOKIE, state, getCookieOptions(10 * 60))
  response.cookies.set(AUTH_RETURN_TO_COOKIE, returnTo, getCookieOptions(10 * 60))
  return response
}

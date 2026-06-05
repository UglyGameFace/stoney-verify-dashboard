import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { exchangeCodeForToken, applyAuthCookies, getCookieOptions } from "@/lib/auth-server"
import { dashboardRedirectUrl, authErrorRedirectUrl } from "@/lib/auth-redirect"
import {
  AUTH_RETURN_TO_COOKIE,
  OAUTH_STATE_COOKIE,
  normalizeAuthReturnTo,
} from "@/lib/auth-return"

function clearTemporaryAuthCookies(response) {
  response.cookies.set(OAUTH_STATE_COOKIE, "", getCookieOptions(0))
  response.cookies.set(AUTH_RETURN_TO_COOKIE, "", getCookieOptions(0))
  return response
}

export async function GET(request) {
  try {
    const url = new URL(request.url)
    const code = url.searchParams.get("code")
    const oauthError = url.searchParams.get("error")
    const state = url.searchParams.get("state") || ""
    const cookieStore = cookies()
    const expectedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value || ""
    const returnTo = normalizeAuthReturnTo(
      cookieStore.get(AUTH_RETURN_TO_COOKIE)?.value,
      "/auth-status"
    )

    if (oauthError) {
      const response = NextResponse.redirect(authErrorRedirectUrl(request, oauthError))
      return clearTemporaryAuthCookies(response)
    }

    if (!code) {
      const response = NextResponse.redirect(authErrorRedirectUrl(request, "missing_discord_oauth_code"))
      return clearTemporaryAuthCookies(response)
    }

    if (!state || !expectedState || state !== expectedState) {
      const response = NextResponse.redirect(authErrorRedirectUrl(request, "invalid_discord_oauth_state"))
      return clearTemporaryAuthCookies(response)
    }

    const token = await exchangeCodeForToken(code)
    const response = NextResponse.redirect(dashboardRedirectUrl(request, returnTo))
    applyAuthCookies(response, token)
    clearTemporaryAuthCookies(response)
    return response
  } catch (error) {
    const response = NextResponse.redirect(
      authErrorRedirectUrl(request, error?.message || "oauth_failed")
    )
    return clearTemporaryAuthCookies(response)
  }
}

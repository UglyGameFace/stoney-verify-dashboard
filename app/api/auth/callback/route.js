import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import {
  exchangeCodeForToken,
  applyAuthCookies,
  getCookieOptions,
  getSession,
} from "@/lib/auth-server"
import { dashboardRedirectUrl, authErrorRedirectUrl } from "@/lib/auth-redirect"
import {
  AUTH_RETURN_TO_COOKIE,
  OAUTH_STATE_COOKIE,
  normalizeAuthReturnTo,
} from "@/lib/auth-return"

function parseStateCookie(value) {
  return String(value || "")
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean)
}

function clearTemporaryAuthCookies(response) {
  response.cookies.set(OAUTH_STATE_COOKIE, "", getCookieOptions(0))
  response.cookies.set(AUTH_RETURN_TO_COOKIE, "", getCookieOptions(0))
  return response
}

async function redirectExistingSessionOrError(request, returnTo, errorMessage) {
  const existingSession = await getSession()

  if (existingSession) {
    const response = NextResponse.redirect(dashboardRedirectUrl(request, returnTo))
    return clearTemporaryAuthCookies(response)
  }

  const response = NextResponse.redirect(authErrorRedirectUrl(request, errorMessage))
  return clearTemporaryAuthCookies(response)
}

export async function GET(request) {
  try {
    const url = new URL(request.url)
    const code = url.searchParams.get("code")
    const oauthError = url.searchParams.get("error")
    const state = url.searchParams.get("state") || ""
    const cookieStore = cookies()
    const expectedStates = parseStateCookie(cookieStore.get(OAUTH_STATE_COOKIE)?.value || "")
    const hasStateCheck = Boolean(state || expectedStates.length)
    const returnTo = normalizeAuthReturnTo(
      cookieStore.get(AUTH_RETURN_TO_COOKIE)?.value,
      "/auth-status"
    )

    if (oauthError) {
      return await redirectExistingSessionOrError(request, returnTo, oauthError)
    }

    if (!code) {
      return await redirectExistingSessionOrError(request, returnTo, "missing_discord_oauth_code")
    }

    if (hasStateCheck && (!state || !expectedStates.includes(state))) {
      return await redirectExistingSessionOrError(request, returnTo, "invalid_discord_oauth_state")
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

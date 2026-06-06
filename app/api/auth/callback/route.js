import { NextResponse } from "next/server"
import {
  exchangeCodeForToken,
  applyAuthCookies,
  getSession,
} from "@/lib/auth-server"
import { dashboardRedirectUrl, authErrorRedirectUrl } from "@/lib/auth-redirect"
import { verifySignedOAuthState } from "@/lib/oauth-state"

async function redirectExistingSessionOrError(request, returnTo, errorMessage) {
  const existingSession = await getSession()

  if (existingSession) {
    return NextResponse.redirect(dashboardRedirectUrl(request, returnTo))
  }

  return NextResponse.redirect(authErrorRedirectUrl(request, errorMessage))
}

export async function GET(request) {
  try {
    const url = new URL(request.url)
    const code = url.searchParams.get("code")
    const oauthError = url.searchParams.get("error")
    const stateResult = verifySignedOAuthState(url.searchParams.get("state") || "")
    const returnTo = stateResult.returnTo || "/auth-status"

    if (oauthError) {
      return await redirectExistingSessionOrError(request, returnTo, oauthError)
    }

    if (!code) {
      return await redirectExistingSessionOrError(request, returnTo, "missing_discord_oauth_code")
    }

    if (!stateResult.ok) {
      return await redirectExistingSessionOrError(request, returnTo, stateResult.error || "invalid_discord_oauth_state")
    }

    const token = await exchangeCodeForToken(code)
    const response = NextResponse.redirect(dashboardRedirectUrl(request, returnTo))
    applyAuthCookies(response, token)
    return response
  } catch (error) {
    return NextResponse.redirect(authErrorRedirectUrl(request, error?.message || "oauth_failed"))
  }
}

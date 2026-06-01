import { NextResponse } from "next/server"
import { exchangeCodeForToken, applyAuthCookies } from "@/lib/auth-server"
import { dashboardRedirectUrl, authErrorRedirectUrl } from "@/lib/auth-redirect"

export async function GET(request) {
  try {
    const url = new URL(request.url)
    const code = url.searchParams.get("code")
    const oauthError = url.searchParams.get("error")

    if (oauthError) {
      return NextResponse.redirect(authErrorRedirectUrl(request, oauthError))
    }

    if (!code) {
      return NextResponse.redirect(authErrorRedirectUrl(request, "missing_discord_oauth_code"))
    }

    const token = await exchangeCodeForToken(code)
    const response = NextResponse.redirect(dashboardRedirectUrl(request, "/auth-status"))
    applyAuthCookies(response, token)
    return response
  } catch (error) {
    return NextResponse.redirect(
      authErrorRedirectUrl(request, error?.message || "oauth_failed")
    )
  }
}

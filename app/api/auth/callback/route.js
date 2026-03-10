import { NextResponse } from "next/server"
import { exchangeCodeForToken, applyAuthCookies } from "@/lib/auth-server"
import { env } from "@/lib/env"

export async function GET(request) {
  try {
    const url = new URL(request.url)
    const code = url.searchParams.get("code")
    const oauthError = url.searchParams.get("error")
    if (oauthError) {
      return NextResponse.redirect(new URL(`/?authError=${encodeURIComponent(oauthError)}`, env.appUrl))
    }
    if (!code) {
      return NextResponse.redirect(new URL("/", env.appUrl))
    }

    const token = await exchangeCodeForToken(code)
    const response = NextResponse.redirect(new URL("/", env.appUrl))
    applyAuthCookies(response, token)
    return response
  } catch (error) {
    return NextResponse.redirect(new URL(`/?authError=${encodeURIComponent(error.message || "oauth_failed")}`, env.appUrl))
  }
}

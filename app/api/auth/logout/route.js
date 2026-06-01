import { NextResponse } from "next/server"
import { clearAuthCookies } from "@/lib/auth-server"
import { clearSelectedGuildCookie } from "@/lib/guild-selection"

export async function GET(request) {
  const url = new URL(request.url)
  const response = NextResponse.redirect(new URL("/", url.origin))
  clearAuthCookies(response)
  clearSelectedGuildCookie(response)
  return response
}

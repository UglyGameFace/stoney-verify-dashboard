import { NextResponse } from "next/server"
import { clearAuthCookies } from "@/lib/auth-server"
import { env } from "@/lib/env"

export async function GET() {
  const response = NextResponse.redirect(new URL("/", env.appUrl))
  clearAuthCookies(response)
  return response
}

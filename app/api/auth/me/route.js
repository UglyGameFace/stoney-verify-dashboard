import { NextResponse } from "next/server"
import { getSession, requireStaffSessionForRoute, applyAuthCookies } from "@/lib/auth-server"

export async function GET() {
  try {
    const result = await requireStaffSessionForRoute()
    const response = NextResponse.json({ session: result.session })
    applyAuthCookies(response, result.refreshedTokens)
    return response
  } catch {
    const session = await getSession()
    return NextResponse.json({ session })
  }
}

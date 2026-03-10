import { NextResponse } from "next/server"
import { createServerSupabase } from "@/lib/supabase-server"
import { requireStaffSessionForRoute, applyAuthCookies } from "@/lib/auth-server"

export async function POST() {
  try {
    const { refreshedTokens } = await requireStaffSessionForRoute()
    const supabase = createServerSupabase()
    const cutoff10 = new Date(Date.now() - 10 * 1000).toISOString()
    const cutoff30 = new Date(Date.now() - 30 * 1000).toISOString()

    const [last10, last30] = await Promise.all([
      supabase.from("member_joins").select("*", { head: true, count: "exact" }).gte("joined_at", cutoff10),
      supabase.from("member_joins").select("*", { head: true, count: "exact" }).gte("joined_at", cutoff30)
    ])

    let severity = null
    if ((last10.count || 0) >= 5) severity = "warning"
    if ((last30.count || 0) >= 15) severity = "critical"

    if (severity) {
      await supabase.from("raid_events").insert({
        guild_id: process.env.GUILD_ID || "demo",
        join_count: Math.max(last10.count || 0, last30.count || 0),
        window_seconds: severity === "critical" ? 30 : 10,
        severity,
        summary: `${severity} raid alert triggered from join velocity`
      })
    }

    const response = NextResponse.json({
      last10s: last10.count || 0,
      last30s: last30.count || 0,
      severity
    })
    applyAuthCookies(response, refreshedTokens)
    return response
  } catch (error) {
    return NextResponse.json({ error: error.message || "Unauthorized" }, { status: 401 })
  }
}

import { NextResponse } from "next/server"
import { createServerSupabase } from "@/lib/supabase-server"
import { requireStaffSessionForRoute, applyAuthCookies } from "@/lib/auth-server"

export async function POST(request, { params }) {
  try {
    const { session, refreshedTokens } = await requireStaffSessionForRoute()
    const supabase = createServerSupabase()
    const staffName = session.user.username

    const { data, error } = await supabase
      .from("tickets")
      .update({
        claimed_by: staffName,
        status: "claimed",
        updated_at: new Date().toISOString()
      })
      .eq("id", params.id)
      .select("*")
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await Promise.all([
      supabase.from("audit_events").insert({
        title: "Ticket claimed",
        description: `${staffName} claimed ticket ${params.id}`,
        event_type: "ticket_claimed",
        related_id: params.id
      }),
      supabase.from("staff_metrics").upsert({
        guild_id: data.guild_id,
        staff_id: session.user.id,
        staff_name: staffName,
        last_active: new Date().toISOString()
      }, { onConflict: "guild_id,staff_id" })
    ])

    const response = NextResponse.json({ ticket: data })
    applyAuthCookies(response, refreshedTokens)
    return response
  } catch (error) {
    return NextResponse.json({ error: error.message || "Unauthorized" }, { status: 401 })
  }
}

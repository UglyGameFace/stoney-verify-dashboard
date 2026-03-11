import { NextResponse } from "next/server"
import { createServerSupabase } from "@/lib/supabase-server"
import { requireStaffSessionForRoute, applyAuthCookies } from "@/lib/auth-server"

export const dynamic = "force-dynamic"

export async function POST(request, { params }) {
  try {
    const { session, refreshedTokens } = await requireStaffSessionForRoute()
    const body = await request.json()
    const staffName = session.user.username
    const supabase = createServerSupabase()

    const { data, error } = await supabase
      .from("tickets")
      .update({
        status: "closed",
        closed_by: staffName,
        closed_reason: body.reason || "Closed by staff",
        closed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", params.id)
      .select("*")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const { data: metric } = await supabase
      .from("staff_metrics")
      .select("*")
      .eq("guild_id", data.guild_id)
      .eq("staff_id", session.user.id)
      .maybeSingle()

    await Promise.all([
      supabase.from("audit_events").insert({
        title: "Ticket closed",
        description: `${staffName} closed ticket ${params.id}`,
        event_type: "ticket_closed",
        related_id: params.id
      }),
      supabase.from("staff_metrics").upsert(
        {
          guild_id: data.guild_id,
          staff_id: session.user.id,
          staff_name: staffName,
          tickets_handled: (metric?.tickets_handled || 0) + 1,
          approvals: metric?.approvals || 0,
          denials: metric?.denials || 0,
          avg_response_minutes: metric?.avg_response_minutes || 0,
          last_active: new Date().toISOString()
        },
        { onConflict: "guild_id,staff_id" }
      )
    ])

    const response = NextResponse.json(
      { ok: true, ticket: data, staffName },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
        }
      }
    )

    applyAuthCookies(response, refreshedTokens)
    return response
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Unauthorized" },
      { status: 401 }
    )
  }
}

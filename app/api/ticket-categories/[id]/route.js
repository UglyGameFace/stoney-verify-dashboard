import { NextResponse } from "next/server"
import { createServerSupabase } from "@/lib/supabase-server"
import { requireStaffSessionForRoute, applyAuthCookies } from "@/lib/auth-server"

export async function PATCH(request, { params }) {
  try {
    const { refreshedTokens } = await requireStaffSessionForRoute()
    const body = await request.json()
    const supabase = createServerSupabase()

    const { data, error } = await supabase.from("ticket_categories").update({
      name: body.name,
      slug: body.slug,
      color: body.color
    }).eq("id", params.id).select("*").single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const response = NextResponse.json({ category: data })
    applyAuthCookies(response, refreshedTokens)
    return response
  } catch (error) {
    return NextResponse.json({ error: error.message || "Unauthorized" }, { status: 401 })
  }
}

export async function DELETE(request, { params }) {
  try {
    const { refreshedTokens } = await requireStaffSessionForRoute()
    const supabase = createServerSupabase()
    const { error } = await supabase.from("ticket_categories").delete().eq("id", params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const response = NextResponse.json({ ok: true })
    applyAuthCookies(response, refreshedTokens)
    return response
  } catch (error) {
    return NextResponse.json({ error: error.message || "Unauthorized" }, { status: 401 })
  }
}

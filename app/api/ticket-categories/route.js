import { NextResponse } from "next/server"
import { createServerSupabase } from "@/lib/supabase-server"
import { requireStaffSessionForRoute, applyAuthCookies } from "@/lib/auth-server"
import { env } from "@/lib/env"

export async function GET() {
  const supabase = createServerSupabase()
  const { data, error } = await supabase.from("ticket_categories").select("*").order("name", { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ categories: data || [] })
}

export async function POST(request) {
  try {
    const { refreshedTokens } = await requireStaffSessionForRoute()
    const body = await request.json()
    const supabase = createServerSupabase()

    const { data, error } = await supabase.from("ticket_categories").insert({
      guild_id: env.guildId,
      name: body.name,
      slug: body.slug,
      color: body.color || "#45d483"
    }).select("*").single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const response = NextResponse.json({ category: data })
    applyAuthCookies(response, refreshedTokens)
    return response
  } catch (error) {
    return NextResponse.json({ error: error.message || "Unauthorized" }, { status: 401 })
  }
}

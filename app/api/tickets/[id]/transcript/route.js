import { NextResponse } from "next/server"
import { createServerSupabase } from "@/lib/supabase-server"
import { buildTranscriptMarkdown } from "@/lib/transcript"
import { requireStaffSessionForRoute, applyAuthCookies } from "@/lib/auth-server"

export async function GET(request, { params }) {
  try {
    const { refreshedTokens } = await requireStaffSessionForRoute()
    const supabase = createServerSupabase()

    const [{ data: ticket }, { data: messages }, { data: notes }] = await Promise.all([
      supabase.from("tickets").select("*").eq("id", params.id).single(),
      supabase.from("ticket_messages").select("*").eq("ticket_id", params.id).order("created_at", { ascending: true }),
      supabase.from("ticket_notes").select("*").eq("ticket_id", params.id).order("created_at", { ascending: true })
    ])

    const transcript = buildTranscriptMarkdown(ticket, messages || [], notes || [])
    const response = new NextResponse(transcript, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="ticket-${params.id}-transcript.md"`
      }
    })
    applyAuthCookies(response, refreshedTokens)
    return response
  } catch (error) {
    return NextResponse.json({ error: error.message || "Unauthorized" }, { status: 401 })
  }
}

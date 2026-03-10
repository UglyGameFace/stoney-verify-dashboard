import { createServerSupabase } from "@/lib/supabase-server"

export async function GET(request, { params }) {
  const supabase = createServerSupabase()
  const [{ data: ticket, error }, { data: messages }, { data: notes }] = await Promise.all([
    supabase.from("tickets").select("*").eq("id", params.id).single(),
    supabase.from("ticket_messages").select("*").eq("ticket_id", params.id).order("created_at", { ascending: true }),
    supabase.from("ticket_notes").select("*").eq("ticket_id", params.id).order("created_at", { ascending: false })
  ])

  if (error) return Response.json({ error: error.message }, { status: 404 })
  return Response.json({ ticket, messages: messages || [], notes: notes || [] })
}

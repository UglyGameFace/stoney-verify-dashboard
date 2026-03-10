import { createServerSupabase } from "@/lib/supabase-server"
import { classifyTicket, suggestModerationAction } from "@/lib/moderation"
import { derivePriority } from "@/lib/priority"

export async function GET() {
  const supabase = createServerSupabase()
  const { data, error } = await supabase.from("tickets").select("*").order("created_at", { ascending: false })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ tickets: data || [] })
}

export async function POST(request) {
  const body = await request.json()
  const supabase = createServerSupabase()
  const classification = classifyTicket(body.message || "")
  const suggestion = suggestModerationAction(body.message || "")

  const payload = {
    guild_id: body.guild_id,
    user_id: body.user_id,
    username: body.username || body.user_id,
    title: body.title || classification.category.replaceAll("_", " "),
    category: body.category || classification.category,
    status: "open",
    priority: derivePriority({ category: classification.category, status: "open", created_at: new Date().toISOString(), flagged: false }),
    initial_message: body.message || "",
    ai_category_confidence: classification.confidence,
    mod_suggestion: suggestion.suggestion,
    mod_suggestion_confidence: suggestion.confidence
  }

  const { data, error } = await supabase.from("tickets").insert(payload).select("*").single()
  if (error) return Response.json({ error: error.message }, { status: 500 })

  await Promise.all([
    supabase.from("ticket_messages").insert({
      ticket_id: data.id,
      author_id: body.user_id,
      author_name: body.username || body.user_id,
      content: body.message || "",
      message_type: "user"
    }),
    supabase.from("audit_events").insert({
      title: "Ticket created",
      description: `New ${payload.category} ticket for ${payload.username}`,
      event_type: "ticket_created",
      related_id: data.id
    })
  ])

  return Response.json({ ticket: data, classification, suggestion })
}

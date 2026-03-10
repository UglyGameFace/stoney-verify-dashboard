import { createServerSupabase } from "@/lib/supabase-server"

export async function POST() {
  const supabase = createServerSupabase()
  const samples = [
    {
      guild_id: process.env.GUILD_ID || "demo",
      user_id: "user_1001",
      username: "Luna#7788",
      title: "Verification issue",
      category: "verification_issue",
      status: "open",
      priority: "high",
      initial_message: "I linked my wallet but still cannot verify.",
      ai_category_confidence: 0.94,
      mod_suggestion: "send_verification_help",
      mod_suggestion_confidence: 0.92
    },
    {
      guild_id: process.env.GUILD_ID || "demo",
      user_id: "user_1002",
      username: "Ghost#1251",
      title: "Appeal request",
      category: "appeal",
      status: "claimed",
      claimed_by: process.env.DEFAULT_STAFF_NAME || "Dashboard Staff",
      priority: "medium",
      initial_message: "I would like to appeal my timeout.",
      ai_category_confidence: 0.9,
      mod_suggestion: "route_to_appeals_staff",
      mod_suggestion_confidence: 0.88
    }
  ]

  const { data, error } = await supabase.from("tickets").insert(samples).select("*")
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const messages = data.map((ticket) => ({
    ticket_id: ticket.id,
    author_id: ticket.user_id,
    author_name: ticket.username,
    content: ticket.initial_message,
    message_type: "user"
  }))

  await supabase.from("ticket_messages").insert(messages)
  return Response.json({ inserted: data.length })
}

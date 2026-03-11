import { createServerSupabase } from "@/lib/supabase-server"
import { env } from "@/lib/env"

export async function POST() {
  try {
    const supabase = createServerSupabase()
    const guildId = env.guildId || "demo"

    const samples = [
      {
        guild_id: guildId,
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
        guild_id: guildId,
        user_id: "user_1002",
        username: "Ghost#1251",
        title: "Appeal request",
        category: "appeal",
        status: "claimed",
        claimed_by: env.defaultStaffName || "Dashboard Staff",
        priority: "medium",
        initial_message: "I would like to appeal my timeout.",
        ai_category_confidence: 0.9,
        mod_suggestion: "route_to_appeals_staff",
        mod_suggestion_confidence: 0.88
      }
    ]

    const { data, error } = await supabase
      .from("tickets")
      .insert(samples)
      .select("*")

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    const messages = data.map((ticket) => ({
      ticket_id: ticket.id,
      author_id: ticket.user_id,
      author_name: ticket.username,
      content: ticket.initial_message,
      message_type: "user"
    }))

    const { error: messageError } = await supabase
      .from("ticket_messages")
      .insert(messages)

    if (messageError) {
      return Response.json({ error: messageError.message }, { status: 500 })
    }

    return Response.json({ inserted: data.length, tickets: data })
  } catch (error) {
    return Response.json(
      { error: error.message || "Failed to create sample tickets." },
      { status: 500 }
    )
  }
}

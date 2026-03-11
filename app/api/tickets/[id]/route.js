import { createServerSupabase } from "@/lib/supabase-server"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(request, { params }) {
  try {
    const supabase = createServerSupabase()

    const [
      { data: ticket, error },
      { data: messages },
      { data: notes }
    ] = await Promise.all([
      supabase.from("tickets").select("*").eq("id", params.id).single(),
      supabase.from("ticket_messages").select("*").eq("ticket_id", params.id).order("created_at", { ascending: true }),
      supabase.from("ticket_notes").select("*").eq("ticket_id", params.id).order("created_at", { ascending: false })
    ])

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 404,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
        }
      })
    }

    return new Response(
      JSON.stringify({
        ticket,
        messages: messages || [],
        notes: notes || []
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
        }
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message || "Failed to load ticket." }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
        }
      }
    )
  }
}

import Sidebar from "@/components/Sidebar"
import TicketDetailClient from "@/components/TicketDetailClient"
import { createServerSupabase } from "@/lib/supabase-server"

export const dynamic = "force-dynamic"
export const revalidate = 0

async function getTicketData(id) {
  const supabase = createServerSupabase()

  const [{ data: ticket, error }, { data: messages }, { data: notes }] =
    await Promise.all([
      supabase.from("tickets").select("*").eq("id", id).single(),
      supabase
        .from("ticket_messages")
        .select("*")
        .eq("ticket_id", id)
        .order("created_at", { ascending: true }),
      supabase
        .from("ticket_notes")
        .select("*")
        .eq("ticket_id", id)
        .order("created_at", { ascending: false }),
    ])

  if (error || !ticket) {
    return {
      ticket: null,
      messages: [],
      notes: [],
      error: error?.message || "Ticket not found.",
    }
  }

  return {
    ticket,
    messages: messages || [],
    notes: notes || [],
    error: "",
  }
}

export default async function TicketPage({ params }) {
  const ticketId = String(params?.id || "").trim()
  const data = await getTicketData(ticketId)

  return (
    <div className="shell">
      <Sidebar />

      <main className="content">
        <div className="content-inner">
          {data.ticket ? (
            <TicketDetailClient initialData={data} ticketId={ticketId} />
          ) : (
            <div className="space">
              <div className="card">
                <div className="muted" style={{ marginBottom: 8 }}>
                  Ticket Detail
                </div>

                <h1
                  style={{
                    margin: 0,
                    fontSize: "clamp(30px, 5vw, 46px)",
                    lineHeight: 0.96,
                    letterSpacing: "-0.05em",
                  }}
                >
                  Ticket unavailable
                </h1>

                <div className="error-banner" style={{ marginTop: 16 }}>
                  {data.error || "Ticket not found."}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

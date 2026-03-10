import Link from "next/link"
import Sidebar from "@/components/Sidebar"
import TicketDetailClient from "@/components/TicketDetailClient"
import MobileBottomNav from "@/components/MobileBottomNav"
import { createServerSupabase } from "@/lib/supabase-server"

async function getTicketData(id) {
  const supabase = createServerSupabase()
  const [{ data: ticket, error }, { data: messages }, { data: notes }] = await Promise.all([
    supabase.from("tickets").select("*").eq("id", id).single(),
    supabase.from("ticket_messages").select("*").eq("ticket_id", id).order("created_at", { ascending: true }),
    supabase.from("ticket_notes").select("*").eq("ticket_id", id).order("created_at", { ascending: false })
  ])

  if (error || !ticket) {
    return { ticket: null, messages: [], notes: [], error: error?.message || "Ticket not found." }
  }

  return { ticket, messages: messages || [], notes: notes || [], error: "" }
}

export default async function TicketPage({ params }) {
  const data = await getTicketData(params.id)

  return (
    <div className="shell">
      <Sidebar />
      <main className="content">
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
            <div>
              <div className="muted" style={{ marginBottom: 8 }}>Ticket Detail</div>
              <h1 style={{ margin: 0 }}>{data.ticket?.title || "Ticket unavailable"}</h1>
              <div className="muted" style={{ marginTop: 8 }}>
                {data.ticket ? `${data.ticket.username || data.ticket.user_id} • ${data.ticket.category} • ${data.ticket.status}` : data.error}
              </div>
            </div>
            <Link href="/" className="button ghost">Back to Dashboard</Link>
          </div>
        </div>

        {data.ticket ? (
          <TicketDetailClient initialData={data} ticketId={params.id} />
        ) : (
          <div className="error-banner">{data.error}</div>
        )}

        <MobileBottomNav />
      </main>
    </div>
  )
}

import MemberTicketThreadClient from "@/components/MemberTicketThreadClient";

async function loadTicket(ticketId) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const response = await fetch(`${baseUrl}/api/tickets/${ticketId}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to load ticket.");
  }

  return response.json();
}

export default async function PortalTicketPage({ params }) {
  const ticketId = params?.id;
  const payload = await loadTicket(ticketId);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 md:p-6">
      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="text-sm uppercase tracking-[0.2em] text-emerald-300/80">
          Member Ticket Portal
        </div>
        <h1 className="mt-2 text-2xl font-semibold text-white">
          {payload?.ticket?.title || payload?.ticket?.channel_name || "Ticket"}
        </h1>
        <p className="mt-2 text-sm text-white/60">
          This repair patch wires recent ticket activity into the portal ticket page.
        </p>
      </div>

      <MemberTicketThreadClient
        ticket={payload?.ticket}
        messages={payload?.messages}
        notes={payload?.notes}
        recentActivity={payload?.recentActivity}
      />
    </div>
  );
}

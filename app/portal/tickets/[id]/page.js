import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession, getDiscordLoginUrl } from "@/lib/auth-server";
import { createServerSupabase } from "@/lib/supabase-server";
import MemberTicketThreadClient from "@/components/MemberTicketThreadClient";

export const dynamic = "force-dynamic";

function normalizeMessage(row) {
  return {
    id: row?.id || "",
    ticket_id: row?.ticket_id || "",
    author_id: row?.author_id || "",
    author_name: row?.author_name || "Unknown",
    content: row?.content || "",
    message_type: row?.message_type || "staff",
    created_at: row?.created_at || null,
    attachments: Array.isArray(row?.attachments) ? row.attachments : [],
  };
}

function normalizeTicket(row) {
  return {
    ...row,
    title: row?.title || "Support Ticket",
    category: row?.category || "support",
    status: row?.status || "open",
    priority: row?.priority || "medium",
    username: row?.username || "Unknown User",
    transcript_url: row?.transcript_url || null,
    transcript_message_id: row?.transcript_message_id || null,
    transcript_channel_id: row?.transcript_channel_id || null,
    channel_id: row?.channel_id || row?.discord_thread_id || null,
    closed_reason: row?.closed_reason || null,
  };
}

async function getPortalTicketData(ticketId, userId) {
  const supabase = createServerSupabase();

  const { data: ticket, error: ticketError } = await supabase
    .from("tickets")
    .select("*")
    .eq("id", ticketId)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (ticketError) {
    throw new Error(ticketError.message);
  }

  if (!ticket) {
    return null;
  }

  const { data: messages, error: messagesError } = await supabase
    .from("ticket_messages")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });

  if (messagesError) {
    throw new Error(messagesError.message);
  }

  return {
    ticket: normalizeTicket(ticket),
    messages: (messages || []).map(normalizeMessage),
  };
}

export default async function PortalTicketThreadPage({ params }) {
  const session = await getSession();

  if (!session?.user?.id) {
    redirect(getDiscordLoginUrl());
  }

  const ticketId =
    typeof params?.id === "string" ? params.id.trim() : "";

  if (!ticketId) {
    notFound();
  }

  const data = await getPortalTicketData(ticketId, session.user.id);

  if (!data?.ticket) {
    notFound();
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #09090b 0%, #0f172a 100%)",
        color: "#fff",
      }}
    >
      <div
        style={{
          maxWidth: 1360,
          margin: "0 auto",
          padding: "18px 16px 96px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          <Link
            href="/portal"
            style={{
              color: "#93c5fd",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            ← Back to Portal
          </Link>

          <span
            style={{
              opacity: 0.45,
            }}
          >
            /
          </span>

          <span
            style={{
              color: "rgba(255,255,255,0.7)",
            }}
          >
            Ticket Thread
          </span>
        </div>

        <MemberTicketThreadClient
          user={session.user}
          ticket={data.ticket}
          initialMessages={data.messages}
        />
      </div>
    </main>
  );
}

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server";
import { createServerSupabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function safeText(value) {
  return String(value ?? "").trim();
}

async function getOwnedTicket(supabase, ticketId, userId) {
  const { data, error } = await supabase
    .from("tickets")
    .select("*")
    .eq("id", ticketId)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data || null;
}

export async function POST(req, { params }) {
  try {
    const session = await getSession();

    const userId = safeText(session?.user?.id);
    const username =
      safeText(session?.user?.username) ||
      safeText(session?.user?.global_name) ||
      "Member";

    if (!userId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Unauthorized",
        },
        { status: 401 }
      );
    }

    const ticketId = safeText(params?.id);

    if (!ticketId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing ticket id",
        },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const content = safeText(body?.content);

    if (!content) {
      return NextResponse.json(
        {
          ok: false,
          error: "Reply cannot be empty",
        },
        { status: 400 }
      );
    }

    if (content.length > 4000) {
      return NextResponse.json(
        {
          ok: false,
          error: "Reply is too long",
        },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();

    const ticket = await getOwnedTicket(supabase, ticketId, userId);

    if (!ticket) {
      return NextResponse.json(
        {
          ok: false,
          error: "Ticket not found",
        },
        { status: 404 }
      );
    }

    const status = safeText(ticket?.status).toLowerCase();

    if (status === "deleted") {
      return NextResponse.json(
        {
          ok: false,
          error: "Deleted tickets cannot be replied to",
        },
        { status: 400 }
      );
    }

    const { data: insertedMessage, error: insertError } = await supabase
      .from("ticket_messages")
      .insert({
        ticket_id: ticketId,
        author_id: userId,
        author_name: username,
        content,
        message_type: "user",
        attachments: [],
      })
      .select("*")
      .single();

    if (insertError) {
      throw new Error(insertError.message);
    }

    const { error: ticketUpdateError } = await supabase
      .from("tickets")
      .update({
        updated_at: new Date().toISOString(),
        status: status === "closed" ? "open" : ticket.status,
        reopened_at: status === "closed" ? new Date().toISOString() : ticket.reopened_at || null,
      })
      .eq("id", ticketId)
      .eq("user_id", userId);

    if (ticketUpdateError) {
      throw new Error(ticketUpdateError.message);
    }

    try {
      await supabase.from("audit_logs").insert({
        action: "member_portal_ticket_reply",
        staff_id: null,
        meta: {
          ticket_id: ticketId,
          user_id: userId,
          message_id: insertedMessage?.id || null,
        },
      });
    } catch {
      // non-fatal
    }

    return NextResponse.json({
      ok: true,
      message: insertedMessage,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Unexpected server error",
      },
      { status: 500 }
    );
  }
}

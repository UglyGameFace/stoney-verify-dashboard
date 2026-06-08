import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server";
import { getSelectedGuildId } from "@/lib/guild-selection";
import { createServerSupabase } from "@/lib/supabase-server";
import { queuePortalTicketReply } from "@/lib/botCommands";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function safeText(value) {
  return String(value ?? "").trim();
}

function noStoreJson(body, status = 200) {
  const normalized = status >= 400
    ? {
        ok: false,
        ...body,
        error_code: body?.error_code || (status === 401 ? "signed_out" : status === 428 ? "selected_server_required" : status === 404 ? "not_found" : status === 400 ? "invalid_request" : "server_error"),
        needsServerSelection: body?.needsServerSelection ?? status === 428,
      }
    : body;

  return NextResponse.json(normalized, {
    status,
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" },
  });
}

function selectedGuildId() {
  return safeText(getSelectedGuildId());
}

async function getOwnedTicket(supabase, ticketId, userId, guildId) {
  const { data, error } = await supabase
    .from("tickets")
    .select("*")
    .eq("id", ticketId)
    .eq("guild_id", guildId)
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
    const userId = safeText(session?.user?.discord_id || session?.user?.id || session?.discordUser?.id);
    const username =
      safeText(session?.user?.username) ||
      safeText(session?.discordUser?.username) ||
      safeText(session?.user?.global_name) ||
      "Member";

    if (!userId) {
      return noStoreJson(
        {
          ok: false,
          error: "Discord login required.",
          error_code: "signed_out",
        },
        401
      );
    }

    const guildId = selectedGuildId();
    if (!guildId) {
      return noStoreJson(
        {
          ok: false,
          error: "Select a server before replying to a ticket.",
          error_code: "selected_server_required",
          needsServerSelection: true,
        },
        428
      );
    }

    const ticketId = safeText(params?.id);

    if (!ticketId) {
      return noStoreJson(
        {
          ok: false,
          selectedGuildId: guildId,
          error: "Missing ticket id",
          error_code: "invalid_request",
        },
        400
      );
    }

    const body = await req.json().catch(() => ({}));
    const content = safeText(body?.content);

    if (!content) {
      return noStoreJson(
        {
          ok: false,
          selectedGuildId: guildId,
          error: "Reply cannot be empty",
          error_code: "invalid_request",
        },
        400
      );
    }

    if (content.length > 4000) {
      return noStoreJson(
        {
          ok: false,
          selectedGuildId: guildId,
          error: "Reply is too long",
          error_code: "invalid_request",
        },
        400
      );
    }

    const supabase = createServerSupabase();
    const ticket = await getOwnedTicket(supabase, ticketId, userId, guildId);

    if (!ticket) {
      return noStoreJson(
        {
          ok: false,
          selectedGuildId: guildId,
          error: "Ticket not found",
          error_code: "not_found",
        },
        404
      );
    }

    const status = safeText(ticket?.status).toLowerCase();

    if (status === "deleted") {
      return noStoreJson(
        {
          ok: false,
          selectedGuildId: guildId,
          error: "Deleted tickets cannot be replied to",
          error_code: "invalid_request",
        },
        400
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

    const reopening = status === "closed";

    const { error: ticketUpdateError } = await supabase
      .from("tickets")
      .update({
        updated_at: new Date().toISOString(),
        status: reopening ? "open" : ticket.status,
        reopened_at: reopening ? new Date().toISOString() : ticket.reopened_at || null,
      })
      .eq("id", ticketId)
      .eq("guild_id", guildId)
      .eq("user_id", userId);

    if (ticketUpdateError) {
      throw new Error(ticketUpdateError.message);
    }

    const channelId = safeText(ticket?.channel_id || ticket?.discord_thread_id);
    let botCommand = null;

    if (channelId) {
      try {
        botCommand = await queuePortalTicketReply({
          ticketId,
          channelId,
          userId,
          username,
          content,
          messageId: insertedMessage?.id || null,
          requestedBy: userId,
        });
      } catch (botError) {
        console.error("Failed to queue portal ticket reply bot command:", botError);
      }
    }

    try {
      await supabase.from("audit_logs").insert({
        guild_id: guildId,
        action: "member_portal_ticket_reply",
        staff_id: null,
        meta: {
          guild_id: guildId,
          ticket_id: ticketId,
          user_id: userId,
          message_id: insertedMessage?.id || null,
          bot_command_id: botCommand?.id || null,
          mirrored_to_discord: Boolean(botCommand),
        },
      });
    } catch {
      // non-fatal
    }

    return noStoreJson({
      ok: true,
      selectedGuildId: guildId,
      message: insertedMessage,
      mirroredToDiscord: Boolean(botCommand),
      botCommandId: botCommand?.id || null,
      reopened: reopening,
    });
  } catch (error) {
    return noStoreJson(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unexpected server error",
        error_code: "server_error",
      },
      500
    );
  }
}

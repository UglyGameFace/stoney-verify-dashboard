import { createServerSupabase } from "@/lib/supabase-server";
import {
  requireStaffSessionForRoute,
  applyAuthCookies,
} from "@/lib/auth-server";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function normalizeString(value: unknown) {
  return String(value || "").trim();
}

function normalizeAttachments(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      const url =
        typeof item === "string"
          ? normalizeString(item)
          : normalizeString((item as any)?.url);

      const name =
        typeof item === "string"
          ? `attachment-${index + 1}`
          : normalizeString((item as any)?.name) || `attachment-${index + 1}`;

      if (!url) return null;
      return { name, url };
    })
    .filter(Boolean);
}

function getSessionUser(session: any) {
  return session?.user || session?.discordUser || session?.staffUser || null;
}

function getStaffId(session: any) {
  const user = getSessionUser(session);
  return normalizeString(
    user?.id ||
      user?.user_id ||
      user?.discord_id ||
      session?.discordUser?.id ||
      ""
  );
}

function getStaffName(session: any) {
  const user = getSessionUser(session);
  return normalizeString(
    user?.global_name ||
      user?.display_name ||
      user?.username ||
      user?.name ||
      session?.discordUser?.username ||
      "Staff"
  );
}

function getGuildId() {
  return normalizeString(env.guildId || env.discordGuildId || "");
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  });
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { session, refreshedTokens } = await requireStaffSessionForRoute();
    const supabase = createServerSupabase();

    const ticketId = normalizeString(params?.id);
    if (!ticketId) {
      return json({ error: "Missing ticket id." }, 400);
    }

    const body = await request.json().catch(() => ({}));
    const message = normalizeString(body?.message);
    const attachments = normalizeAttachments(body?.attachments);

    if (!message) {
      return json({ error: "Reply message cannot be empty." }, 400);
    }

    const staffId = getStaffId(session);
    const staffName = getStaffName(session);
    const guildId = getGuildId();

    if (!staffId) {
      return json({ error: "Missing staff identity." }, 401);
    }

    const { data: ticket, error: ticketError } = await supabase
      .from("tickets")
      .select("*")
      .eq("id", ticketId)
      .single();

    if (ticketError || !ticket) {
      return json({ error: ticketError?.message || "Ticket not found." }, 404);
    }

    const createdAt = new Date().toISOString();

    // IMPORTANT:
    // Keep this payload limited to columns that your current ticket_messages
    // table can safely accept.
    const insertPayload = {
      ticket_id: ticketId,
      content: message,
      attachments,
      created_at: createdAt,
      updated_at: createdAt,
    };

    const { data: insertedMessage, error: insertError } = await supabase
      .from("ticket_messages")
      .insert(insertPayload)
      .select("*")
      .single();

    if (insertError) {
      return json({ error: insertError.message || "Failed to save reply." }, 500);
    }

    let mirroredToDiscord = false;
    let mirrorCommandId: string | null = null;
    let mirrorError: string | null = null;

    const channelId = normalizeString(
      ticket.channel_id || ticket.discord_thread_id || ""
    );

    if (channelId && guildId) {
      const commandPayload = {
        guild_id: guildId,
        action: "portal_ticket_reply",
        status: "pending",
        payload: {
          ticket_id: ticketId,
          channel_id: channelId,
          user_id: normalizeString(ticket.user_id || ""),
          username: normalizeString(ticket.username || staffName || "Staff"),
          content: message,
          message_id: normalizeString(insertedMessage?.id || ""),
          attachments,
          source: "dashboard_staff_reply",
          staff_id: staffId,
          staff_name: staffName,
        },
        created_at: createdAt,
      };

      const { data: commandRow, error: commandError } = await supabase
        .from("bot_commands")
        .insert(commandPayload)
        .select("id")
        .single();

      if (commandError) {
        mirrorError = commandError.message || "Failed to queue Discord mirror.";
      } else {
        mirroredToDiscord = true;
        mirrorCommandId = commandRow?.id || null;
      }
    } else {
      mirrorError = "Ticket is not linked to a Discord channel.";
    }

    const response = json({
      ok: true,
      message: insertedMessage,
      mirroredToDiscord,
      mirrorCommandId,
      mirrorError,
    });

    applyAuthCookies(response, refreshedTokens);
    return response;
  } catch (error: any) {
    const message = error?.message || "Unauthorized";
    const status = message === "Unauthorized" ? 401 : 500;
    return json({ error: message }, status);
  }
}

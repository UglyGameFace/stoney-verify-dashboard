import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server";
import { getSelectedGuildId } from "@/lib/guild-selection";
import { createServerSupabase } from "@/lib/supabase-server";
import { queueCreateTicket } from "@/lib/botCommands";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function safeText(value) {
  return String(value ?? "").trim();
}

function noStoreJson(body, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

function selectedGuildId() {
  return safeText(getSelectedGuildId());
}

function getSessionUser(session) {
  return session?.user || session?.discordUser || {};
}

export async function POST(req) {
  try {
    const session = await getSession();
    const user = getSessionUser(session);

    const userId = safeText(user?.discord_id || user?.id || session?.discordUser?.id);
    const username =
      safeText(user?.username) ||
      safeText(session?.discordUser?.username) ||
      safeText(user?.global_name) ||
      safeText(user?.name) ||
      "Member";

    if (!userId) {
      return noStoreJson(
        {
          ok: false,
          error: "Unauthorized",
        },
        401
      );
    }

    const guildId = selectedGuildId();
    if (!guildId) {
      return noStoreJson(
        {
          ok: false,
          error: "Select a server before creating a ticket.",
          needsServerSelection: true,
        },
        428
      );
    }

    const body = await req.json().catch(() => ({}));

    const category = safeText(body?.category || body?.category_slug || body?.slug || "support") || "support";
    const priority = safeText(body?.priority || "medium") || "medium";
    const openingMessage =
      safeText(body?.openingMessage || body?.message || body?.details || body?.initial_message) ||
      `Ticket created from member portal by ${username}`;

    const supabase = createServerSupabase();

    const { data: existingOpen, error: existingError } = await supabase
      .from("tickets")
      .select("*")
      .eq("guild_id", guildId)
      .eq("user_id", userId)
      .in("status", ["open", "claimed"])
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) {
      throw new Error(existingError.message);
    }

    if (existingOpen) {
      return noStoreJson({
        ok: true,
        selectedGuildId: guildId,
        alreadyExists: true,
        queued: false,
        ticket: existingOpen,
      });
    }

    const command = await queueCreateTicket({
      guildId,
      userId,
      category,
      priority,
      openingMessage,
      ghost: false,
      allowDuplicate: false,
      requestedBy: userId,
    });

    try {
      await supabase.from("audit_logs").insert({
        guild_id: guildId,
        action: "member_portal_ticket_create_requested",
        staff_id: null,
        meta: {
          guild_id: guildId,
          user_id: userId,
          username,
          category,
          priority,
          command_id: command?.id || null,
        },
      });
    } catch {
      // non-fatal
    }

    return noStoreJson({
      ok: true,
      selectedGuildId: guildId,
      queued: true,
      command,
    });
  } catch (error) {
    return noStoreJson(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unexpected server error",
      },
      500
    );
  }
}

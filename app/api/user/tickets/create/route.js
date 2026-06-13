import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSession } from "@/lib/auth-server";
import { getSelectedGuildId } from "@/lib/guild-selection";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function clean(value) {
  return String(value || "").trim();
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function json(payload, status = 200) {
  const code = clean(payload.error_code) || (status === 401 ? "signed_out" : status === 428 ? "selected_server_required" : status === 409 ? "conflict" : status >= 500 ? "server_error" : "invalid_request");
  const body = status >= 400
    ? { ...payload, ok: false, error: payload.error || "Request failed.", error_code: code, needsServerSelection: payload.needsServerSelection ?? code === "selected_server_required", retryable: payload.retryable ?? false }
    : payload;
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } });
}

function signedOut() {
  return json({ error: "Discord login required.", error_code: "signed_out" }, 401);
}

function viewerFromSession(session, guildId) {
  const user = obj(session.user || session.discordUser);
  return {
    discord_id: clean(user.discord_id || user.id || session?.discordUser?.id),
    username: clean(user.username || session?.discordUser?.username) || "Member",
    global_name: clean(user.global_name || user.name || user.username) || clean(user.username || session?.discordUser?.username) || "Member",
    avatar_url: clean(user.avatar_url || user.avatar || user.image || user.picture || session?.discordUser?.avatar_url || session?.discordUser?.avatar) || null,
    guild_id: guildId,
  };
}

function ticketOut(row) {
  const ticket = obj(row);
  return {
    id: clean(ticket.id) || null,
    guild_id: clean(ticket.guild_id) || null,
    user_id: clean(ticket.user_id) || null,
    username: clean(ticket.username) || null,
    title: clean(ticket.title || ticket.channel_name) || "Ticket",
    category: clean(ticket.category) || null,
    matched_category_name: clean(ticket.matched_category_name) || null,
    matched_category_slug: clean(ticket.matched_category_slug) || null,
    matched_intake_type: clean(ticket.matched_intake_type) || null,
    status: clean(ticket.status) || "open",
    priority: clean(ticket.priority) || "medium",
    channel_id: clean(ticket.channel_id || ticket.discord_thread_id) || null,
    channel_name: clean(ticket.channel_name) || null,
    ticket_number: Number.isFinite(Number(ticket.ticket_number)) ? Number(ticket.ticket_number) : null,
    created_at: clean(ticket.created_at) || null,
    updated_at: clean(ticket.updated_at) || null,
  };
}

async function parseBody(request) {
  try {
    return obj(await request.json());
  } catch {
    return {};
  }
}

async function findOpenTicket(supabase, guildId, userId) {
  const { data, error } = await supabase
    .from("tickets")
    .select("*")
    .eq("guild_id", guildId)
    .eq("user_id", userId)
    .in("status", ["open", "claimed"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return null;
  return data || null;
}

async function findRecentCreateCommand(supabase, guildId, userId) {
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("bot_commands")
    .select("id,status,created_at,result,error")
    .eq("guild_id", guildId)
    .eq("action", "create_ticket")
    .eq("requested_by", userId)
    .in("status", ["pending", "processing"])
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return null;
  return data || null;
}

async function findCategory(supabase, guildId, body) {
  const requestedSlug = clean(body.category_slug || body.category || body.intake_type || "support").toLowerCase();
  const requestedIntake = clean(body.intake_type || requestedSlug).toLowerCase();

  const { data } = await supabase
    .from("ticket_categories")
    .select("*")
    .eq("guild_id", guildId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  const rows = list(data).map(obj);
  const match = rows.find((row) => clean(row.slug).toLowerCase() === requestedSlug)
    || rows.find((row) => clean(row.intake_type).toLowerCase() === requestedIntake)
    || rows.find((row) => Boolean(row.is_default))
    || rows[0]
    || null;

  if (!match) {
    return {
      name: "Support",
      slug: requestedSlug || "support",
      intake_type: requestedIntake || "general",
      staff_role_ids: [],
      parent_category_id: null,
    };
  }

  return {
    id: clean(match.id) || null,
    name: clean(match.name) || "Support",
    slug: clean(match.slug) || requestedSlug || "support",
    intake_type: clean(match.intake_type) || requestedIntake || "general",
    staff_role_ids: list(match.staff_role_ids).map(clean).filter(Boolean),
    parent_category_id: clean(match.parent_category_id || match.discord_category_id || match.category_id) || null,
  };
}

async function insertCommand(supabase, payload) {
  const { data, error } = await supabase
    .from("bot_commands")
    .insert(payload)
    .select("id,status,created_at")
    .single();

  if (error) throw error;
  return data;
}

export async function POST(request) {
  try {
    const session = obj(await getSession());
    if (!Object.keys(session).length) return signedOut();

    const guildId = clean(getSelectedGuildId());
    if (!guildId) return json({ error: "Select a server before creating a ticket.", error_code: "selected_server_required", needsServerSelection: true }, 428);

    const viewer = viewerFromSession(session, guildId);
    if (!viewer.discord_id) return signedOut();

    const body = await parseBody(request);
    const supabase = createServerSupabase();
    const message = clean(body.message) || "Ticket opened from dashboard.";
    const priority = clean(body.priority) || "medium";
    const category = await findCategory(supabase, guildId, body);

    const existingTicket = await findOpenTicket(supabase, guildId, viewer.discord_id);
    if (existingTicket) {
      return json({ error: "You already have an open ticket.", error_code: "ticket_already_open", existing_ticket: ticketOut(existingTicket) }, 409);
    }

    const existingCommand = await findRecentCreateCommand(supabase, guildId, viewer.discord_id);
    if (existingCommand) {
      return json({ error: "A ticket request is already being processed.", error_code: "ticket_create_already_queued", existing_command: existingCommand }, 409);
    }

    const payload = {
      guild_id: guildId,
      action: "create_ticket",
      requested_by: viewer.discord_id,
      status: "pending",
      payload: {
        guild_id: guildId,
        user_id: viewer.discord_id,
        username: viewer.username,
        display_name: viewer.global_name,
        avatar_url: viewer.avatar_url,
        category: category.slug,
        category_slug: category.slug,
        category_name: category.name,
        intake_type: category.intake_type,
        matched_category_id: category.id,
        matched_category_name: category.name,
        matched_category_slug: category.slug,
        matched_intake_type: category.intake_type,
        member_message: message,
        message,
        opening_message: message,
        priority,
        source: "user_dashboard",
        create_from: "user_dashboard",
        staff_role_ids: category.staff_role_ids,
        parent_category_id: category.parent_category_id,
        dashboard_context: {
          requested_category_slug: category.slug,
          requested_category_name: category.name,
          requested_intake_type: category.intake_type,
          requested_priority: priority,
          staff_role_ids: category.staff_role_ids,
          parent_category_id: category.parent_category_id,
        },
        member_snapshot: {
          user_id: viewer.discord_id,
          username: viewer.username,
          display_name: viewer.global_name,
          avatar_url: viewer.avatar_url,
        },
      },
    };

    const command = await insertCommand(supabase, payload);

    return json({ ok: true, selectedGuildId: guildId, queued: true, command, category, message: "Ticket request queued for the bot." }, 202);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Failed to queue ticket request.", error_code: "ticket_create_queue_failed", retryable: true }, 500);
  }
}

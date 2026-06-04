import { createServerSupabase } from "@/lib/supabase-server";
import { requireStaffSessionForRoute } from "@/lib/auth-server";
import { getSelectedGuildId } from "@/lib/guild-selection";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function normalizeString(value) {
  return String(value || "").trim();
}

function isSampleRouteEnabled() {
  const value = normalizeString(process.env.ENABLE_SAMPLE_TICKET_ROUTE).toLowerCase();
  return ["true", "1", "yes", "on"].includes(value);
}

function getSessionUser(session) {
  return session?.user || session?.discordUser || session?.staffUser || null;
}

function getStaffId(session) {
  const user = getSessionUser(session);
  return normalizeString(user?.discord_id || user?.id || user?.user_id || session?.discordUser?.id || "");
}

function getStaffName(session) {
  const user = getSessionUser(session);
  return normalizeString(
    user?.global_name ||
      user?.display_name ||
      user?.username ||
      user?.name ||
      session?.discordUser?.username ||
      "Dashboard Staff"
  );
}

function selectedGuildId() {
  return normalizeString(getSelectedGuildId());
}

function json(payload, status = 200) {
  return Response.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  });
}

async function insertActivityEvent(supabase, args) {
  const now = new Date().toISOString();
  const attempts = [
    {
      guild_id: args.guildId,
      title: "Sample tickets created",
      description: `Inserted ${args.count} sample ticket(s) from dashboard dev route.`,
      event_family: "ticket",
      event_type: "ticket_sample_create",
      source: "dashboard_ticket_sample_route",
      actor_user_id: args.actorId,
      actor_name: args.actorName,
      metadata: {
        sample_count: args.count,
        ticket_ids: args.ticketIds,
      },
      created_at: now,
    },
    {
      guild_id: args.guildId,
      title: "Sample tickets created",
      description: `Inserted ${args.count} sample ticket(s) from dashboard dev route.`,
      event_type: "ticket_sample_create",
      source: "dashboard_ticket_sample_route",
      actor_user_id: args.actorId,
      actor_name: args.actorName,
      created_at: now,
    },
  ];

  for (const candidate of attempts) {
    try {
      const { error } = await supabase.from("activity_feed_events").insert(candidate);
      if (!error) return;
    } catch {
      // Best-effort only.
    }
  }
}

export async function POST() {
  try {
    if (!isSampleRouteEnabled()) {
      return json(
        {
          ok: false,
          error: "Sample ticket creation is disabled.",
          enableWith: "ENABLE_SAMPLE_TICKET_ROUTE=true",
        },
        403
      );
    }

    const { session } = await requireStaffSessionForRoute();
    const guildId = selectedGuildId();

    if (!guildId) {
      return json(
        {
          ok: false,
          error: "Select a server before creating sample tickets.",
          needsServerSelection: true,
        },
        428
      );
    }

    const staffId = getStaffId(session);
    const staffName = getStaffName(session);

    if (!staffId) {
      return json({ ok: false, error: "Could not identify signed-in staff member." }, 401);
    }

    const supabase = createServerSupabase();
    const now = new Date().toISOString();

    const samples = [
      {
        guild_id: guildId,
        user_id: "sample_user_1001",
        username: "Sample Luna",
        title: "Verification issue",
        category: "verification_issue",
        matched_intake_type: "verification",
        status: "open",
        priority: "high",
        initial_message: "Sample: I verified but still cannot access the server.",
        ai_category_confidence: 0.94,
        mod_suggestion: "send_verification_help",
        mod_suggestion_confidence: 0.92,
        source: "dashboard_sample",
        created_at: now,
        updated_at: now,
      },
      {
        guild_id: guildId,
        user_id: "sample_user_1002",
        username: "Sample Ghost",
        title: "Appeal request",
        category: "appeal",
        matched_intake_type: "appeal",
        status: "claimed",
        claimed_by: staffId,
        assigned_to: staffId,
        priority: "medium",
        initial_message: "Sample: I would like to appeal my timeout.",
        ai_category_confidence: 0.9,
        mod_suggestion: "route_to_appeals_staff",
        mod_suggestion_confidence: 0.88,
        source: "dashboard_sample",
        created_at: now,
        updated_at: now,
      },
    ];

    const { data, error } = await supabase.from("tickets").insert(samples).select("*");

    if (error) {
      return json({ ok: false, selectedGuildId: guildId, error: error.message }, 500);
    }

    const tickets = Array.isArray(data) ? data : [];
    const messages = tickets.map((ticket) => ({
      ticket_id: ticket.id,
      author_id: ticket.user_id,
      author_name: ticket.username,
      content: ticket.initial_message,
      message_type: "user",
      created_at: now,
    }));

    if (messages.length) {
      const { error: messageError } = await supabase.from("ticket_messages").insert(messages);

      if (messageError) {
        return json({ ok: false, selectedGuildId: guildId, error: messageError.message }, 500);
      }
    }

    await insertActivityEvent(supabase, {
      guildId,
      actorId: staffId,
      actorName: staffName,
      count: tickets.length,
      ticketIds: tickets.map((ticket) => ticket.id).filter(Boolean),
    });

    return json({
      ok: true,
      selectedGuildId: guildId,
      inserted: tickets.length,
      tickets,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create sample tickets.";
    return json({ ok: false, error: message }, message === "Unauthorized" ? 401 : 500);
  }
}

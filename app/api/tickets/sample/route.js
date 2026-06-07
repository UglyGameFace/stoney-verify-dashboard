import { createServerSupabase } from "@/lib/supabase-server";
import { requireDashboardStaffSession, dashboardAuthJson, dashboardAuthErrorJson } from "@/lib/dashboard-auth";

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

function json(payload, status = 200, session = null) {
  return dashboardAuthJson(payload, status, session);
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
  let session = null;

  try {
    if (!isSampleRouteEnabled()) {
      return json(
        {
          ok: false,
          error: "Sample ticket creation is disabled.",
          error_code: "forbidden",
          enableWith: "ENABLE_SAMPLE_TICKET_ROUTE=true",
        },
        403,
        session
      );
    }

    session = await requireDashboardStaffSession();
    const guildId = normalizeString(session.selectedGuildId);

    if (!guildId) {
      return json(
        {
          ok: false,
          error: "Select a server before creating sample tickets.",
          error_code: "selected_server_required",
          needsServerSelection: true,
        },
        428,
        session
      );
    }

    const staffId = getStaffId(session);
    const staffName = getStaffName(session);

    if (!staffId) {
      return json({ ok: false, error: "Could not identify signed-in staff member.", error_code: "invalid_request", selectedGuildId: guildId }, 400, session);
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
      return json({ ok: false, selectedGuildId: guildId, error: error.message }, 500, session);
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
        return json({ ok: false, selectedGuildId: guildId, error: messageError.message }, 500, session);
      }
    }

    await insertActivityEvent(supabase, {
      guildId,
      actorId: staffId,
      actorName: staffName,
      count: tickets.length,
      ticketIds: tickets.map((ticket) => ticket.id).filter(Boolean),
    });

    return json(
      {
        ok: true,
        selectedGuildId: guildId,
        inserted: tickets.length,
        tickets,
      },
      200,
      session
    );
  } catch (error) {
    return dashboardAuthErrorJson(error, session, 500);
  }
}

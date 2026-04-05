import { createServerSupabase } from "@/lib/supabase-server";
import { requireStaffSessionForRoute, applyAuthCookies } from "@/lib/auth-server";
import { env } from "@/lib/env";
import {
  insertMemberEvent,
  patchGuildMemberEntryFields,
  patchLatestMemberJoinContext,
} from "@/lib/memberEventWrites";
import { fetchRecentTicketEventsForUser } from "@/lib/ticketEventFeed";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeBoolean(value) {
  if (typeof value === "boolean") return value;
  const clean = normalizeString(value).toLowerCase();
  return clean === "true" || clean === "1" || clean === "yes" || clean === "on";
}

function buildCategoryPatch(body) {
  return {
    category: normalizeString(body?.category) || null,
    category_id: normalizeString(body?.category_id) || null,
    category_override: normalizeBoolean(
      body?.category_override ?? body?.manual_override ?? true
    ),
    category_set_by: normalizeString(body?.category_set_by) || null,
    category_set_at: new Date().toISOString(),
  };
}

function getActorIdentity(session) {
  return {
    actorId:
      session?.user?.discord_id ||
      session?.user?.id ||
      session?.user?.user_id ||
      session?.discordUser?.id ||
      null,
    actorName:
      session?.user?.username ||
      session?.user?.name ||
      session?.discordUser?.username ||
      "Dashboard Staff",
  };
}

async function loadRecentActivityForTicket(supabase, ticket) {
  try {
    if (!ticket?.guild_id || !ticket?.user_id || !ticket?.id) {
      return [];
    }

    return await fetchRecentTicketEventsForUser(supabase, {
      guildId: String(ticket.guild_id),
      userId: String(ticket.user_id),
      ticketIds: [ticket.id],
      limit: 20,
    });
  } catch {
    return [];
  }
}

export async function GET(request, { params }) {
  try {
    const supabase = createServerSupabase();

    const [{ data: ticket, error }, { data: messages }, { data: notes }] = await Promise.all([
      supabase.from("tickets").select("*").eq("id", params.id).single(),
      supabase
        .from("ticket_messages")
        .select("*")
        .eq("ticket_id", params.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("ticket_notes")
        .select("*")
        .eq("ticket_id", params.id)
        .order("created_at", { ascending: false }),
    ]);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 404,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      });
    }

    const recentActivity = await loadRecentActivityForTicket(supabase, ticket);

    return new Response(
      JSON.stringify({
        ticket,
        messages: messages || [],
        notes: notes || [],
        recentActivity,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message || "Failed to load ticket." }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      }
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    const { session, refreshedTokens } = await requireStaffSessionForRoute();
    const supabase = createServerSupabase();
    const body = await request.json();
    const ticketId = params?.id;
    const guildId = env.guildId || "";
    const { actorId, actorName } = getActorIdentity(session);

    if (!ticketId) {
      return new Response(JSON.stringify({ error: "Missing ticket id." }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      });
    }

    const action = normalizeString(body?.action || "update-category").toLowerCase();

    if (action !== "update-category") {
      return new Response(JSON.stringify({ error: "Unsupported patch action." }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      });
    }

    const { data: existingTicket, error: existingTicketError } = await supabase
      .from("tickets")
      .select("*")
      .eq("id", ticketId)
      .single();

    if (existingTicketError || !existingTicket) {
      return new Response(
        JSON.stringify({ error: existingTicketError?.message || "Ticket not found." }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          },
        }
      );
    }

    const patch = buildCategoryPatch({
      ...body,
      category_set_by: body?.category_set_by || actorId || "",
    });

    let categoryRow = null;

    if (patch.category_id) {
      const { data, error } = await supabase
        .from("ticket_categories")
        .select("*")
        .eq("id", patch.category_id)
        .eq("guild_id", guildId)
        .single();

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          },
        });
      }

      categoryRow = data || null;
    } else if (patch.category) {
      const { data } = await supabase
        .from("ticket_categories")
        .select("*")
        .eq("guild_id", guildId)
        .or(`slug.eq.${patch.category},name.eq.${patch.category}`)
        .limit(1);

      categoryRow = Array.isArray(data) && data.length ? data[0] : null;
    }

    const selectedCategorySlug = categoryRow?.slug || patch.category || null;
    const selectedCategoryName = categoryRow?.name || patch.category || null;
    const selectedIntakeType = categoryRow?.intake_type || null;

    const updatePayload = {
      updated_at: new Date().toISOString(),
      category_override: patch.category_override,
      category_set_by: patch.category_set_by,
      category_set_at: patch.category_set_at,
      category_id: categoryRow?.id || patch.category_id || null,
      category: selectedCategorySlug || selectedCategoryName || null,
      matched_category_id: categoryRow?.id || null,
      matched_category_name: selectedCategoryName,
      matched_category_slug: selectedCategorySlug,
      matched_intake_type: selectedIntakeType,
      matched_category_reason: "manual-override",
      matched_category_score: 999,
    };

    const { data: ticket, error } = await supabase
      .from("tickets")
      .update(updatePayload)
      .eq("id", ticketId)
      .select("*")
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      });
    }

    await insertMemberEvent(
      {
        guildId,
        userId: String(existingTicket.user_id || "").trim(),
        actorId,
        actorName,
        eventType: "ticket_category_overridden",
        title: "Ticket Category Overridden",
        reason: `Manual category override set to ${selectedCategoryName || selectedCategorySlug || "unknown"}.`,
        metadata: {
          ticket_id: ticketId,
          ticket_number: existingTicket.ticket_number || null,
          previous_category: existingTicket.category || null,
          previous_category_id: existingTicket.category_id || null,
          previous_matched_category_id: existingTicket.matched_category_id || null,
          previous_matched_category_name: existingTicket.matched_category_name || null,
          next_category: updatePayload.category,
          next_category_id: updatePayload.category_id,
          matched_category_name: updatePayload.matched_category_name,
          matched_category_slug: updatePayload.matched_category_slug,
          matched_intake_type: updatePayload.matched_intake_type,
          source: "dashboard_ticket_patch",
        },
      },
      supabase
    );

    const shouldPatchEntryContext =
      String(selectedIntakeType || "").toLowerCase() === "verification" ||
      String(selectedCategorySlug || "").toLowerCase().includes("verification") ||
      String(selectedCategoryName || "").toLowerCase().includes("verification");

    if (shouldPatchEntryContext) {
      await patchGuildMemberEntryFields(
        {
          guildId,
          userId: String(existingTicket.user_id || "").trim(),
          approvedBy: actorId,
          approvedByName: actorName,
          sourceTicketId: ticketId,
          verificationTicketId: ticketId,
          entryMethod:
            normalizeString(body?.entry_method) ||
            normalizeString(body?.verification_source) ||
            "verification_ticket",
          verificationSource:
            normalizeString(body?.verification_source) ||
            "dashboard_manual_category_override",
          entryReason:
            normalizeString(body?.entry_reason) ||
            `Ticket category manually set to ${selectedCategoryName || selectedCategorySlug || "verification"}.`,
          approvalReason:
            normalizeString(body?.approval_reason) ||
            `Dashboard staff manually set verification category on ticket ${ticketId}.`,
        },
        supabase
      );

      await patchLatestMemberJoinContext(
        {
          guildId,
          userId: String(existingTicket.user_id || "").trim(),
          username: existingTicket.username || null,
          approvedBy: actorId,
          approvedByName: actorName,
          sourceTicketId: ticketId,
          entryMethod: normalizeString(body?.entry_method) || "verification_ticket",
          verificationSource:
            normalizeString(body?.verification_source) ||
            "dashboard_manual_category_override",
          joinNote:
            normalizeString(body?.entry_reason) ||
            `Verification context linked from ticket ${ticketId}.`,
        },
        supabase
      );

      await insertMemberEvent(
        {
          guildId,
          userId: String(existingTicket.user_id || "").trim(),
          actorId,
          actorName,
          eventType: "verification_context_linked",
          title: "Verification Context Linked",
          reason:
            normalizeString(body?.approval_reason) ||
            "Verification entry context was linked from dashboard ticket override.",
          metadata: {
            ticket_id: ticketId,
            verification_ticket_id: ticketId,
            category_name: selectedCategoryName,
            category_slug: selectedCategorySlug,
            verification_source:
              normalizeString(body?.verification_source) ||
              "dashboard_manual_category_override",
          },
        },
        supabase
      );
    }

    const response = new Response(JSON.stringify({ ok: true, ticket }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    });

    applyAuthCookies(response, refreshedTokens);
    return response;
  } catch (error) {
    const message = error?.message || "Unauthorized";
    const status = message === "Unauthorized" ? 401 : 500;

    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    });
  }
}

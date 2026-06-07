import { NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { requireDashboardStaffSession, dashboardAuthJson, dashboardAuthErrorJson, type DashboardAuthSession } from "@/lib/dashboard-auth";
import { parseRouteBody, readBoolean, readString } from "@/lib/ticketActionRoute";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function normalizeString(value: unknown): string {
  return String(value ?? "").trim();
}

function actorIdFromSession(session: DashboardAuthSession | null): string {
  return normalizeString(session?.user?.discord_id || session?.user?.id || session?.discordUser?.id || "");
}

function json(payload: Record<string, unknown>, status = 200, session: DashboardAuthSession | null = null) {
  return dashboardAuthJson(payload, status, session);
}

function normalizeStatus(value: unknown): string {
  return normalizeString(value).toLowerCase();
}

function hasUsableChannel(ticket: any): boolean {
  return Boolean(normalizeString(ticket?.channel_id || ticket?.discord_thread_id));
}

function hasTranscriptEvidence(ticket: any): boolean {
  return Boolean(normalizeString(ticket?.transcript_url) || normalizeString(ticket?.transcript_message_id) || normalizeString(ticket?.transcript_channel_id));
}

function hasClosedEvidence(ticket: any): boolean {
  return Boolean(ticket?.closed_at || ticket?.deleted_at || hasTranscriptEvidence(ticket));
}

function buildTicketPatch(ticket: any, includeOpenWithMissingChannel: boolean, includeTranscriptBackfill: boolean) {
  const now = new Date().toISOString();
  const status = normalizeStatus(ticket?.status);
  const missingChannel = !hasUsableChannel(ticket);
  const hasTranscript = hasTranscriptEvidence(ticket);
  const hasEvidence = hasClosedEvidence(ticket);

  if (status === "deleted") {
    const patch: Record<string, unknown> = {};
    if (!ticket?.deleted_at) patch.deleted_at = now;
    if (!ticket?.updated_at) patch.updated_at = now;
    return Object.keys(patch).length ? patch : null;
  }

  if (status === "closed") {
    const patch: Record<string, unknown> = {};
    if (!ticket?.closed_at) patch.closed_at = now;
    if (!ticket?.updated_at) patch.updated_at = now;
    return Object.keys(patch).length ? patch : null;
  }

  if (includeTranscriptBackfill && (status === "open" || status === "claimed") && hasTranscript) {
    return {
      status: "closed",
      updated_at: now,
      closed_at: ticket?.closed_at || now,
      closed_reason: ticket?.closed_reason || "Reconciled by dashboard: transcript evidence indicates ticket was already handled.",
    };
  }

  if (includeOpenWithMissingChannel && missingChannel && (status === "open" || status === "claimed")) {
    return {
      status: "closed",
      updated_at: now,
      closed_at: ticket?.closed_at || now,
      closed_reason: ticket?.closed_reason || (hasEvidence ? "Reconciled by dashboard: ticket already had closure evidence." : "Reconciled by dashboard: ticket had no active Discord channel/thread."),
    };
  }

  if (missingChannel && hasEvidence && status !== "closed" && status !== "deleted") {
    return {
      status: ticket?.deleted_at ? "deleted" : "closed",
      updated_at: now,
      closed_at: ticket?.closed_at || (ticket?.deleted_at ? null : now),
      deleted_at: ticket?.deleted_at || null,
      closed_reason: ticket?.closed_reason || "Reconciled by dashboard: stale ticket row normalized from existing evidence.",
    };
  }

  return null;
}

function summarizeCandidate(ticket: any, patch: Record<string, unknown> | null) {
  return {
    id: ticket?.id || null,
    guild_id: ticket?.guild_id || null,
    channel_id: ticket?.channel_id || null,
    discord_thread_id: ticket?.discord_thread_id || null,
    title: ticket?.title || ticket?.channel_name || null,
    username: ticket?.username || null,
    status: ticket?.status || null,
    is_ghost: ticket?.is_ghost === true,
    updated_at: ticket?.updated_at || null,
    closed_at: ticket?.closed_at || null,
    deleted_at: ticket?.deleted_at || null,
    transcript_url: ticket?.transcript_url || null,
    transcript_message_id: ticket?.transcript_message_id || null,
    transcript_channel_id: ticket?.transcript_channel_id || null,
    patch,
  };
}

async function insertReconcileActivity(
  supabase: ReturnType<typeof createServerSupabase>,
  args: { guildId: string; actorId: string; dryRun: boolean; scanned: number; candidates: number; updated: number }
) {
  const now = new Date().toISOString();
  const eventType = args.dryRun ? "ticket_reconcile_preview" : "ticket_reconcile";
  const title = args.dryRun ? "Ticket reconcile preview" : "Ticket rows reconciled";
  const description = args.dryRun ? `Previewed ${args.candidates} ticket row(s) for reconciliation. Scanned ${args.scanned} row(s). Triggered by ${args.actorId}.` : `Reconciled ${args.updated} ticket row(s). Scanned ${args.scanned} row(s). Triggered by ${args.actorId}.`;
  const candidates = [
    { guild_id: args.guildId, title, description, event_family: "ticket", event_type: eventType, source: "dashboard_ticket_reconcile", actor_user_id: args.actorId, actor_name: args.actorId, related_id: args.actorId, metadata: { dry_run: args.dryRun, scanned: args.scanned, candidates: args.candidates, updated: args.updated }, created_at: now },
    { guild_id: args.guildId, title, description, event_type: eventType, source: "dashboard_ticket_reconcile", actor_user_id: args.actorId, actor_name: args.actorId, created_at: now },
  ];

  for (const candidate of candidates) {
    try {
      const { error } = await supabase.from("activity_feed_events").insert(candidate);
      if (!error) return;
    } catch {}
  }
}

export async function POST(req: NextRequest) {
  let session: DashboardAuthSession | null = null;

  try {
    session = await requireDashboardStaffSession();
    const actorId = actorIdFromSession(session);
    if (!actorId) return json({ ok: false, error: "Could not identify signed-in staff member.", error_code: "invalid_request" }, 400, session);

    const body = await parseRouteBody(req);
    const includeOpenWithMissingChannel = readBoolean(body, ["includeOpenWithMissingChannel", "include_open_with_missing_channel"], true);
    const includeTranscriptBackfill = readBoolean(body, ["includeTranscriptBackfill", "include_transcript_backfill"], true);
    const dryRun = readBoolean(body, ["dryRun", "dry_run"], false);
    const requestedBy = readString(body, ["requestedBy", "requested_by"], actorId) || actorId;
    const guildId = normalizeString(session.selectedGuildId);

    if (!guildId) return json({ ok: false, error: "Select a server before reconciling tickets.", error_code: "selected_server_required", needsServerSelection: true }, 428, session);

    const supabase = createServerSupabase();
    const { data: tickets, error: ticketsError } = await supabase.from("tickets").select("*").eq("guild_id", guildId).order("updated_at", { ascending: false }).limit(500);
    if (ticketsError) throw new Error(ticketsError.message || "Failed to load tickets");

    const rows = Array.isArray(tickets) ? tickets : [];
    const candidates = rows
      .map((ticket) => {
        const patch = buildTicketPatch(ticket, includeOpenWithMissingChannel, includeTranscriptBackfill);
        return patch ? { ticket, patch } : null;
      })
      .filter(Boolean) as Array<{ ticket: any; patch: Record<string, unknown> }>;

    let updated = 0;

    if (!dryRun) {
      for (const entry of candidates) {
        const ticketId = normalizeString(entry.ticket?.id);
        if (!ticketId) continue;
        const { error: updateError } = await supabase.from("tickets").update(entry.patch).eq("id", ticketId).eq("guild_id", guildId);
        if (!updateError) updated += 1;
      }
    }

    await insertReconcileActivity(supabase, { guildId, actorId, dryRun, scanned: rows.length, candidates: candidates.length, updated });

    const hidden = rows.filter((ticket) => {
      const status = normalizeStatus(ticket?.status);
      return !hasUsableChannel(ticket) && (status === "closed" || status === "deleted");
    }).length;

    return json(
      {
        ok: true,
        selectedGuildId: guildId,
        dryRun,
        scanned: rows.length,
        hidden,
        updated,
        removed: 0,
        includeOpenWithMissingChannel,
        includeTranscriptBackfill,
        requestedBy,
        effectiveRequestedBy: actorId,
        tickets: candidates.map(({ ticket, patch }) => summarizeCandidate(ticket, patch)),
      },
      200,
      session
    );
  } catch (error) {
    return dashboardAuthErrorJson(error, session, 500);
  }
}

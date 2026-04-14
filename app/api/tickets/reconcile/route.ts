import { NextRequest } from "next/server";
import { requireStaffSessionForRoute } from "@/lib/auth-server";
import { createServerSupabase } from "@/lib/supabase-server";
import { env } from "@/lib/env";
import {
  buildRouteJson,
  getActorId,
  parseRouteBody,
  readBoolean,
  readString,
  toErrorMessage,
  unauthorizedRouteResponse,
  type RefreshedTokens,
} from "@/lib/ticketActionRoute";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function normalizeString(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeStatus(value: unknown): string {
  return normalizeString(value).toLowerCase();
}

function hasUsableChannel(ticket: any): boolean {
  return Boolean(
    normalizeString(ticket?.channel_id || ticket?.discord_thread_id)
  );
}

function hasTranscriptEvidence(ticket: any): boolean {
  return Boolean(
    normalizeString(ticket?.transcript_url) ||
      normalizeString(ticket?.transcript_message_id) ||
      normalizeString(ticket?.transcript_channel_id)
  );
}

function hasClosedEvidence(ticket: any): boolean {
  return Boolean(
    ticket?.closed_at ||
      ticket?.deleted_at ||
      hasTranscriptEvidence(ticket)
  );
}

function buildTicketPatch(
  ticket: any,
  includeOpenWithMissingChannel: boolean,
  includeTranscriptBackfill: boolean
) {
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

  if (
    includeTranscriptBackfill &&
    (status === "open" || status === "claimed") &&
    hasTranscript
  ) {
    return {
      status: "closed",
      updated_at: now,
      closed_at: ticket?.closed_at || now,
      closed_reason:
        ticket?.closed_reason ||
        "Reconciled by dashboard: transcript evidence indicates ticket was already handled.",
    };
  }

  if (
    includeOpenWithMissingChannel &&
    missingChannel &&
    (status === "open" || status === "claimed")
  ) {
    return {
      status: "closed",
      updated_at: now,
      closed_at: ticket?.closed_at || now,
      closed_reason:
        ticket?.closed_reason ||
        (hasEvidence
          ? "Reconciled by dashboard: ticket already had closure evidence."
          : "Reconciled by dashboard: ticket had no active Discord channel/thread."),
    };
  }

  if (missingChannel && hasEvidence && status !== "closed" && status !== "deleted") {
    return {
      status: ticket?.deleted_at ? "deleted" : "closed",
      updated_at: now,
      closed_at: ticket?.closed_at || (ticket?.deleted_at ? null : now),
      deleted_at: ticket?.deleted_at || null,
      closed_reason:
        ticket?.closed_reason ||
        "Reconciled by dashboard: stale ticket row normalized from existing evidence.",
    };
  }

  return null;
}

function summarizeCandidate(ticket: any, patch: Record<string, unknown> | null) {
  return {
    id: ticket?.id || null,
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

function missingGuildIdResponse(refreshedTokens: RefreshedTokens | null) {
  return buildRouteJson(
    {
      ok: false,
      error: "Missing guild id",
    },
    500,
    refreshedTokens
  );
}

export async function POST(req: NextRequest) {
  let refreshedTokens: RefreshedTokens | null = null;

  try {
    const auth = await requireStaffSessionForRoute();
    refreshedTokens = auth?.refreshedTokens ?? null;

    const actorId = getActorId(auth?.session);
    if (!actorId) {
      return unauthorizedRouteResponse(refreshedTokens);
    }

    const body = await parseRouteBody(req);

    const includeOpenWithMissingChannel = readBoolean(
      body,
      ["includeOpenWithMissingChannel", "include_open_with_missing_channel"],
      true
    );

    const includeTranscriptBackfill = readBoolean(
      body,
      ["includeTranscriptBackfill", "include_transcript_backfill"],
      true
    );

    const dryRun = readBoolean(body, ["dryRun", "dry_run"], false);

    const requestedBy =
      readString(body, ["requestedBy", "requested_by"], actorId) || actorId;

    const guildId = normalizeString(env.guildId);
    if (!guildId) {
      return missingGuildIdResponse(refreshedTokens);
    }

    const supabase = createServerSupabase();

    const { data: tickets, error: ticketsError } = await supabase
      .from("tickets")
      .select("*")
      .eq("guild_id", guildId)
      .order("updated_at", { ascending: false })
      .limit(500);

    if (ticketsError) {
      throw new Error(ticketsError.message || "Failed to load tickets");
    }

    const rows = Array.isArray(tickets) ? tickets : [];

    const candidates = rows
      .map((ticket) => {
        const patch = buildTicketPatch(
          ticket,
          includeOpenWithMissingChannel,
          includeTranscriptBackfill
        );
        return patch ? { ticket, patch } : null;
      })
      .filter(Boolean) as Array<{ ticket: any; patch: Record<string, unknown> }>;

    let updated = 0;

    if (!dryRun) {
      for (const entry of candidates) {
        const ticketId = normalizeString(entry.ticket?.id);
        if (!ticketId) continue;

        const { error: updateError } = await supabase
          .from("tickets")
          .update(entry.patch)
          .eq("id", ticketId);

        if (!updateError) {
          updated += 1;
        }
      }

      await supabase.from("audit_events").insert({
        title: "Ticket rows reconciled",
        description: `Reconciled ${updated} ticket row(s) from dashboard truth. Scanned ${rows.length} row(s). Triggered by ${actorId}.`,
        event_type: "ticket_reconcile",
        related_id: actorId,
      });
    } else {
      await supabase.from("audit_events").insert({
        title: "Ticket reconcile preview",
        description: `Previewed ${candidates.length} ticket row(s) for reconciliation. Scanned ${rows.length} row(s). Triggered by ${actorId}.`,
        event_type: "ticket_reconcile_preview",
        related_id: actorId,
      });
    }

    const hidden = rows.filter((ticket) => {
      const status = normalizeStatus(ticket?.status);
      return !hasUsableChannel(ticket) && (status === "closed" || status === "deleted");
    }).length;

    return buildRouteJson(
      {
        ok: true,
        dryRun,
        scanned: rows.length,
        hidden,
        updated,
        removed: 0,
        includeOpenWithMissingChannel,
        includeTranscriptBackfill,
        requestedBy,
        effectiveRequestedBy: actorId,
        tickets: candidates.map(({ ticket, patch }) =>
          summarizeCandidate(ticket, patch)
        ),
      },
      200,
      refreshedTokens
    );
  } catch (error) {
    const message = toErrorMessage(error);

    return buildRouteJson(
      {
        ok: false,
        error: message,
      },
      message === "Unauthorized" ? 401 : 500,
      refreshedTokens
    );
  }
}

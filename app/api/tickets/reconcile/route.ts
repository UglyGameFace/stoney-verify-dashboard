import { NextRequest, NextResponse } from "next/server";
import { requireStaffSessionForRoute, applyAuthCookies } from "@/lib/auth-server";
import { createServerSupabase } from "@/lib/supabase-server";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getActorId(session: any): string | null {
  const candidates = [
    session?.user?.id,
    session?.user?.user_id,
    session?.user?.discord_id,
    session?.discordUser?.id,
  ];

  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  if (typeof candidates[0] === "number") {
    return String(candidates[0]);
  }

  return null;
}

function parseDateMs(value: unknown): number {
  const ms = new Date(String(value || "")).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function normalizeStatus(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function hasUsableChannel(ticket: any): boolean {
  return Boolean(
    String(ticket?.channel_id || ticket?.discord_thread_id || "").trim()
  );
}

function hasTranscriptEvidence(ticket: any): boolean {
  return Boolean(
    String(ticket?.transcript_url || "").trim() ||
      String(ticket?.transcript_message_id || "").trim() ||
      String(ticket?.transcript_channel_id || "").trim()
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

  // Normalize already-deleted rows
  if (status === "deleted") {
    const patch: Record<string, unknown> = {};
    if (!ticket?.deleted_at) patch.deleted_at = now;
    if (!ticket?.updated_at) patch.updated_at = now;
    return Object.keys(patch).length ? patch : null;
  }

  // Normalize already-closed rows
  if (status === "closed") {
    const patch: Record<string, unknown> = {};
    if (!ticket?.closed_at) patch.closed_at = now;
    if (!ticket?.updated_at) patch.updated_at = now;
    return Object.keys(patch).length ? patch : null;
  }

  // Transcript evidence should never leave a ticket looking open forever
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

  // Dead open/claimed rows with no usable channel should be closed during reconcile
  if (
    includeOpenWithMissingChannel &&
    missingChannel &&
    (status === "open" || status === "claimed")
  ) {
    return {
      status: hasTranscript ? "closed" : "closed",
      updated_at: now,
      closed_at: ticket?.closed_at || now,
      closed_reason:
        ticket?.closed_reason ||
        (hasEvidence
          ? "Reconciled by dashboard: ticket already had closure evidence."
          : "Reconciled by dashboard: ticket had no active Discord channel/thread."),
    };
  }

  // Rows with no channel but already carrying closure evidence should at least be normalized
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

export async function POST(req: NextRequest) {
  try {
    const { session, refreshedTokens } = await requireStaffSessionForRoute();
    const actorId = getActorId(session);

    if (!actorId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Unauthorized",
        },
        {
          status: 401,
          headers: {
            "Cache-Control": "no-store, max-age=0",
          },
        }
      );
    }

    const body = await req.json().catch(() => ({}));
    const includeOpenWithMissingChannel = Boolean(
      body?.includeOpenWithMissingChannel ?? true
    );
    const includeTranscriptBackfill = Boolean(
      body?.includeTranscriptBackfill ?? true
    );
    const dryRun = Boolean(body?.dryRun);

    const guildId = String(env.guildId || "").trim();
    if (!guildId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing guild id",
        },
        {
          status: 500,
          headers: {
            "Cache-Control": "no-store, max-age=0",
          },
        }
      );
    }

    const supabase = createServerSupabase();

    const { data: tickets, error: ticketsError } = await supabase
      .from("tickets")
      .select("*")
      .eq("guild_id", guildId)
      .order("updated_at", { ascending: false })
      .limit(500);

    if (ticketsError) {
      return NextResponse.json(
        {
          ok: false,
          error: ticketsError.message || "Failed to load tickets",
        },
        {
          status: 500,
          headers: {
            "Cache-Control": "no-store, max-age=0",
          },
        }
      );
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
        const ticketId = String(entry.ticket?.id || "").trim();
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

    const response = NextResponse.json(
      {
        ok: true,
        dryRun,
        scanned: rows.length,
        hidden,
        updated,
        removed: 0,
        tickets: candidates.map(({ ticket, patch }) =>
          summarizeCandidate(ticket, patch)
        ),
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );

    applyAuthCookies(response, refreshedTokens);
    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to reconcile tickets";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      {
        status: message === "Unauthorized" ? 401 : 500,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  }
}

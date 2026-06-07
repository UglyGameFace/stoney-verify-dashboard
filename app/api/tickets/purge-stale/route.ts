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

function parseDateMs(value: unknown): number {
  const ms = new Date(normalizeString(value)).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function isClosedLikeStatus(status: unknown): boolean {
  const value = normalizeString(status).toLowerCase();
  return value === "closed" || value === "deleted";
}

function hasUsableChannel(ticket: any): boolean {
  return Boolean(normalizeString(ticket?.channel_id || ticket?.discord_thread_id));
}

function isPurgeCandidate(ticket: any, olderThanMinutes: number): boolean {
  if (!ticket || typeof ticket !== "object") return false;
  const missingChannel = !hasUsableChannel(ticket);
  if (!missingChannel) return false;
  if (!isClosedLikeStatus(ticket?.status)) return false;
  const newestMs = Math.max(parseDateMs(ticket?.closed_at), parseDateMs(ticket?.deleted_at), parseDateMs(ticket?.updated_at), parseDateMs(ticket?.created_at));
  const ageMs = Date.now() - newestMs;
  return ageMs >= olderThanMinutes * 60 * 1000;
}

function summarizeCandidate(ticket: any) {
  return {
    id: ticket?.id || null,
    guild_id: ticket?.guild_id || null,
    channel_id: ticket?.channel_id || null,
    discord_thread_id: ticket?.discord_thread_id || null,
    status: ticket?.status || null,
    title: ticket?.title || ticket?.channel_name || null,
    username: ticket?.username || null,
    updated_at: ticket?.updated_at || null,
    closed_at: ticket?.closed_at || null,
    deleted_at: ticket?.deleted_at || null,
    is_ghost: ticket?.is_ghost === true,
  };
}

async function insertPurgeActivity(
  supabase: ReturnType<typeof createServerSupabase>,
  args: { guildId: string; actorId: string; dryRun: boolean; scanned: number; candidates: number; removed: number; olderThanMinutes: number }
) {
  const now = new Date().toISOString();
  const title = args.dryRun ? "Stale ticket purge preview" : "Stale tickets purged";
  const eventType = args.dryRun ? "ticket_purge_preview" : "ticket_purge";
  const description = `${args.dryRun ? "Previewed" : "Purged"} ${args.candidates} stale ticket row(s) older than ${args.olderThanMinutes} minute(s). Triggered by ${args.actorId}.`;
  const attempts = [
    {
      guild_id: args.guildId,
      title,
      description,
      event_family: "ticket",
      event_type: eventType,
      source: "dashboard_ticket_purge_stale",
      actor_user_id: args.actorId,
      actor_name: args.actorId,
      related_id: args.actorId,
      metadata: { dry_run: args.dryRun, scanned: args.scanned, candidates: args.candidates, removed: args.removed, older_than_minutes: args.olderThanMinutes },
      created_at: now,
    },
    { guild_id: args.guildId, title, description, event_type: eventType, source: "dashboard_ticket_purge_stale", actor_user_id: args.actorId, actor_name: args.actorId, created_at: now },
  ];

  for (const candidate of attempts) {
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
    const dryRun = readBoolean(body, ["dryRun", "dry_run"], false);
    const requestedBy = readString(body, ["requestedBy", "requested_by"], actorId) || actorId;
    const olderThanRaw = Number(readString(body, ["olderThanMinutes", "older_than_minutes"], "5"));
    const olderThanMinutes = Number.isFinite(olderThanRaw) && olderThanRaw > 0 ? Math.max(1, Math.floor(olderThanRaw)) : 5;
    const guildId = normalizeString(session.selectedGuildId);

    if (!guildId) return json({ ok: false, error: "Select a server before purging stale tickets.", error_code: "selected_server_required", needsServerSelection: true }, 428, session);

    const supabase = createServerSupabase();
    const { data: tickets, error: ticketsError } = await supabase.from("tickets").select("*").eq("guild_id", guildId).order("updated_at", { ascending: false }).limit(500);
    if (ticketsError) throw new Error(ticketsError.message || "Failed to load tickets");

    const rows = Array.isArray(tickets) ? tickets : [];
    const candidates = rows.filter((ticket) => isPurgeCandidate(ticket, olderThanMinutes));
    let removed = 0;

    if (!dryRun && candidates.length > 0) {
      const ids = candidates.map((ticket) => normalizeString(ticket?.id)).filter(Boolean);
      if (ids.length > 0) {
        const { error: deleteError, count } = await supabase.from("tickets").delete({ count: "exact" }).eq("guild_id", guildId).in("id", ids);
        if (deleteError) throw new Error(deleteError.message || "Failed to purge stale tickets");
        removed = Number(count || 0);
      }
    }

    await insertPurgeActivity(supabase, { guildId, actorId, dryRun, scanned: rows.length, candidates: candidates.length, removed, olderThanMinutes });

    return json(
      {
        ok: true,
        selectedGuildId: guildId,
        dryRun,
        scanned: rows.length,
        removed,
        olderThanMinutes,
        requestedBy,
        effectiveRequestedBy: actorId,
        candidates: candidates.map((ticket) => summarizeCandidate(ticket)),
      },
      200,
      session
    );
  } catch (error) {
    return dashboardAuthErrorJson(error, session, 500);
  }
}

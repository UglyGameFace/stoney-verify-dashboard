import { NextRequest, NextResponse } from "next/server";
import { requireStaffSessionForRoute } from "@/lib/auth-server";
import { getSelectedGuildId } from "@/lib/guild-selection";
import { getMyClaimedTicketsAction } from "@/lib/dashboardActions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SessionLike = {
  user?: {
    discord_id?: string | null;
    id?: string | null;
    user_id?: string | null;
    username?: string | null;
    name?: string | null;
  } | null;
  discordUser?: {
    id?: string | null;
    username?: string | null;
  } | null;
};

function normalizeNullable(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function resolveSelectedGuildId(): string {
  return normalizeNullable(getSelectedGuildId()) || "";
}

function resolveStaffIdFromSession(session: SessionLike): string {
  return (
    normalizeNullable(session?.user?.discord_id) ||
    normalizeNullable(session?.user?.id) ||
    normalizeNullable(session?.user?.user_id) ||
    normalizeNullable(session?.discordUser?.id) ||
    ""
  );
}

function buildUnauthorizedResponse() {
  return NextResponse.json(
    { ok: false, error: "Unauthorized" },
    { status: 401, headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}

function buildErrorResponse(message: string, status = 500, extra: Record<string, unknown> = {}) {
  return NextResponse.json(
    { ok: false, error: message, ...extra },
    { status, headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}

function buildSuccessResponse(payload: {
  selectedGuildId: string;
  queue?: unknown[];
  tickets?: unknown[];
  total?: number;
  unclaimed?: number;
  claimed?: number;
  staff_id?: string;
  staff_name?: string;
}) {
  const rows = Array.isArray(payload.tickets)
    ? payload.tickets
    : Array.isArray(payload.queue)
      ? payload.queue
      : [];

  return NextResponse.json(
    {
      ok: true,
      selectedGuildId: payload.selectedGuildId,
      queue: rows,
      tickets: rows,
      total: Number(payload.total || rows.length || 0),
      unclaimed: Number(payload.unclaimed || 0),
      claimed: typeof payload.claimed === "number" ? payload.claimed : rows.length,
      staff_id: payload.staff_id || null,
      staff_name: payload.staff_name || null,
    },
    { status: 200, headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}

async function handleRequest(_req: NextRequest) {
  try {
    const { session } = await requireStaffSessionForRoute();
    const typedSession = session as SessionLike;
    const guildId = resolveSelectedGuildId();
    const staffId = resolveStaffIdFromSession(typedSession);

    if (!guildId) {
      return buildErrorResponse(
        "Select a server before loading your claimed tickets.",
        428,
        { needsServerSelection: true }
      );
    }

    if (!staffId) {
      return buildErrorResponse("Could not identify signed-in staff member.", 400, {
        selectedGuildId: guildId,
      });
    }

    const result = await getMyClaimedTicketsAction({ guildId, staffId });

    if (!result.ok) {
      return buildErrorResponse(
        result.error || "Failed to load claimed tickets for this staff member.",
        500,
        { selectedGuildId: guildId }
      );
    }

    return buildSuccessResponse({
      selectedGuildId: guildId,
      queue: result.queue,
      tickets: result.tickets,
      total: result.total,
      unclaimed: result.unclaimed,
      claimed: result.claimed,
      staff_id: result.staff_id,
      staff_name: result.staff_name,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    if (message === "Unauthorized") return buildUnauthorizedResponse();
    return buildErrorResponse(message, 500);
  }
}

export async function GET(req: NextRequest) {
  return handleRequest(req);
}

export async function POST(req: NextRequest) {
  return handleRequest(req);
}

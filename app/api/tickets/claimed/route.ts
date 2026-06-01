import { NextRequest, NextResponse } from "next/server";
import { requireStaffSessionForRoute } from "@/lib/auth-server";
import { getSelectedGuildId } from "@/lib/guild-selection";
import { getClaimedTicketsAction } from "@/lib/dashboardActions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function normalizeNullable(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function resolveSelectedGuildId(): string {
  return normalizeNullable(getSelectedGuildId()) || "";
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
    await requireStaffSessionForRoute();

    const guildId = resolveSelectedGuildId();
    if (!guildId) {
      return buildErrorResponse(
        "Select a server before loading claimed tickets.",
        428,
        { needsServerSelection: true }
      );
    }

    const result = await getClaimedTicketsAction({ guildId });

    if (!result.ok) {
      return buildErrorResponse(
        result.error || "Failed to load claimed tickets.",
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

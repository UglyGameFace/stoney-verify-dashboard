import { NextRequest } from "next/server";
import { requireDashboardStaffSession, dashboardAuthJson, dashboardAuthErrorJson, type DashboardAuthSession } from "@/lib/dashboard-auth";
import { getClaimedTicketsAction } from "@/lib/dashboardActions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function normalizeNullable(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function buildErrorResponse(message: string, status = 500, session: DashboardAuthSession | null = null, extra: Record<string, unknown> = {}) {
  return dashboardAuthJson({ ok: false, error: message, ...extra }, status, session);
}

function buildSuccessResponse(
  payload: {
    selectedGuildId: string;
    queue?: unknown[];
    tickets?: unknown[];
    total?: number;
    unclaimed?: number;
    claimed?: number;
    staff_id?: string;
    staff_name?: string;
  },
  session: DashboardAuthSession | null
) {
  const rows = Array.isArray(payload.tickets) ? payload.tickets : Array.isArray(payload.queue) ? payload.queue : [];

  return dashboardAuthJson(
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
    200,
    session
  );
}

async function handleRequest(_req: NextRequest) {
  let session: DashboardAuthSession | null = null;

  try {
    session = await requireDashboardStaffSession();
    const guildId = normalizeNullable(session.selectedGuildId) || "";
    if (!guildId) return buildErrorResponse("Select a server before loading claimed tickets.", 428, session, { error_code: "selected_server_required", needsServerSelection: true });

    const result = await getClaimedTicketsAction({ guildId });
    if (!result.ok) return buildErrorResponse(result.error || "Failed to load claimed tickets.", 500, session, { selectedGuildId: guildId });

    return buildSuccessResponse(
      {
        selectedGuildId: guildId,
        queue: result.queue,
        tickets: result.tickets,
        total: result.total,
        unclaimed: result.unclaimed,
        claimed: result.claimed,
        staff_id: result.staff_id,
        staff_name: result.staff_name,
      },
      session
    );
  } catch (error) {
    return dashboardAuthErrorJson(error, session, 500);
  }
}

export async function GET(req: NextRequest) {
  return handleRequest(req);
}

export async function POST(req: NextRequest) {
  return handleRequest(req);
}

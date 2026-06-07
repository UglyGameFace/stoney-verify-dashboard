import { NextRequest } from "next/server";
import { requireDashboardStaffSession, dashboardAuthJson, dashboardAuthErrorJson, type DashboardAuthSession } from "@/lib/dashboard-auth";
import { getTicketQueueAction } from "@/lib/dashboardActions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function buildErrorResponse(message: string, status = 500, session: DashboardAuthSession | null = null, extra: Record<string, unknown> = {}) {
  return dashboardAuthJson(
    {
      ok: false,
      error: message,
      ...extra,
    },
    status,
    session
  );
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
  return dashboardAuthJson(
    {
      ok: true,
      selectedGuildId: payload.selectedGuildId,
      queue: Array.isArray(payload.queue) ? payload.queue : Array.isArray(payload.tickets) ? payload.tickets : [],
      tickets: Array.isArray(payload.tickets) ? payload.tickets : Array.isArray(payload.queue) ? payload.queue : [],
      total: Number(payload.total || 0),
      unclaimed: Number(payload.unclaimed || 0),
      claimed: Number(payload.claimed || 0),
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
    const guildId = clean(session.selectedGuildId);

    if (!guildId) {
      return buildErrorResponse(
        "Select a server before loading the ticket queue.",
        428,
        session,
        { error_code: "selected_server_required", needsServerSelection: true }
      );
    }

    const result = await getTicketQueueAction({ guildId });

    if (!result.ok) {
      return buildErrorResponse(
        result.error || "Failed to load ticket queue.",
        500,
        session,
        { selectedGuildId: guildId }
      );
    }

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

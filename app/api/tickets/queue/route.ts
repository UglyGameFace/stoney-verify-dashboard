import { NextRequest, NextResponse } from "next/server";
import { requireStaffSessionForRoute } from "@/lib/auth-server";
import { env } from "@/lib/env";
import { getTicketQueueAction } from "@/lib/dashboardActions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function normalizeNullable(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function resolveGuildIdFromRequest(
  req: NextRequest,
  body?: Record<string, unknown> | null
): string {
  return (
    normalizeNullable(body?.guildId) ||
    normalizeNullable(body?.guild_id) ||
    normalizeNullable(req.nextUrl.searchParams.get("guildId")) ||
    normalizeNullable(req.nextUrl.searchParams.get("guild_id")) ||
    normalizeNullable(env.guildId) ||
    ""
  );
}

function buildUnauthorizedResponse() {
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

function buildErrorResponse(message: string, status = 500) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}

function buildSuccessResponse(payload: {
  queue?: unknown[];
  tickets?: unknown[];
  total?: number;
  unclaimed?: number;
  claimed?: number;
  staff_id?: string;
  staff_name?: string;
}) {
  return NextResponse.json(
    {
      ok: true,
      queue: Array.isArray(payload.queue)
        ? payload.queue
        : Array.isArray(payload.tickets)
          ? payload.tickets
          : [],
      tickets: Array.isArray(payload.tickets)
        ? payload.tickets
        : Array.isArray(payload.queue)
          ? payload.queue
          : [],
      total: Number(payload.total || 0),
      unclaimed: Number(payload.unclaimed || 0),
      claimed: Number(payload.claimed || 0),
      staff_id: payload.staff_id || null,
      staff_name: payload.staff_name || null,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}

async function handleRequest(
  req: NextRequest,
  body?: Record<string, unknown> | null
) {
  try {
    await requireStaffSessionForRoute();

    const guildId = resolveGuildIdFromRequest(req, body);

    if (!guildId) {
      return buildErrorResponse("Missing guildId", 400);
    }

    const result = await getTicketQueueAction({
      guildId,
    });

    if (!result.ok) {
      return buildErrorResponse(
        result.error || "Failed to load ticket queue.",
        500
      );
    }

    return buildSuccessResponse({
      queue: result.queue,
      tickets: result.tickets,
      total: result.total,
      unclaimed: result.unclaimed,
      claimed: result.claimed,
      staff_id: result.staff_id,
      staff_name: result.staff_name,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error";

    if (message === "Unauthorized") {
      return buildUnauthorizedResponse();
    }

    return buildErrorResponse(message, 500);
  }
}

export async function GET(req: NextRequest) {
  return handleRequest(req, null);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as
      | Record<string, unknown>
      | null;

    return handleRequest(req, body);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid JSON body";

    return buildErrorResponse(message || "Invalid JSON body", 400);
  }
}

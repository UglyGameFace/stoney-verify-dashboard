import { NextRequest, NextResponse } from "next/server";
import { applyAuthCookies } from "@/lib/auth-server";

export type RouteBody = Record<string, unknown>;
export type RefreshedTokens = unknown;

export function getActorId(session: any): string | null {
  const candidates = [
    session?.user?.discord_id,
    session?.user?.id,
    session?.user?.user_id,
    session?.discordUser?.id,
  ];

  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return null;
}

export async function parseRouteBody(req: NextRequest): Promise<RouteBody> {
  try {
    const body = await req.json();
    return body && typeof body === "object" && !Array.isArray(body)
      ? (body as RouteBody)
      : {};
  } catch {
    return {};
  }
}

export function readString(
  body: RouteBody,
  keys: string[],
  fallback = ""
): string {
  for (const key of keys) {
    const value = body?.[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return fallback;
}

export function readBoolean(
  body: RouteBody,
  keys: string[],
  fallback = false
): boolean {
  for (const key of keys) {
    const value = body?.[key];

    if (typeof value === "boolean") return value;

    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on") {
        return true;
      }
      if (normalized === "false" || normalized === "0" || normalized === "no" || normalized === "off") {
        return false;
      }
    }

    if (typeof value === "number") {
      if (value === 1) return true;
      if (value === 0) return false;
    }
  }

  return fallback;
}

export function toErrorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : "Unexpected server error";
}

export function buildRouteJson(
  payload: Record<string, unknown>,
  status = 200,
  refreshedTokens: RefreshedTokens | null = null
): NextResponse {
  const response = NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  });

  applyAuthCookies(response, refreshedTokens);
  return response;
}

export function unauthorizedRouteResponse(
  refreshedTokens: RefreshedTokens | null = null
): NextResponse {
  return buildRouteJson(
    {
      ok: false,
      error: "Unauthorized",
    },
    401,
    refreshedTokens
  );
}

export function missingFieldRouteResponse(
  fieldName: string,
  refreshedTokens: RefreshedTokens | null = null
): NextResponse {
  return buildRouteJson(
    {
      ok: false,
      error: `Missing ${fieldName}`,
    },
    400,
    refreshedTokens
  );
}

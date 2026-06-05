import { cookies } from "next/headers";
import { applyAuthCookies, buildSession, refreshAccessToken } from "@/lib/auth-server";

const COOKIE_ACCESS = ["discord", "access", "token"].join("_");
const COOKIE_REFRESH = ["discord", "refresh", "token"].join("_");
const COOKIE_EXPIRES = ["discord", "expires", "at"].join("_");

type TokenPayload = Record<string, unknown> | null;

export type RouteSession = {
  bearer: string;
  refreshed: TokenPayload;
};

function clean(value: unknown): string {
  return String(value || "").trim();
}

function payloadBearer(payload: TokenPayload): string {
  return clean(payload?.[["access", "token"].join("_")]);
}

export async function getRouteSession(): Promise<RouteSession | null> {
  const store = cookies();
  let bearer = clean(store.get(COOKIE_ACCESS)?.value);
  const refreshValue = clean(store.get(COOKIE_REFRESH)?.value);
  const expiresAt = Number(store.get(COOKIE_EXPIRES)?.value || 0);
  let refreshed: TokenPayload = null;

  if (!bearer && !refreshValue) return null;

  const needsRefresh = !bearer || (expiresAt && Date.now() > expiresAt - 60_000);
  if (needsRefresh) {
    if (!refreshValue) return null;

    try {
      refreshed = (await refreshAccessToken(refreshValue)) as TokenPayload;
      bearer = payloadBearer(refreshed);
    } catch {
      return null;
    }
  }

  if (!bearer) return null;

  try {
    await buildSession(bearer);
  } catch {
    return null;
  }

  return { bearer, refreshed };
}

export function applyRouteSession<T extends { cookies: { set: Function } }>(response: T, session: RouteSession | null): T {
  applyAuthCookies(response, session?.refreshed as any);
  return response;
}

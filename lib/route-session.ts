import { cookies } from "next/headers";
import { applyAuthCookies, buildSession, refreshAccessToken } from "@/lib/auth-server";

const COOKIE_ACCESS = ["discord", "access", "token"].join("_");
const COOKIE_REFRESH = ["discord", "refresh", "token"].join("_");
const COOKIE_EXPIRES = ["discord", "expires", "at"].join("_");
const ACCESS_FIELD = ["access", "token"].join("_");

type TokenPayload = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
} | null;

export type RouteSession = {
  bearer: string;
  refreshed: TokenPayload;
};

function clean(value: unknown): string {
  return String(value || "").trim();
}

function payloadBearer(payload: TokenPayload): string {
  return clean(payload?.[ACCESS_FIELD]);
}

async function tryRefresh(refreshValue: string): Promise<RouteSession | null> {
  if (!refreshValue) return null;

  try {
    const refreshed = (await refreshAccessToken(refreshValue)) as TokenPayload;
    const bearer = payloadBearer(refreshed);

    if (!bearer) return null;

    await buildSession(bearer);

    return {
      bearer,
      refreshed,
    };
  } catch {
    return null;
  }
}

export async function getRouteSession(): Promise<RouteSession | null> {
  const store = cookies();

  const refreshValue = clean(store.get(COOKIE_REFRESH)?.value);
  const expiresAt = Number(store.get(COOKIE_EXPIRES)?.value || 0);
  const bearer = clean(store.get(COOKIE_ACCESS)?.value);

  if (!bearer && !refreshValue) return null;

  const needsRefresh =
    !bearer || Boolean(expiresAt && Date.now() > expiresAt - 60_000);

  if (needsRefresh) {
    return await tryRefresh(refreshValue);
  }

  try {
    await buildSession(bearer);

    return {
      bearer,
      refreshed: null,
    };
  } catch {
    // If Discord rejects the access token even though the cookie says it
    // should still be valid, try the refresh token before forcing reauth.
    return await tryRefresh(refreshValue);
  }
}

export function applyRouteSession<T extends { cookies: { set: Function } }>(
  response: T,
  session: RouteSession | null
): T {
  applyAuthCookies(response, session?.refreshed || null);
  return response;
}

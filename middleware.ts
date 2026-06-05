import { NextResponse, type NextRequest } from "next/server";

const ACCESS_COOKIE = "discord_access_token";
const REFRESH_COOKIE = "discord_refresh_token";
const EXPIRES_COOKIE = "discord_expires_at";

const REFRESH_SKEW_MS = 60_000;
const ACCESS_FALLBACK_MAX_AGE = 60 * 60 * 24 * 7;
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30;

type DiscordTokenPayload = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
};

function clean(value: unknown): string {
  return String(value || "").trim();
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

function shouldRefresh(request: NextRequest): boolean {
  const accessToken = clean(request.cookies.get(ACCESS_COOKIE)?.value);
  const refreshToken = clean(request.cookies.get(REFRESH_COOKIE)?.value);
  const expiresAt = Number(request.cookies.get(EXPIRES_COOKIE)?.value || 0);

  if (!refreshToken) return false;
  if (!accessToken) return true;
  if (!expiresAt) return false;

  return Date.now() > expiresAt - REFRESH_SKEW_MS;
}

async function refreshDiscordToken(refreshToken: string): Promise<DiscordTokenPayload | null> {
  const clientId = clean(process.env.DISCORD_CLIENT_ID || process.env.CLIENT_ID || process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID);
  const clientSecret = clean(process.env.DISCORD_CLIENT_SECRET || process.env.DISCORD_CLIENT_SECRET_KEY);

  if (!clientId || !clientSecret || !refreshToken) return null;

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  try {
    const res = await fetch("https://discord.com/api/v10/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      cache: "no-store",
    });

    if (!res.ok) return null;
    return (await res.json()) as DiscordTokenPayload;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const refreshToken = clean(request.cookies.get(REFRESH_COOKIE)?.value);

  if (!shouldRefresh(request)) {
    return NextResponse.next();
  }

  const refreshed = await refreshDiscordToken(refreshToken);
  const response = NextResponse.next();

  if (!refreshed?.access_token) {
    return response;
  }

  const accessMaxAge = refreshed.expires_in || ACCESS_FALLBACK_MAX_AGE;
  const expiresAtMs = Date.now() + accessMaxAge * 1000;

  response.cookies.set(ACCESS_COOKIE, refreshed.access_token, cookieOptions(accessMaxAge));

  if (refreshed.refresh_token) {
    response.cookies.set(REFRESH_COOKIE, refreshed.refresh_token, cookieOptions(REFRESH_MAX_AGE));
  }

  response.cookies.set(EXPIRES_COOKIE, String(expiresAtMs), cookieOptions(REFRESH_MAX_AGE));
  return response;
}

export const config = {
  matcher: [
    "/",
    "/servers",
    "/auth-status",
    "/ticket-categories/:path*",
    "/ticket-forms/:path*",
    "/tickets/:path*",
  ],
};

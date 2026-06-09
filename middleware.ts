import { NextResponse, type NextRequest } from "next/server";

const ACCESS_COOKIE = "discord_access_token";
const REFRESH_COOKIE = "discord_refresh_token";
const EXPIRES_COOKIE = "discord_expires_at";
const REFRESH_FAILED_COOKIE = "dank_auth_refresh_failed";
const REFRESH_SKEW_MS = 60_000;

function clean(value: unknown): string {
  return String(value || "").trim();
}

function isSafeMethod(method: string): boolean {
  return method === "GET" || method === "HEAD";
}

function needsRefresh(request: NextRequest): boolean {
  const accessToken = clean(request.cookies.get(ACCESS_COOKIE)?.value);
  const refreshToken = clean(request.cookies.get(REFRESH_COOKIE)?.value);
  const refreshFailed = clean(request.cookies.get(REFRESH_FAILED_COOKIE)?.value);
  const expiresAt = Number(request.cookies.get(EXPIRES_COOKIE)?.value || 0);

  if (refreshFailed) return false;
  if (!refreshToken) return false;
  if (!accessToken) return true;
  if (!expiresAt) return false;

  return Date.now() > expiresAt - REFRESH_SKEW_MS;
}

function buildReturnTo(request: NextRequest): string {
  return `${request.nextUrl.pathname}${request.nextUrl.search}` || "/";
}

export function middleware(request: NextRequest) {
  if (!isSafeMethod(request.method)) {
    return NextResponse.next();
  }

  if (!needsRefresh(request)) {
    return NextResponse.next();
  }

  const refreshUrl = request.nextUrl.clone();
  refreshUrl.pathname = "/api/auth/refresh";
  refreshUrl.search = "";
  refreshUrl.searchParams.set("return_to", buildReturnTo(request));

  return NextResponse.redirect(refreshUrl);
}

export const config = {
  matcher: [
    "/",
    "/servers",
    "/auth-status",
    "/dashboard/:path*",
    "/ticket-categories/:path*",
    "/ticket-forms/:path*",
    "/tickets/:path*",
  ],
};

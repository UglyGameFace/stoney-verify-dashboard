import { NextResponse } from "next/server";
import {
  applyAuthCookies,
  clearAuthCookies,
  getCookieOptions,
  refreshAccessToken,
} from "@/lib/auth-server";
import { normalizeAuthReturnTo } from "@/lib/auth-return";

const REFRESH_COOKIE = "discord_refresh_token";

function clean(value) {
  return String(value || "").trim();
}

function redirectTo(request, path) {
  return NextResponse.redirect(new URL(path, request.url));
}

function loginRedirect(request, returnTo) {
  return redirectTo(request, `/api/auth/login?return_to=${encodeURIComponent(returnTo)}`);
}

export async function GET(request) {
  const url = new URL(request.url);
  const returnTo = normalizeAuthReturnTo(url.searchParams.get("return_to"), "/auth-status");
  const refreshToken = clean(request.cookies.get(REFRESH_COOKIE)?.value);

  if (!refreshToken) {
    const response = loginRedirect(request, returnTo);
    clearAuthCookies(response);
    return response;
  }

  try {
    const token = await refreshAccessToken(refreshToken);
    const response = redirectTo(request, returnTo);
    applyAuthCookies(response, token);
    return response;
  } catch {
    const response = loginRedirect(request, returnTo);
    clearAuthCookies(response);
    response.cookies.set("dank_auth_refresh_failed", "1", getCookieOptions(60));
    return response;
  }
}

import { env } from "@/lib/env";

function normalizeString(value: unknown): string {
  return String(value || "").trim();
}

function cleanOrigin(value: unknown): string {
  return normalizeString(value).replace(/\/+$/, "");
}

export function getRequestOrigin(request: Request): string {
  const url = new URL(request.url);
  const forwardedProto = normalizeString(request.headers.get("x-forwarded-proto"));
  const forwardedHost = normalizeString(request.headers.get("x-forwarded-host"));
  const host = forwardedHost || normalizeString(request.headers.get("host"));
  const proto = forwardedProto || url.protocol.replace(":", "") || "https";

  if (host) {
    return `${proto}://${host}`;
  }

  return url.origin;
}

export function getConfiguredOrigin(request?: Request): string {
  const configured = [
    env.appUrl,
    env.siteUrl,
    env.baseUrl,
    env.publicUrl,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.SITE_URL,
    process.env.APP_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "",
  ]
    .map(cleanOrigin)
    .filter(Boolean);

  if (configured.length) return configured[0];
  if (request) return getRequestOrigin(request);
  return "http://127.0.0.1:3000";
}

export function dashboardRedirectUrl(request: Request, pathname = "/"): URL {
  const origin = getConfiguredOrigin(request) || getRequestOrigin(request);
  return new URL(pathname, origin);
}

export function authErrorRedirectUrl(request: Request, message: string): URL {
  const url = dashboardRedirectUrl(request, "/auth-status");
  url.searchParams.set("authError", message || "oauth_failed");
  return url;
}

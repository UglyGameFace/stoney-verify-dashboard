export const OAUTH_STATE_COOKIE = "dank_oauth_state";
export const AUTH_RETURN_TO_COOKIE = "dank_auth_return_to";

const DEFAULT_RETURN_TO = "/auth-status";
const MAX_RETURN_TO_LENGTH = 500;
const BLOCKED_RETURN_PREFIXES = [
  "/api/auth/login",
  "/api/auth/callback",
  "/api/auth/logout",
  "/api/auth/refresh",
];

function normalizeString(value: unknown): string {
  return String(value || "").trim();
}

export function normalizeAuthReturnTo(value: unknown, fallback = DEFAULT_RETURN_TO): string {
  const fallbackPath = normalizeString(fallback).startsWith("/") ? normalizeString(fallback) : DEFAULT_RETURN_TO;
  const raw = normalizeString(value);

  if (!raw) return fallbackPath;
  if (raw.startsWith("//")) return fallbackPath;
  if (/^https?:\/\//i.test(raw)) return fallbackPath;
  if (!raw.startsWith("/")) return fallbackPath;

  const pathname = raw.split("#")[0]?.split("?")[0] || "/";
  const blocked = BLOCKED_RETURN_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (blocked) return fallbackPath;
  return raw.slice(0, MAX_RETURN_TO_LENGTH);
}

export function createOAuthState(): string {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === "function") {
    return cryptoObj.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function loginRouteFor(returnTo: unknown, fallback = DEFAULT_RETURN_TO): string {
  const safeReturnTo = normalizeAuthReturnTo(returnTo, fallback);
  return `/api/auth/login?return_to=${encodeURIComponent(safeReturnTo)}`;
}

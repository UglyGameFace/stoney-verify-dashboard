import crypto from "crypto";
import { normalizeAuthReturnTo } from "@/lib/auth-return";

const STATE_VERSION = "v1";
const STATE_TTL_MS = 10 * 60 * 1000;

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  return Buffer.from(padded, "base64").toString("utf8");
}

function timingSafeEqualString(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function getOAuthStateSecret() {
  return String(
    process.env.OAUTH_STATE_SECRET ||
      process.env.NEXTAUTH_SECRET ||
      process.env.AUTH_SECRET ||
      process.env.DISCORD_CLIENT_SECRET ||
      ""
  ).trim();
}

function signPayload(payload) {
  const secret = getOAuthStateSecret();
  if (!secret) throw new Error("Missing OAuth state signing secret.");
  return base64UrlEncode(crypto.createHmac("sha256", secret).update(payload).digest());
}

export function createSignedOAuthState(returnTo) {
  const payload = base64UrlEncode(
    JSON.stringify({
      v: STATE_VERSION,
      n: crypto.randomBytes(16).toString("hex"),
      r: normalizeAuthReturnTo(returnTo, "/auth-status"),
      iat: Date.now(),
    })
  );
  return `${payload}.${signPayload(payload)}`;
}

export function verifySignedOAuthState(state) {
  const value = String(state || "").trim();
  const [payload, signature, extra] = value.split(".");

  if (!payload || !signature || extra !== undefined) {
    return { ok: false, error: "invalid_discord_oauth_state", returnTo: "/auth-status" };
  }

  const expectedSignature = signPayload(payload);
  if (!timingSafeEqualString(signature, expectedSignature)) {
    return { ok: false, error: "invalid_discord_oauth_state", returnTo: "/auth-status" };
  }

  try {
    const parsed = JSON.parse(base64UrlDecode(payload));
    const issuedAt = Number(parsed?.iat || 0);
    const age = Date.now() - issuedAt;

    if (parsed?.v !== STATE_VERSION || !Number.isFinite(issuedAt) || age < 0 || age > STATE_TTL_MS) {
      return { ok: false, error: "expired_discord_oauth_state", returnTo: normalizeAuthReturnTo(parsed?.r, "/auth-status") };
    }

    return {
      ok: true,
      returnTo: normalizeAuthReturnTo(parsed?.r, "/auth-status"),
    };
  } catch {
    return { ok: false, error: "invalid_discord_oauth_state", returnTo: "/auth-status" };
  }
}

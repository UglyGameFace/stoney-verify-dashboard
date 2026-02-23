// lib/session.ts
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import crypto from "crypto";

export type StaffSession = {
  userId: string;
  username: string;
  avatar?: string | null;
  roles?: string[];
  guildId?: string;
  iat: number;
  exp: number;
};

const COOKIE_NAME = "sv_staff_session";

function mustGet(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function b64url(buf: Buffer) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function sign(payload: string) {
  const secret = mustGet("SESSION_SECRET");
  const sig = crypto.createHmac("sha256", secret).update(payload).digest();
  return b64url(sig);
}

export function encodeSession(s: StaffSession) {
  const payload = b64url(Buffer.from(JSON.stringify(s), "utf8"));
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

export function decodeSession(token: string): StaffSession | null {
  try {
    const [payload, sig] = token.split(".");
    if (!payload || !sig) return null;
    if (sign(payload) !== sig) return null;
    const json = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const s = JSON.parse(json) as StaffSession;
    if (!s?.exp || Date.now() / 1000 >= s.exp) return null;
    return s;
  } catch {
    return null;
  }
}

// ✅ read still works server-side anywhere
export async function getSession(): Promise<StaffSession | null> {
  const c = cookies().get(COOKIE_NAME)?.value;
  if (!c) return null;
  return decodeSession(c);
}

// ✅ NEW: write cookie onto a NextResponse (Route Handler safe)
export function setSessionCookie(res: NextResponse, s: StaffSession) {
  const value = encodeSession(s);
  res.cookies.set({
    name: COOKIE_NAME,
    value,
    httpOnly: true,
    secure: true,      // Vercel is https
    sameSite: "lax",
    path: "/",
    maxAge: Math.max(60, s.exp - Math.floor(Date.now() / 1000)),
  });
}

// ✅ NEW: clear cookie onto a NextResponse
export function clearSessionCookie(res: NextResponse) {
  res.cookies.set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

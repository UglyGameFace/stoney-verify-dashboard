import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { mustGet } from "@/lib/env";

const COOKIE_NAME = "sv_staff_session";

type SessionPayload = {
  sub: string; // discord user id
  username: string;
  roles: string[];
};

function secretKey() {
  const secret = mustGet("SESSION_SECRET");
  return new TextEncoder().encode(secret);
}

export async function setSession(payload: SessionPayload) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(secretKey());

  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
  });
}

export function clearSession() {
  cookies().set(COOKIE_NAME, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
}

export async function getSession(): Promise<SessionPayload | null> {
  const c = cookies().get(COOKIE_NAME);
  if (!c?.value) return null;
  try {
    const { payload } = await jwtVerify(c.value, secretKey());
    const sub = String(payload.sub || "");
    const username = String((payload as any).username || "");
    const roles = Array.isArray((payload as any).roles) ? ((payload as any).roles as any[]).map(String) : [];
    if (!sub) return null;
    return { sub, username, roles };
  } catch {
    return null;
  }
}

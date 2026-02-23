import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { mustGet } from "@/lib/env";

const COOKIE_NAME = "sv_staff_session";

export type StaffSession = {
  // canonical
  userId: string;
  username: string;
  roles: string[];
  avatar?: string | null;
  guildId?: string | null;

  // legacy aliases kept for compatibility during iteration
  id?: string;
  sub?: string;
};

function secretKey() {
  const secret = mustGet("JWT_SECRET");
  return new TextEncoder().encode(secret);
}

export async function setSession(payload: StaffSession) {
  const sub = String(payload.userId || payload.id || payload.sub || "");
  const username = String(payload.username || "");
  const roles = Array.isArray(payload.roles) ? payload.roles.map(String) : [];
  const avatar = payload.avatar ?? null;
  const guildId = payload.guildId ?? null;

  if (!sub) throw new Error("Missing session subject (discord id)");
  if (!username) throw new Error("Missing session username");

  const token = await new SignJWT({ sub, username, roles, avatar, guildId })
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
  cookies().set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getSession(): Promise<StaffSession | null> {
  const c = cookies().get(COOKIE_NAME);
  if (!c?.value) return null;

  try {
    const { payload } = await jwtVerify(c.value, secretKey());

    const sub = String(payload.sub || "");
    const username = String((payload as any).username || "");
    const roles = Array.isArray((payload as any).roles) ? ((payload as any).roles as any[]).map(String) : [];
    const avatar = (payload as any).avatar == null ? null : String((payload as any).avatar);
    const guildId = (payload as any).guildId == null ? null : String((payload as any).guildId);

    if (!sub || !username) return null;

    return {
      userId: sub,
      username,
      roles,
      avatar,
      guildId,
      // legacy aliases
      id: sub,
      sub,
    };
  } catch {
    return null;
  }
}

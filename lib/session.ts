// lib/session.ts
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { mustGet } from "@/lib/env";

const COOKIE_NAME = "sv_staff_session";

export type StaffSession = {
  // canonical
  userId: string;
  username: string;
  roles: string[];
  guildId?: string | null;

  // optional extras (safe to keep)
  avatar?: string | null;

  // legacy aliases (don’t remove; helps stop “breaking things”)
  id?: string;
  sub?: string;
};

function secretKey() {
  const secret = mustGet("JWT_SECRET");
  return new TextEncoder().encode(secret);
}

export async function setSession(payload: StaffSession) {
  const userId = String(payload.userId || payload.id || payload.sub || "");
  const username = String(payload.username || "");
  const roles = Array.isArray(payload.roles) ? payload.roles.map(String) : [];
  const guildId = payload.guildId == null ? null : String(payload.guildId);
  const avatar = payload.avatar == null ? null : String(payload.avatar);

  if (!userId) throw new Error("Missing session userId");
  if (!username) throw new Error("Missing session username");

  const token = await new SignJWT({
    userId,
    username,
    roles,
    guildId,
    avatar,
  })
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

    const userId = String((payload as any).userId || payload.sub || "");
    const username = String((payload as any).username || "");
    const roles = Array.isArray((payload as any).roles) ? (payload as any).roles.map(String) : [];
    const guildId = (payload as any).guildId == null ? null : String((payload as any).guildId);
    const avatar = (payload as any).avatar == null ? null : String((payload as any).avatar);

    if (!userId || !username) return null;

    // include legacy aliases to keep old code paths happy
    return { userId, username, roles, guildId, avatar, id: userId, sub: userId };
  } catch {
    return null;
  }
}

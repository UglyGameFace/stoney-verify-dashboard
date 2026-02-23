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

function normalizeSession(raw: any): StaffSession | null {
  if (!raw || typeof raw !== "object") return null;

  const userId = String(raw.userId || raw.id || raw.sub || "");
  const username = String(raw.username || "");
  const roles = Array.isArray(raw.roles) ? raw.roles.map(String) : [];
  const avatar = raw.avatar == null ? null : String(raw.avatar);
  const guildId = raw.guildId == null ? null : String(raw.guildId);

  if (!userId || !username) return null;

  const s: StaffSession = {
    userId,
    username,
    roles,
    avatar,
    guildId,
    id: raw.id ?? userId,
    sub: raw.sub ?? userId,
  };

  return s;
}

function secretKey() {
  const secret = mustGet("JWT_SECRET");
  return new TextEncoder().encode(secret);
}

export async function setSession(payload: Omit<StaffSession, "id" | "sub"> & { id?: string; sub?: string }) {
  const userId = String(payload.userId || payload.id || payload.sub || "");
  const username = String(payload.username || "");
  const roles = Array.isArray(payload.roles) ? payload.roles.map(String) : [];

  if (!userId) throw new Error("Missing session subject (discord id)");

  const token = await new SignJWT({
    sub: userId,
    username,
    roles,
    avatar: payload.avatar ?? null,
    guildId: payload.guildId ?? null,
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

    const raw = {
      userId: payload.sub,
      username: (payload as any).username,
      roles: (payload as any).roles,
      avatar: (payload as any).avatar,
      guildId: (payload as any).guildId,
      id: payload.sub,
      sub: payload.sub,
    };

    return normalizeSession(raw);
  } catch {
    return null;
  }
}

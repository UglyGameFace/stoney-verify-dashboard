import { cookies } from "next/headers";
import { env } from "@/lib/env";

export const SELECTED_GUILD_COOKIE = "dank_selected_guild_id";

function normalizeString(value: unknown): string {
  return String(value || "").trim();
}

export function getGuildCookieOptions(maxAgeSec = 60 * 60 * 24 * 30) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: env.isProduction,
    path: "/",
    maxAge: maxAgeSec,
  };
}

export function getSelectedGuildId(): string {
  const selected = normalizeString(cookies().get(SELECTED_GUILD_COOKIE)?.value);
  return selected || normalizeString(env.guildId || env.discordGuildId);
}

export function getExplicitSelectedGuildId(): string {
  return normalizeString(cookies().get(SELECTED_GUILD_COOKIE)?.value);
}

export function setSelectedGuildCookie<T extends { cookies: { set: Function } }>(
  response: T,
  guildId: string
): T {
  response.cookies.set(
    SELECTED_GUILD_COOKIE,
    normalizeString(guildId),
    getGuildCookieOptions()
  );
  return response;
}

export function clearSelectedGuildCookie<T extends { cookies: { set: Function } }>(
  response: T
): T {
  response.cookies.set(SELECTED_GUILD_COOKIE, "", getGuildCookieOptions(0));
  return response;
}

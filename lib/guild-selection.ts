import { cookies } from "next/headers";
import { env } from "@/lib/env";

export const SELECTED_GUILD_COOKIE = "dank_selected_guild_id";
export const SELECTED_GUILD_ACCESS_COOKIE = "dank_selected_guild_access";

function normalizeString(value: unknown): string {
  return String(value || "").trim();
}

function defaultGuildFallback(): string {
  if (!env.allowDefaultGuildFallback) return "";
  return normalizeString(env.guildId || env.discordGuildId);
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
  return selected || defaultGuildFallback();
}

export function getExplicitSelectedGuildId(): string {
  return normalizeString(cookies().get(SELECTED_GUILD_COOKIE)?.value);
}

export function getSelectedGuildAccessProof(): string {
  return normalizeString(cookies().get(SELECTED_GUILD_ACCESS_COOKIE)?.value);
}

export function hasSelectedGuildManagerProof(): boolean {
  const proof = getSelectedGuildAccessProof().toLowerCase();
  return proof === "manager" || proof === "owner" || proof === "admin";
}

export function setSelectedGuildCookie<T extends { cookies: { set: Function } }>(
  response: T,
  guildId: string,
  accessProof = "manager"
): T {
  response.cookies.set(
    SELECTED_GUILD_COOKIE,
    normalizeString(guildId),
    getGuildCookieOptions()
  );
  response.cookies.set(
    SELECTED_GUILD_ACCESS_COOKIE,
    normalizeString(accessProof) || "manager",
    getGuildCookieOptions()
  );
  return response;
}

export function clearSelectedGuildCookie<T extends { cookies: { set: Function } }>(
  response: T
): T {
  response.cookies.set(SELECTED_GUILD_COOKIE, "", getGuildCookieOptions(0));
  response.cookies.set(SELECTED_GUILD_ACCESS_COOKIE, "", getGuildCookieOptions(0));
  return response;
}

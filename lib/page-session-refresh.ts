import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { normalizeAuthReturnTo } from "@/lib/auth-return";

const ACCESS_COOKIE = "discord_access_token";
const REFRESH_COOKIE = "discord_refresh_token";
const EXPIRES_COOKIE = "discord_expires_at";

function clean(value: unknown): string {
  return String(value || "").trim();
}

export function refreshPageSessionIfNeeded(returnTo: string): void {
  const store = cookies();
  const accessToken = clean(store.get(ACCESS_COOKIE)?.value);
  const refreshToken = clean(store.get(REFRESH_COOKIE)?.value);
  const expiresAt = Number(store.get(EXPIRES_COOKIE)?.value || 0);

  if (!refreshToken) return;
  const shouldRefresh = !accessToken || Boolean(expiresAt && Date.now() > expiresAt - 60_000);
  if (!shouldRefresh) return;

  const safeReturnTo = normalizeAuthReturnTo(returnTo, "/auth-status");
  redirect(`/api/auth/refresh?return_to=${encodeURIComponent(safeReturnTo)}`);
}

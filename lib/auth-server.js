import { cookies } from "next/headers";
import { env, assertOAuthEnv } from "@/lib/env";
import { discordUserFetch, discordBotFetch, fetchGuildRoles } from "@/lib/discord-api";

const ACCESS_COOKIE = "discord_access_token";
const REFRESH_COOKIE = "discord_refresh_token";
const EXPIRES_COOKIE = "discord_expires_at";

export function getCookieOptions(maxAgeSec) {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProduction,
    path: "/",
    maxAge: maxAgeSec,
  };
}

export function hasDiscordOAuthConfig() {
  return Boolean(
    env.discordClientId &&
      env.discordClientSecret &&
      env.discordRedirectUri &&
      env.guildId &&
      env.appUrl
  );
}

export function getDiscordLoginUrl() {
  assertOAuthEnv();

  const params = new URLSearchParams({
    client_id: env.discordClientId,
    response_type: "code",
    redirect_uri: env.discordRedirectUri,
    scope: "identify guilds guilds.members.read",
  });

  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(code) {
  assertOAuthEnv();

  const body = new URLSearchParams({
    client_id: env.discordClientId,
    client_secret: env.discordClientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: env.discordRedirectUri,
  });

  const res = await fetch("https://discord.com/api/v10/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`OAuth token exchange failed: ${await res.text()}`);
  }

  return res.json();
}

export async function refreshAccessToken(refreshToken) {
  assertOAuthEnv();

  const body = new URLSearchParams({
    client_id: env.discordClientId,
    client_secret: env.discordClientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const res = await fetch("https://discord.com/api/v10/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`OAuth refresh failed: ${await res.text()}`);
  }

  return res.json();
}

function normalizeRoleName(value) {
  return String(value || "").trim().toLowerCase();
}

function safeText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function getDiscordDefaultAvatarIndex(user) {
  try {
    const discriminator = safeText(user?.discriminator, "0");

    if (discriminator && discriminator !== "0") {
      const parsed = Number.parseInt(discriminator, 10);
      if (Number.isFinite(parsed)) {
        return ((parsed % 5) + 5) % 5;
      }
    }

    const snowflake = BigInt(String(user?.id || "0"));
    return Number((snowflake >> 22n) % 6n);
  } catch {
    return 0;
  }
}

function buildDiscordAvatarUrl(user) {
  const userId = safeText(user?.id);
  const avatar = safeText(user?.avatar);

  if (!userId) return null;

  if (avatar) {
    const isAnimated = avatar.startsWith("a_");
    return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.${isAnimated ? "gif" : "png"}?size=256`;
  }

  const index = getDiscordDefaultAvatarIndex(user);
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

function buildBannerUrl(user) {
  const userId = safeText(user?.id);
  const banner = safeText(user?.banner);

  if (!userId || !banner) return null;

  const isAnimated = banner.startsWith("a_");
  return `https://cdn.discordapp.com/banners/${userId}/${banner}.${isAnimated ? "gif" : "png"}?size=512`;
}

function deriveMemberAccessFlags(memberRoleIds, memberRoleNamesLower) {
  const hasStaffRole =
    memberRoleIds.some((id) => env.staffRoleIds.includes(String(id))) ||
    memberRoleNamesLower.some((name) => env.staffRoleNames.includes(name));

  const hasVerifiedRole =
    memberRoleNamesLower.some((name) =>
      [
        "verified",
        "resident",
        "member",
      ].includes(name)
    ) || memberRoleNamesLower.some((name) => name.includes("verified"));

  const hasUnverifiedRole = memberRoleNamesLower.some(
    (name) => name === "unverified" || name.includes("unverified")
  );

  let accessLabel = "Unknown";
  let verificationLabel = "Unknown";

  if (hasStaffRole) {
    accessLabel = "Staff";
    verificationLabel = "Staff";
  } else if (hasVerifiedRole) {
    accessLabel = "Verified";
    verificationLabel = "Verified";
  } else if (hasUnverifiedRole) {
    accessLabel = "Limited";
    verificationLabel = "Pending Verification";
  }

  return {
    hasStaffRole,
    hasVerifiedRole,
    hasUnverifiedRole,
    accessLabel,
    verificationLabel,
  };
}

export async function buildSession(accessToken) {
  const user = await discordUserFetch("/users/@me", accessToken);
  const member = await discordBotFetch(`/guilds/${env.guildId}/members/${user.id}`);
  const roles = await fetchGuildRoles(env.guildId);

  const roleMap = new Map(roles.map((r) => [String(r.id), r]));
  const memberRoleIds = Array.isArray(member.roles) ? member.roles.map(String) : [];

  const memberRolesDetailed = memberRoleIds
    .map((roleId) => roleMap.get(String(roleId)))
    .filter(Boolean)
    .sort((a, b) => Number(b.position || 0) - Number(a.position || 0))
    .map((r) => ({
      id: String(r.id),
      name: safeText(r.name),
      position: Number(r.position || 0),
    }));

  const memberRoleNames = memberRolesDetailed
    .map((r) => safeText(r.name))
    .filter(Boolean);

  const memberRoleNamesLower = memberRoleNames.map((name) => normalizeRoleName(name));

  const access = deriveMemberAccessFlags(memberRoleIds, memberRoleNamesLower);
  const avatarUrl = buildDiscordAvatarUrl(user);
  const bannerUrl = buildBannerUrl(user);

  return {
    user: {
      id: String(user.id),
      discord_id: String(user.id),
      username: safeText(user.global_name || user.username, "Member"),
      global_name: safeText(user.global_name),
      login: safeText(user.username),
      discriminator: safeText(user.discriminator),
      avatar: avatarUrl,
      avatar_url: avatarUrl,
      image: avatarUrl,
      picture: avatarUrl,
      banner_url: bannerUrl,
    },
    discordUser: {
      id: String(user.id),
      username: safeText(user.username),
      global_name: safeText(user.global_name),
      avatar: avatarUrl,
      avatar_url: avatarUrl,
      image: avatarUrl,
      picture: avatarUrl,
      banner_url: bannerUrl,
    },
    member: {
      id: String(user.id),
      nickname: member.nick || null,
      display_name: safeText(member.nick || user.global_name || user.username, "Member"),
      avatar_url: avatarUrl,
      roleIds: memberRoleIds,
      roles: memberRoleNames,
      rolesDetailed: memberRolesDetailed,
      has_staff_role: access.hasStaffRole,
      has_verified_role: access.hasVerifiedRole,
      has_unverified_role: access.hasUnverifiedRole,
      access_label: access.accessLabel,
      verification_label: access.verificationLabel,
    },
    isStaff: access.hasStaffRole,
  };
}

export async function getSession() {
  const accessToken = cookies().get(ACCESS_COOKIE)?.value;
  if (!accessToken) return null;

  try {
    return await buildSession(accessToken);
  } catch {
    return null;
  }
}

export async function requireStaffSessionForRoute() {
  const cookieStore = cookies();
  let accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;
  const expiresAt = Number(cookieStore.get(EXPIRES_COOKIE)?.value || 0);
  let refreshedTokens = null;

  if (!accessToken && !refreshToken) {
    const error = new Error("Unauthorized");
    error.status = 401;
    throw error;
  }

  const shouldRefresh = !accessToken || (expiresAt && Date.now() > expiresAt - 60000);

  if (shouldRefresh) {
    if (!refreshToken) {
      const error = new Error("Unauthorized");
      error.status = 401;
      throw error;
    }
    refreshedTokens = await refreshAccessToken(refreshToken);
    accessToken = refreshedTokens.access_token;
  }

  const session = await buildSession(accessToken);

  if (!session?.isStaff) {
    const error = new Error("Unauthorized");
    error.status = 403;
    throw error;
  }

  return { session, refreshedTokens };
}

export function applyAuthCookies(response, tokenPayload) {
  if (!tokenPayload) return response;

  const expiresAtMs = Date.now() + (tokenPayload.expires_in || 604800) * 1000;

  response.cookies.set(
    ACCESS_COOKIE,
    tokenPayload.access_token,
    getCookieOptions(tokenPayload.expires_in || 604800)
  );

  if (tokenPayload.refresh_token) {
    response.cookies.set(
      REFRESH_COOKIE,
      tokenPayload.refresh_token,
      getCookieOptions(60 * 60 * 24 * 30)
    );
  }

  response.cookies.set(
    EXPIRES_COOKIE,
    String(expiresAtMs),
    getCookieOptions(60 * 60 * 24 * 30)
  );

  return response;
}

export function clearAuthCookies(response) {
  response.cookies.set(ACCESS_COOKIE, "", getCookieOptions(0));
  response.cookies.set(REFRESH_COOKIE, "", getCookieOptions(0));
  response.cookies.set(EXPIRES_COOKIE, "", getCookieOptions(0));
  return response;
}

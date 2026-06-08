import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { applyAuthCookies, refreshAccessToken } from "@/lib/auth-server";
import { discordBotFetch, discordUserFetch, fetchGuildRoles } from "@/lib/discord-api";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSelectedGuildId, hasSelectedGuildManagerProof } from "@/lib/guild-selection";
import { env } from "@/lib/env";

const ACCESS_COOKIE = "discord_access_token";
const REFRESH_COOKIE = "discord_refresh_token";
const EXPIRES_COOKIE = "discord_expires_at";
const MANAGE_GUILD = BigInt(1 << 5);
const ADMINISTRATOR = BigInt(1 << 3);

type TokenPayload = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
} | null;

type DiscordUser = {
  id?: string | null;
  username?: string | null;
  global_name?: string | null;
  discriminator?: string | null;
  avatar?: string | null;
  banner?: string | null;
};

type DiscordUserGuild = {
  id?: string | null;
  owner?: boolean | null;
  permissions?: string | number | null;
};

type DiscordMember = {
  nick?: string | null;
  roles?: string[] | null;
};

type DiscordRole = {
  id?: string | number | null;
  name?: string | null;
  position?: number | null;
};

type RoleRule = {
  role_id?: string | null;
  role_name?: string | null;
  role_group?: string | null;
  active?: boolean | null;
};

type StoredMember = {
  user_id?: string | null;
  username?: string | null;
  display_name?: string | null;
  nickname?: string | null;
  avatar_url?: string | null;
  role_ids?: string[] | null;
  role_names?: string[] | null;
  roles?: Array<{ id?: string | null; name?: string | null; position?: number | null }> | null;
  has_staff_role?: boolean | null;
  has_verified_role?: boolean | null;
  has_unverified?: boolean | null;
  has_secondary_verified_role?: boolean | null;
};

export type DashboardAccessLevel = "signed_out" | "member" | "staff" | "server_manager";

export type DashboardAuthErrorCode =
  | "signed_out"
  | "selected_server_required"
  | "route_guild_mismatch"
  | "staff_access_required"
  | "forbidden"
  | "discord_rate_limited"
  | "discord_rejected_token"
  | "token_refresh_failed"
  | "bot_check_unknown"
  | "bot_not_installed"
  | "invalid_request"
  | "server_error";

export type DashboardAuthError = Error & {
  status?: number;
  error_code?: DashboardAuthErrorCode;
  code?: DashboardAuthErrorCode | string;
  retryable?: boolean;
  needsServerSelection?: boolean;
};

export type DashboardAuthSession = {
  signedIn: boolean;
  accessLevel: DashboardAccessLevel;
  isStaff: boolean;
  isServerManager: boolean;
  selectedGuildId: string;
  refreshedTokens: TokenPayload;
  bearer: string;
  user: {
    id: string;
    discord_id: string;
    username: string;
    global_name: string;
    login: string;
    discriminator: string;
    avatar: string | null;
    avatar_url: string | null;
    image: string | null;
    picture: string | null;
    banner_url: string | null;
  };
  discordUser: {
    id: string;
    username: string;
    global_name: string;
    avatar: string | null;
    avatar_url: string | null;
    image: string | null;
    picture: string | null;
    banner_url: string | null;
  };
  member: {
    id: string;
    nickname: string | null;
    display_name: string;
    avatar_url: string | null;
    roleIds: string[];
    roles: string[];
    rolesDetailed: Array<{ id: string; name: string; position: number }>;
    has_staff_role: boolean;
    has_verified_role: boolean;
    has_unverified_role: boolean;
    has_manage_server: boolean;
    access_label: string;
    verification_label: string;
  };
  authContext: {
    guild_id: string | null;
    selected_guild_id: string | null;
    guild_checked: boolean;
    guild_check_error: string | null;
    staff_reason: string | null;
    access_source: string | null;
  };
};

function clean(value: unknown): string {
  return String(value || "").trim();
}

function lower(value: unknown): string {
  return clean(value).toLowerCase();
}

function makeDashboardAuthError(message: string, status: number, errorCode: DashboardAuthErrorCode, retryable = false): DashboardAuthError {
  const error = new Error(message) as DashboardAuthError;
  error.status = status;
  error.error_code = errorCode;
  error.code = errorCode;
  error.retryable = retryable;
  error.needsServerSelection = errorCode === "selected_server_required" || errorCode === "route_guild_mismatch";
  return error;
}

function statusFromCode(errorCode: DashboardAuthErrorCode, fallbackStatus: number): number {
  if (errorCode === "signed_out" || errorCode === "discord_rejected_token" || errorCode === "token_refresh_failed") return 401;
  if (errorCode === "selected_server_required") return 428;
  if (errorCode === "route_guild_mismatch") return 409;
  if (errorCode === "staff_access_required" || errorCode === "forbidden") return 403;
  if (errorCode === "discord_rate_limited") return 429;
  if (errorCode === "bot_check_unknown") return 503;
  if (errorCode === "bot_not_installed" || errorCode === "invalid_request") return 400;
  return fallbackStatus;
}

function normalizeErrorCode(value: unknown): DashboardAuthErrorCode | null {
  const code = lower(value);
  const allowed: DashboardAuthErrorCode[] = [
    "signed_out",
    "selected_server_required",
    "route_guild_mismatch",
    "staff_access_required",
    "forbidden",
    "discord_rate_limited",
    "discord_rejected_token",
    "token_refresh_failed",
    "bot_check_unknown",
    "bot_not_installed",
    "invalid_request",
    "server_error",
  ];
  return allowed.includes(code as DashboardAuthErrorCode) ? (code as DashboardAuthErrorCode) : null;
}

export function classifyDashboardAuthError(error: unknown, fallbackStatus = 500): { status: number; error_code: DashboardAuthErrorCode; message: string; needsServerSelection: boolean; retryable: boolean } {
  const raw = error as DashboardAuthError;
  const rawMessage = error instanceof Error ? error.message : clean(error);
  const message = rawMessage || "Dashboard request failed.";
  const explicitCode = normalizeErrorCode(raw?.error_code || raw?.code);
  const status = typeof raw?.status === "number" ? Number(raw.status) : fallbackStatus;
  const text = lower(message);

  let error_code: DashboardAuthErrorCode = explicitCode || "server_error";

  if (!explicitCode) {
    if (status === 428 || text.includes("select a server") || text.includes("selected server")) error_code = "selected_server_required";
    else if (status === 429 || text.includes("rate limit") || text.includes("retry_after") || text.includes("rate-limiting")) error_code = "discord_rate_limited";
    else if (text.includes("oauth refresh failed") || text.includes("refresh failed") || text.includes("token refresh")) error_code = "token_refresh_failed";
    else if (text.includes("discord rejected") || text.includes("discord session expired") || text.includes("oauth token") || text.includes("401") || text.includes("unauthorized")) error_code = "discord_rejected_token";
    else if (status === 401 || text === "unauthorized") error_code = "signed_out";
    else if (status === 403 || text.includes("staff access required")) error_code = text.includes("staff") ? "staff_access_required" : "forbidden";
    else if (status === 409 || text.includes("guild mismatch") || text.includes("server mismatch")) error_code = "route_guild_mismatch";
    else if (text.includes("bot") && text.includes("installed")) error_code = "bot_not_installed";
    else if (text.includes("bot") && (text.includes("unknown") || text.includes("could not verify"))) error_code = "bot_check_unknown";
    else if (status === 400) error_code = "invalid_request";
  }

  const finalStatus = statusFromCode(error_code, status || fallbackStatus);
  return {
    status: finalStatus,
    error_code,
    message,
    needsServerSelection: Boolean(raw?.needsServerSelection || error_code === "selected_server_required" || error_code === "route_guild_mismatch"),
    retryable: Boolean(raw?.retryable || error_code === "discord_rate_limited" || error_code === "bot_check_unknown"),
  };
}

function hasManageGuildPermission(guild: DiscordUserGuild | null | undefined): boolean {
  if (!guild) return false;
  if (guild.owner) return true;
  try {
    const raw = BigInt(clean(guild.permissions || "0"));
    return (raw & ADMINISTRATOR) === ADMINISTRATOR || (raw & MANAGE_GUILD) === MANAGE_GUILD;
  } catch {
    return false;
  }
}

function defaultAvatarIndex(user: DiscordUser): number {
  try {
    const discriminator = clean(user?.discriminator || "0");
    if (discriminator && discriminator !== "0") return Number.parseInt(discriminator, 10) % 5;
    return Number((BigInt(clean(user?.id || "0")) >> BigInt(22)) % BigInt(6));
  } catch {
    return 0;
  }
}

function avatarUrl(user: DiscordUser): string | null {
  const userId = clean(user?.id);
  const avatar = clean(user?.avatar);
  if (!userId) return null;
  if (avatar) return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.${avatar.startsWith("a_") ? "gif" : "png"}?size=256`;
  return `https://cdn.discordapp.com/embed/avatars/${defaultAvatarIndex(user)}.png`;
}

function bannerUrl(user: DiscordUser): string | null {
  const userId = clean(user?.id);
  const banner = clean(user?.banner);
  if (!userId || !banner) return null;
  return `https://cdn.discordapp.com/banners/${userId}/${banner}.${banner.startsWith("a_") ? "gif" : "png"}?size=512`;
}

async function refreshBearer(refreshToken: string): Promise<{ bearer: string; refreshedTokens: TokenPayload } | null> {
  if (!refreshToken) return null;
  try {
    const refreshedTokens = (await refreshAccessToken(refreshToken)) as TokenPayload;
    const bearer = clean(refreshedTokens?.access_token);
    if (!bearer) return null;
    return { bearer, refreshedTokens };
  } catch {
    return null;
  }
}

async function getBearer(): Promise<{ bearer: string; refreshedTokens: TokenPayload } | null> {
  const store = cookies();
  const access = clean(store.get(ACCESS_COOKIE)?.value);
  const refresh = clean(store.get(REFRESH_COOKIE)?.value);
  const expiresAt = Number(store.get(EXPIRES_COOKIE)?.value || 0);
  if (!access && !refresh) return null;
  if (!access || Boolean(expiresAt && Date.now() > expiresAt - 60_000)) return await refreshBearer(refresh);
  return { bearer: access, refreshedTokens: null };
}

async function loadUserWithRetry(bearerState: { bearer: string; refreshedTokens: TokenPayload }): Promise<{ bearer: string; refreshedTokens: TokenPayload; user: DiscordUser }> {
  try {
    const user = (await discordUserFetch("/users/@me", bearerState.bearer)) as DiscordUser;
    return { ...bearerState, user };
  } catch (error) {
    const retry = await refreshBearer(clean(cookies().get(REFRESH_COOKIE)?.value || bearerState.refreshedTokens?.refresh_token));
    if (!retry) throw error;
    const user = (await discordUserFetch("/users/@me", retry.bearer)) as DiscordUser;
    return { ...retry, user };
  }
}

async function loadUserGuildManagerAccess(bearer: string, guildId: string): Promise<{ ok: boolean; error: string | null }> {
  if (!bearer || !guildId) return { ok: false, error: "No selected server." };
  try {
    const guilds = (await discordUserFetch("/users/@me/guilds", bearer)) as DiscordUserGuild[];
    const match = Array.isArray(guilds) ? guilds.find((guild) => clean(guild.id) === guildId) : null;
    return { ok: hasManageGuildPermission(match), error: null };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "User guild permission check failed." };
  }
}

async function loadBotMemberContext(guildId: string, userId: string): Promise<{ member: DiscordMember | null; roles: DiscordRole[]; error: string | null }> {
  if (!guildId || !userId) return { member: null, roles: [], error: "No selected server or user." };
  try {
    const [member, roles] = await Promise.all([
      discordBotFetch(`/guilds/${guildId}/members/${userId}`) as Promise<DiscordMember>,
      fetchGuildRoles(guildId) as Promise<DiscordRole[]>,
    ]);
    return { member, roles: Array.isArray(roles) ? roles : [], error: null };
  } catch (error) {
    return { member: null, roles: [], error: error instanceof Error ? error.message : "Guild member check failed." };
  }
}

function normalizeRules(rows: unknown): RoleRule[] {
  return Array.isArray(rows)
    ? rows
        .map((row) => ({
          role_id: clean((row as RoleRule)?.role_id),
          role_name: clean((row as RoleRule)?.role_name),
          role_group: lower((row as RoleRule)?.role_group),
          active: (row as RoleRule)?.active !== false,
        }))
        .filter((row) => row.active && row.role_group)
    : [];
}

async function loadDatabaseAccess(guildId: string, userId: string): Promise<{ rules: RoleRule[]; storedMember: StoredMember | null }> {
  if (!guildId) return { rules: [], storedMember: null };
  try {
    const supabase = createServerSupabase();
    const [rulesRes, memberRes] = await Promise.all([
      supabase.from("guild_role_rules").select("role_id,role_name,role_group,active").eq("guild_id", guildId).eq("active", true),
      userId ? supabase.from("guild_members").select("*").eq("guild_id", guildId).eq("user_id", userId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    ]);
    return {
      rules: rulesRes?.error ? [] : normalizeRules(rulesRes?.data),
      storedMember: memberRes?.error ? null : ((memberRes?.data || null) as StoredMember | null),
    };
  } catch {
    return { rules: [], storedMember: null };
  }
}

function storedRoles(storedMember: StoredMember | null): Array<{ id: string; name: string; position: number }> {
  if (!storedMember) return [];
  if (Array.isArray(storedMember.roles) && storedMember.roles.length) {
    return storedMember.roles.map((role) => ({ id: clean(role?.id), name: clean(role?.name), position: Number(role?.position || 0) })).filter((role) => role.id || role.name);
  }
  const ids = Array.isArray(storedMember.role_ids) ? storedMember.role_ids : [];
  const names = Array.isArray(storedMember.role_names) ? storedMember.role_names : [];
  return names.map((name, index) => ({ id: clean(ids[index]), name: clean(name), position: 0 })).filter((role) => role.id || role.name);
}

function groupForRole(roleId: string, roleName: string, rules: RoleRule[]): string {
  const byId = rules.find((rule) => clean(rule.role_id) && clean(rule.role_id) === roleId);
  if (byId?.role_group) return lower(byId.role_group);
  const byName = rules.find((rule) => clean(rule.role_name) && lower(rule.role_name) === lower(roleName));
  return lower(byName?.role_group);
}

function deriveAccess(args: {
  manager: boolean;
  managerProof: boolean;
  roleIds: string[];
  roleNames: string[];
  rules: RoleRule[];
  storedMember: StoredMember | null;
}) {
  const envStaffNames = env.staffRoleNames.map(lower);
  let ruleStaff = false;
  let ruleVerified = false;
  let ruleUnverified = false;

  for (let index = 0; index < Math.max(args.roleIds.length, args.roleNames.length); index += 1) {
    const group = groupForRole(clean(args.roleIds[index]), clean(args.roleNames[index]), args.rules);
    if (group === "staff" || group === "admin") ruleStaff = true;
    if (group === "verified" || group === "secondary_verified") ruleVerified = true;
    if (group === "unverified") ruleUnverified = true;
  }

  const loweredRoleNames = args.roleNames.map(lower);
  const hasManagerAccess = args.manager || args.managerProof;
  const hasStaffRole =
    hasManagerAccess ||
    ruleStaff ||
    Boolean(args.storedMember?.has_staff_role) ||
    args.roleIds.some((id) => env.staffRoleIds.includes(clean(id))) ||
    loweredRoleNames.some((name) => envStaffNames.includes(name));
  const hasVerifiedRole =
    ruleVerified ||
    Boolean(args.storedMember?.has_verified_role || args.storedMember?.has_secondary_verified_role) ||
    loweredRoleNames.some((name) => ["verified", "resident", "member"].includes(name) || name.includes("verified"));
  const hasUnverifiedRole =
    ruleUnverified ||
    Boolean(args.storedMember?.has_unverified) ||
    loweredRoleNames.some((name) => name === "unverified" || name.includes("unverified"));

  const accessLevel: DashboardAccessLevel = hasManagerAccess ? "server_manager" : hasStaffRole ? "staff" : "member";
  const accessLabel = hasManagerAccess ? "Server Manager" : hasStaffRole ? "Staff" : hasVerifiedRole ? "Verified" : hasUnverifiedRole ? "Limited" : "Signed In";
  const verificationLabel = hasManagerAccess ? "Server Manager" : hasStaffRole ? "Staff" : hasVerifiedRole ? "Verified" : hasUnverifiedRole ? "Pending Verification" : "Server Access Not Checked";

  return { hasStaffRole, hasVerifiedRole, hasUnverifiedRole, hasManagerAccess, accessLevel, accessLabel, verificationLabel };
}

function proofFallbackUser(): DiscordUser {
  return {
    id: "selected-server-manager",
    username: "Dashboard Manager",
    global_name: "Dashboard Manager",
    discriminator: "0",
    avatar: null,
    banner: null,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : clean(error);
}

async function buildProofFallbackSession(args: {
  selectedGuildId: string;
  bearerState: { bearer: string; refreshedTokens: TokenPayload } | null;
  cause: unknown;
}): Promise<DashboardAuthSession> {
  const selectedGuildId = clean(args.selectedGuildId);
  const user = proofFallbackUser();
  const userId = clean(user.id);
  const dbAccess = await loadDatabaseAccess(selectedGuildId, "");
  const rolesDetailed = storedRoles(dbAccess.storedMember);
  const roleIds = rolesDetailed.map((role) => role.id).filter(Boolean);
  const roleNames = rolesDetailed.map((role) => clean(role.name)).filter(Boolean);
  const access = deriveAccess({ manager: true, managerProof: true, roleIds, roleNames, rules: dbAccess.rules, storedMember: dbAccess.storedMember });
  const issue = errorMessage(args.cause) || "Discord user OAuth check failed, but selected server manager proof is valid.";

  return {
    signedIn: true,
    accessLevel: "server_manager",
    isStaff: true,
    isServerManager: true,
    selectedGuildId,
    refreshedTokens: args.bearerState?.refreshedTokens || null,
    bearer: args.bearerState?.bearer || "",
    user: {
      id: userId,
      discord_id: userId,
      username: clean(user.global_name || user.username || "Dashboard Manager"),
      global_name: clean(user.global_name),
      login: clean(user.username),
      discriminator: clean(user.discriminator),
      avatar: null,
      avatar_url: null,
      image: null,
      picture: null,
      banner_url: null,
    },
    discordUser: {
      id: userId,
      username: clean(user.username),
      global_name: clean(user.global_name),
      avatar: null,
      avatar_url: null,
      image: null,
      picture: null,
      banner_url: null,
    },
    member: {
      id: userId,
      nickname: null,
      display_name: "Dashboard Manager",
      avatar_url: null,
      roleIds,
      roles: roleNames,
      rolesDetailed,
      has_staff_role: access.hasStaffRole,
      has_verified_role: access.hasVerifiedRole,
      has_unverified_role: access.hasUnverifiedRole,
      has_manage_server: true,
      access_label: "Server Manager",
      verification_label: "Server Manager",
    },
    authContext: {
      guild_id: selectedGuildId || null,
      selected_guild_id: selectedGuildId || null,
      guild_checked: true,
      guild_check_error: issue,
      staff_reason: "selected_server_access_proof_oauth_fallback",
      access_source: "selected_server_access_proof",
    },
  };
}

export async function getDashboardAuthSession(): Promise<DashboardAuthSession | null> {
  const selectedGuildId = clean(getSelectedGuildId());
  const managerProof = Boolean(selectedGuildId && hasSelectedGuildManagerProof());
  const bearerState = await getBearer();

  if (!bearerState) {
    if (managerProof) return buildProofFallbackSession({ selectedGuildId, bearerState: null, cause: "No active Discord bearer token; using selected server manager proof." });
    return null;
  }

  let loaded: { bearer: string; refreshedTokens: TokenPayload; user: DiscordUser };
  try {
    loaded = await loadUserWithRetry(bearerState);
  } catch (error) {
    if (managerProof) return buildProofFallbackSession({ selectedGuildId, bearerState, cause: error });
    throw error;
  }

  const { bearer, refreshedTokens, user } = loaded;
  const userId = clean(user.id);
  const [managerAccess, botContext, dbAccess] = await Promise.all([
    managerProof ? Promise.resolve({ ok: true, error: null }) : loadUserGuildManagerAccess(bearer, selectedGuildId),
    loadBotMemberContext(selectedGuildId, userId),
    loadDatabaseAccess(selectedGuildId, userId),
  ]);

  const liveRoleMap = new Map(botContext.roles.map((role) => [clean(role.id), role]));
  const liveRoleIds = Array.isArray(botContext.member?.roles) ? botContext.member.roles.map(clean).filter(Boolean) : [];
  const fallbackRoles = storedRoles(dbAccess.storedMember);
  const rolesDetailed = (liveRoleIds.length
    ? liveRoleIds.map((id) => liveRoleMap.get(id)).filter(Boolean).map((role) => ({ id: clean(role?.id), name: clean(role?.name), position: Number(role?.position || 0) }))
    : fallbackRoles
  ).sort((a, b) => Number(b.position || 0) - Number(a.position || 0));
  const roleIds = liveRoleIds.length ? liveRoleIds : rolesDetailed.map((role) => role.id).filter(Boolean);
  const roleNames = rolesDetailed.map((role) => clean(role.name)).filter(Boolean);
  const access = deriveAccess({ manager: managerAccess.ok, managerProof, roleIds, roleNames, rules: dbAccess.rules, storedMember: dbAccess.storedMember });
  const image = avatarUrl(user) || dbAccess.storedMember?.avatar_url || null;
  const displayName = clean(botContext.member?.nick || dbAccess.storedMember?.display_name || dbAccess.storedMember?.nickname || user.global_name || user.username || "Member");
  const guildChecked = Boolean(selectedGuildId && (managerAccess.ok || managerProof || !botContext.error || dbAccess.storedMember));
  const staffReason = managerProof ? "selected_server_access_proof" : access.accessLevel === "server_manager" ? "manage_server_permission" : access.accessLevel === "staff" ? (dbAccess.rules.length ? "selected_guild_role_rule" : "stored_or_env_staff_role") : null;

  return {
    signedIn: true,
    accessLevel: access.accessLevel,
    isStaff: access.accessLevel === "staff" || access.accessLevel === "server_manager",
    isServerManager: access.accessLevel === "server_manager",
    selectedGuildId,
    refreshedTokens,
    bearer,
    user: {
      id: userId,
      discord_id: userId,
      username: clean(user.global_name || user.username || "Member"),
      global_name: clean(user.global_name),
      login: clean(user.username),
      discriminator: clean(user.discriminator),
      avatar: image,
      avatar_url: image,
      image,
      picture: image,
      banner_url: bannerUrl(user),
    },
    discordUser: {
      id: userId,
      username: clean(user.username),
      global_name: clean(user.global_name),
      avatar: image,
      avatar_url: image,
      image,
      picture: image,
      banner_url: bannerUrl(user),
    },
    member: {
      id: userId,
      nickname: botContext.member?.nick || dbAccess.storedMember?.nickname || null,
      display_name: displayName,
      avatar_url: image,
      roleIds,
      roles: roleNames,
      rolesDetailed,
      has_staff_role: access.hasStaffRole,
      has_verified_role: access.hasVerifiedRole,
      has_unverified_role: access.hasUnverifiedRole,
      has_manage_server: access.hasManagerAccess,
      access_label: access.accessLabel,
      verification_label: access.verificationLabel,
    },
    authContext: {
      guild_id: selectedGuildId || null,
      selected_guild_id: selectedGuildId || null,
      guild_checked: guildChecked,
      guild_check_error: guildChecked ? null : botContext.error || managerAccess.error || null,
      staff_reason: staffReason,
      access_source: staffReason || (dbAccess.storedMember ? "stored_member" : managerAccess.error ? "user_guild_check_failed" : null),
    },
  };
}

export async function requireDashboardStaffSession(): Promise<DashboardAuthSession> {
  const session = await getDashboardAuthSession();
  if (!session) throw makeDashboardAuthError("Dashboard session missing. Sign in with Discord to continue.", 401, "signed_out");
  if (!session.selectedGuildId) throw makeDashboardAuthError("Select a server before using dashboard tools.", 428, "selected_server_required");
  if (!session.isStaff) throw makeDashboardAuthError("Staff access required for the selected server.", 403, "staff_access_required");
  return session;
}

export function applyDashboardAuthCookies<T extends { cookies: { set: Function } }>(response: T, session: DashboardAuthSession | null): T {
  applyAuthCookies(response, session?.refreshedTokens || null);
  return response;
}

export function dashboardAuthJson(payload: Record<string, unknown>, status = 200, session: DashboardAuthSession | null = null) {
  const errorLike = status >= 400 ? classifyDashboardAuthError({ ...payload, message: payload.error || payload.message, status, error_code: payload.error_code }, status) : null;
  const responsePayload = errorLike
    ? {
        ...payload,
        ok: payload.ok ?? false,
        error: payload.error || errorLike.message,
        error_code: payload.error_code || errorLike.error_code,
        needsServerSelection: payload.needsServerSelection ?? errorLike.needsServerSelection,
        retryable: payload.retryable ?? errorLike.retryable,
      }
    : payload;
  const response = NextResponse.json(responsePayload, {
    status: errorLike?.status || status,
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" },
  });
  applyDashboardAuthCookies(response, session);
  return response;
}

export function dashboardAuthErrorJson(error: unknown, session: DashboardAuthSession | null = null, fallbackStatus = 500) {
  const classified = classifyDashboardAuthError(error, fallbackStatus);
  return dashboardAuthJson(
    {
      ok: false,
      error: classified.message,
      error_code: classified.error_code,
      needsServerSelection: classified.needsServerSelection,
      retryable: classified.retryable,
    },
    classified.status,
    session
  );
}

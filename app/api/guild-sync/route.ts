import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type DiscordRole = {
  id: string;
  name: string;
  color?: number | null;
};

type DiscordMember = {
  user: {
    id: string;
    username?: string;
    global_name?: string | null;
    avatar?: string | null;
    bot?: boolean;
  };
  roles: string[];
};

type RoleState =
  | "unverified_only"
  | "verified_ok"
  | "verified_conflict"
  | "staff_ok"
  | "staff_conflict"
  | "missing_unverified"
  | "missing_verified_role"
  | "booster_only"
  | "left_guild"
  | "unknown";

function pickEnv(...keys: string[]) {
  for (const key of keys) {
    const value = (process.env[key] || "").trim();
    if (value) return value;
  }
  return "";
}

function avatarUrlFor(id: string, avatarHash?: string | null) {
  if (avatarHash) {
    return `https://cdn.discordapp.com/avatars/${id}/${avatarHash}.png?size=128`;
  }
  return `https://cdn.discordapp.com/embed/avatars/${Number(id) % 6}.png`;
}

async function discordGET(path: string, botToken: string) {
  const response = await fetch(`https://discord.com/api/v10${path}`, {
    headers: {
      authorization: `Bot ${botToken}`,
      "user-agent": "stoney-verify-dashboard",
    },
    cache: "no-store",
  });
  return response;
}

function normalizeRoleName(name: string) {
  return String(name || "").trim().toLowerCase();
}

function buildRulesFromRoleNames(roleNames: string[]) {
  const normalized = roleNames.map(normalizeRoleName);

  const has = (name: string) => normalized.includes(normalizeRoleName(name));

  return {
    unverifiedNames: ["Unverified"].filter(has),
    verifiedNames: ["Verified", "Resident", "Stoner", "Drunken"].filter(has),
    secondaryVerifiedNames: ["NFSW"].filter(has),
    staffNames: ["DickHeads"].filter(has),
    adminNames: ["perm"].filter(has),
    cosmeticNames: ["BOOSTER", "Server Booster"].filter(has),
  };
}

function evaluateRoleState(roleNames: string[]): {
  roleState: RoleState;
  reason: string;
  hasAnyRole: boolean;
  hasUnverified: boolean;
  hasVerifiedRole: boolean;
  hasSecondaryVerifiedRole: boolean;
  hasStaffRole: boolean;
  hasCosmeticOnly: boolean;
} {
  const normalizedNames = roleNames.map(normalizeRoleName);
  const rules = buildRulesFromRoleNames(roleNames);

  const hasAnyRole = normalizedNames.length > 0;
  const hasUnverified = rules.unverifiedNames.length > 0;
  const hasVerifiedRole = rules.verifiedNames.length > 0;
  const hasSecondaryVerifiedRole = rules.secondaryVerifiedNames.length > 0;
  const hasStaffRole = rules.staffNames.length > 0 || rules.adminNames.length > 0;
  const hasCosmeticRole = rules.cosmeticNames.length > 0;

  if (hasStaffRole && hasUnverified) {
    return {
      roleState: "staff_conflict",
      reason: "Staff/admin still has Unverified",
      hasAnyRole,
      hasUnverified,
      hasVerifiedRole,
      hasSecondaryVerifiedRole,
      hasStaffRole,
      hasCosmeticOnly: false,
    };
  }

  if (hasStaffRole) {
    return {
      roleState: "staff_ok",
      reason: "Staff/admin role is present and valid",
      hasAnyRole,
      hasUnverified,
      hasVerifiedRole,
      hasSecondaryVerifiedRole,
      hasStaffRole,
      hasCosmeticOnly: false,
    };
  }

  if (hasVerifiedRole && hasUnverified) {
    return {
      roleState: "verified_conflict",
      reason: "Verified member still has Unverified",
      hasAnyRole,
      hasUnverified,
      hasVerifiedRole,
      hasSecondaryVerifiedRole,
      hasStaffRole,
      hasCosmeticOnly: false,
    };
  }

  if (hasVerifiedRole) {
    return {
      roleState: "verified_ok",
      reason: "Verified/member role is present and Unverified is removed",
      hasAnyRole,
      hasUnverified,
      hasVerifiedRole,
      hasSecondaryVerifiedRole,
      hasStaffRole,
      hasCosmeticOnly: false,
    };
  }

  if (hasSecondaryVerifiedRole && !hasVerifiedRole) {
    return {
      roleState: "missing_verified_role",
      reason: "Has NFSW but no real verified/member role",
      hasAnyRole,
      hasUnverified,
      hasVerifiedRole,
      hasSecondaryVerifiedRole,
      hasStaffRole,
      hasCosmeticOnly: false,
    };
  }

  if (hasUnverified && hasCosmeticRole) {
    return {
      roleState: "booster_only",
      reason: "Only Unverified plus cosmetic/booster role",
      hasAnyRole,
      hasUnverified,
      hasVerifiedRole,
      hasSecondaryVerifiedRole,
      hasStaffRole,
      hasCosmeticOnly: true,
    };
  }

  if (hasUnverified) {
    return {
      roleState: "unverified_only",
      reason: "Still in default unverified state",
      hasAnyRole,
      hasUnverified,
      hasVerifiedRole,
      hasSecondaryVerifiedRole,
      hasStaffRole,
      hasCosmeticOnly: false,
    };
  }

  return {
    roleState: "missing_unverified",
    reason: "No Unverified and no verified/staff role found",
    hasAnyRole,
    hasUnverified,
    hasVerifiedRole,
    hasSecondaryVerifiedRole,
    hasStaffRole,
    hasCosmeticOnly: false,
  };
}

async function fetchGuildRoles(guildId: string, botToken: string) {
  const response = await discordGET(`/guilds/${guildId}/roles`, botToken);
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Failed to fetch guild roles (${response.status}): ${text || response.statusText}`);
  }

  const roles = (await response.json()) as any[];
  return roles.map((role) => ({
    id: String(role.id),
    name: String(role.name),
    color: typeof role.color === "number" ? role.color : null,
  })) as DiscordRole[];
}

async function fetchAllGuildMembers(guildId: string, botToken: string) {
  const out: DiscordMember[] = [];
  let after = "0";

  while (true) {
    const response = await discordGET(
      `/guilds/${guildId}/members?limit=1000&after=${after}`,
      botToken
    );

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Failed to fetch guild members (${response.status}): ${text || response.statusText}`);
    }

    const chunk = (await response.json()) as DiscordMember[];
    out.push(...chunk);

    if (chunk.length < 1000) break;
    after = String(chunk[chunk.length - 1]?.user?.id || after);
    if (!after) break;
  }

  return out;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = getSupabaseAdmin();
  if (!sb) {
    return NextResponse.json(
      { error: "Supabase admin not configured" },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const guildId = String(body?.guildId || session.guildId || pickEnv("GUILD_ID", "DISCORD_GUILD_ID")).trim();
  const botToken = pickEnv("DISCORD_BOT_TOKEN", "DISCORD_TOKEN", "BOT_TOKEN");

  if (!guildId) {
    return NextResponse.json({ error: "Missing guildId" }, { status: 400 });
  }

  if (!botToken) {
    return NextResponse.json({ error: "Missing DISCORD_BOT_TOKEN" }, { status: 500 });
  }

  try {
    const [guildRoles, guildMembers, tokensRes] = await Promise.all([
      fetchGuildRoles(guildId, botToken),
      fetchAllGuildMembers(guildId, botToken),
      sb.from("verification_tokens").select("*").eq("guild_id", guildId),
    ]);

    if (tokensRes.error) {
      throw new Error(tokensRes.error.message);
    }

    const roleById: Record<string, DiscordRole> = {};
    for (const role of guildRoles) {
      roleById[role.id] = role;
    }

    const memberRows = guildMembers.map((member) => {
      const userId = String(member.user?.id || "");
      const username = member.user?.username ? String(member.user.username) : null;
      const displayName =
        member.user?.global_name
          ? String(member.user.global_name)
          : username || userId;

      const roleIds = Array.isArray(member.roles) ? member.roles.map(String) : [];
      const roleNames = roleIds
        .map((roleId) => roleById[roleId]?.name)
        .filter(Boolean) as string[];

      const highestRoleName = roleNames[0] || null;
      const highestRoleId = roleIds[0] || null;

      const evaluated = evaluateRoleState(roleNames);

      return {
        guild_id: guildId,
        user_id: userId,
        username,
        display_name: displayName,
        avatar_url: avatarUrlFor(userId, member.user?.avatar || null),
        role_ids: roleIds,
        role_names: roleNames,
        highest_role_id: highestRoleId,
        highest_role_name: highestRoleName,
        in_guild: true,
        has_any_role: evaluated.hasAnyRole,
        data_health:
          evaluated.roleState === "left_guild"
            ? "left_guild"
            : evaluated.roleState === "unknown"
              ? "unknown"
              : "ok",
        synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        has_unverified: evaluated.hasUnverified,
        has_verified_role: evaluated.hasVerifiedRole,
        has_staff_role: evaluated.hasStaffRole,
        has_secondary_verified_role: evaluated.hasSecondaryVerifiedRole,
        has_cosmetic_only: evaluated.hasCosmeticOnly,
        role_state: evaluated.roleState,
        role_state_reason: evaluated.reason,
      };
    });

    if (memberRows.length) {
      const { error: upsertError } = await sb
        .from("guild_members")
        .upsert(memberRows, {
          onConflict: "guild_id,user_id",
        });

      if (upsertError) {
        throw new Error(upsertError.message);
      }
    }

    const seenIds = new Set(memberRows.map((row) => row.user_id));

    const { data: existingMembers, error: existingError } = await sb
      .from("guild_members")
      .select("guild_id,user_id")
      .eq("guild_id", guildId);

    if (existingError) {
      throw new Error(existingError.message);
    }

    const leftGuildIds = (existingMembers || [])
      .map((row: any) => String(row.user_id))
      .filter((userId: string) => !seenIds.has(userId));

    if (leftGuildIds.length) {
      const { error: leftGuildError } = await sb
        .from("guild_members")
        .update({
          in_guild: false,
          data_health: "left_guild",
          role_state: "left_guild",
          role_state_reason: "Member no longer exists in guild",
          updated_at: new Date().toISOString(),
        })
        .eq("guild_id", guildId)
        .in("user_id", leftGuildIds);

      if (leftGuildError) {
        throw new Error(leftGuildError.message);
      }
    }

    const tokens = tokensRes.data || [];
    for (const token of tokens) {
      const requesterId = String(token.requester_id || token.user_id || "").trim();
      if (!requesterId) continue;

      const member = memberRows.find((row) => row.user_id === requesterId);
      const actualRoleState = member?.role_state || "left_guild";

      const expectedRoleState =
        String(token.status || "").toLowerCase() === "approved"
          ? "verified_ok"
          : "unverified_only";

      const roleSyncOk =
        expectedRoleState === "verified_ok"
          ? actualRoleState === "verified_ok" || actualRoleState === "staff_ok"
          : actualRoleState === "unverified_only";

      const roleSyncReason =
        roleSyncOk
          ? "Role state matches workflow expectation"
          : `Expected ${expectedRoleState} but found ${actualRoleState}`;

      await sb
        .from("verification_tokens")
        .update({
          requester_display_name: member?.display_name || null,
          requester_username: member?.username || null,
          requester_avatar_url: member?.avatar_url || null,
          requester_role_ids: member?.role_ids || [],
          requester_role_names: member?.role_names || [],
          actual_role_state: actualRoleState,
          expected_role_state: expectedRoleState,
          role_sync_ok: roleSyncOk,
          role_sync_reason: roleSyncReason,
          updated_at: new Date().toISOString(),
        })
        .eq("token", token.token);
    }

    return NextResponse.json({
      ok: true,
      guildId,
      syncedMembers: memberRows.length,
      leftGuildMarked: leftGuildIds.length,
      updatedTokens: tokens.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: String(error?.message || error),
      },
      { status: 500 }
    );
  }
}

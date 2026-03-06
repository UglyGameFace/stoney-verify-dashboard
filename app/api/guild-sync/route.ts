import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DiscordRole = {
  id: string;
  name: string;
  color?: number | null;
  position?: number;
};

type DiscordMember = {
  user?: {
    id?: string;
    username?: string;
    global_name?: string | null;
    avatar?: string | null;
    bot?: boolean;
  };
  nick?: string | null;
  roles?: string[];
};

type RuleGroup =
  | "unverified"
  | "verified"
  | "secondary_verified"
  | "staff"
  | "admin"
  | "cosmetic"
  | "excluded";

function pickEnv(...keys: string[]) {
  for (const key of keys) {
    const value = String(process.env[key] || "").trim();
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
  return fetch(`https://discord.com/api/v10${path}`, {
    headers: {
      authorization: `Bot ${botToken}`,
      "user-agent": "stoney-verify-dashboard-sync (vercel)",
    },
    cache: "no-store",
  });
}

async function fetchAllGuildMembers(guildId: string, botToken: string) {
  const all: DiscordMember[] = [];
  let after = "0";

  while (true) {
    const response = await discordGET(
      `/guilds/${guildId}/members?limit=1000&after=${after}`,
      botToken
    );

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Discord members fetch failed (${response.status}): ${text || response.statusText}`);
    }

    const batch = (await response.json()) as DiscordMember[];
    if (!Array.isArray(batch) || batch.length === 0) break;

    all.push(...batch);

    const last = batch[batch.length - 1]?.user?.id;
    if (!last || batch.length < 1000) break;
    after = String(last);
  }

  return all;
}

function buildRoleRuleSets(rows: any[]) {
  const groups: Record<RuleGroup, Set<string>> = {
    unverified: new Set<string>(),
    verified: new Set<string>(),
    secondary_verified: new Set<string>(),
    staff: new Set<string>(),
    admin: new Set<string>(),
    cosmetic: new Set<string>(),
    excluded: new Set<string>(),
  };

  for (const row of rows || []) {
    const group = String(row?.role_group || "") as RuleGroup;
    const roleId = String(row?.role_id || "").trim();
    if (roleId && group in groups && row?.active !== false) {
      groups[group].add(roleId);
    }
  }

  return groups;
}

function evaluateRoleState(roleIds: string[], groups: Record<RuleGroup, Set<string>>) {
  const has = (set: Set<string>) => roleIds.some((id) => set.has(id));

  const hasUnverified = has(groups.unverified);
  const hasVerifiedRole = has(groups.verified);
  const hasSecondaryVerifiedRole = has(groups.secondary_verified);
  const hasStaffRole = has(groups.staff) || has(groups.admin);
  const hasExcludedRole = has(groups.excluded);
  const hasCosmeticRole = has(groups.cosmetic);
  const hasAnyRole = roleIds.length > 0;

  if (hasExcludedRole) {
    return {
      has_any_role: hasAnyRole,
      data_health: "ok",
      has_unverified: hasUnverified,
      has_verified_role: hasVerifiedRole,
      has_staff_role: hasStaffRole,
      has_secondary_verified_role: hasSecondaryVerifiedRole,
      has_cosmetic_only: false,
      role_state: "unknown",
      role_state_reason: "Excluded role",
    };
  }

  if (hasStaffRole && hasUnverified) {
    return {
      has_any_role: hasAnyRole,
      data_health: "ok",
      has_unverified: hasUnverified,
      has_verified_role: hasVerifiedRole,
      has_staff_role: hasStaffRole,
      has_secondary_verified_role: hasSecondaryVerifiedRole,
      has_cosmetic_only: false,
      role_state: "staff_conflict",
      role_state_reason: "Staff/admin still has Unverified",
    };
  }

  if (hasStaffRole) {
    return {
      has_any_role: hasAnyRole,
      data_health: "ok",
      has_unverified: hasUnverified,
      has_verified_role: hasVerifiedRole,
      has_staff_role: hasStaffRole,
      has_secondary_verified_role: hasSecondaryVerifiedRole,
      has_cosmetic_only: false,
      role_state: "staff_ok",
      role_state_reason: "Staff/admin role is correct",
    };
  }

  if (hasVerifiedRole && hasUnverified) {
    return {
      has_any_role: hasAnyRole,
      data_health: "ok",
      has_unverified: hasUnverified,
      has_verified_role: hasVerifiedRole,
      has_staff_role: hasStaffRole,
      has_secondary_verified_role: hasSecondaryVerifiedRole,
      has_cosmetic_only: false,
      role_state: "verified_conflict",
      role_state_reason: "Verified member still has Unverified",
    };
  }

  if (hasVerifiedRole) {
    return {
      has_any_role: hasAnyRole,
      data_health: "ok",
      has_unverified: hasUnverified,
      has_verified_role: hasVerifiedRole,
      has_staff_role: hasStaffRole,
      has_secondary_verified_role: hasSecondaryVerifiedRole,
      has_cosmetic_only: false,
      role_state: "verified_ok",
      role_state_reason: "Verified/member role is correct",
    };
  }

  if (hasUnverified && hasCosmeticRole) {
    return {
      has_any_role: hasAnyRole,
      data_health: "ok",
      has_unverified: hasUnverified,
      has_verified_role: hasVerifiedRole,
      has_staff_role: hasStaffRole,
      has_secondary_verified_role: hasSecondaryVerifiedRole,
      has_cosmetic_only: true,
      role_state: "booster_only",
      role_state_reason: "Only Unverified plus cosmetic/booster role",
    };
  }

  if (hasUnverified) {
    return {
      has_any_role: hasAnyRole,
      data_health: "ok",
      has_unverified: hasUnverified,
      has_verified_role: hasVerifiedRole,
      has_staff_role: hasStaffRole,
      has_secondary_verified_role: hasSecondaryVerifiedRole,
      has_cosmetic_only: false,
      role_state: "unverified_only",
      role_state_reason: "Still in default unverified state",
    };
  }

  if (hasSecondaryVerifiedRole && !hasVerifiedRole) {
    return {
      has_any_role: hasAnyRole,
      data_health: "missing_role",
      has_unverified: hasUnverified,
      has_verified_role: hasVerifiedRole,
      has_staff_role: hasStaffRole,
      has_secondary_verified_role: hasSecondaryVerifiedRole,
      has_cosmetic_only: false,
      role_state: "missing_verified_role",
      role_state_reason: "Has secondary verified role but no real verified/member role",
    };
  }

  return {
    has_any_role: hasAnyRole,
    data_health: hasAnyRole ? "missing_role" : "unknown",
    has_unverified: hasUnverified,
    has_verified_role: hasVerifiedRole,
    has_staff_role: hasStaffRole,
    has_secondary_verified_role: hasSecondaryVerifiedRole,
    has_cosmetic_only: false,
    role_state: "missing_unverified",
    role_state_reason: "No Unverified and no verified/staff role found",
  };
}

function syncOutcome(expectedRoleState: string, actualRoleState: string) {
  if (!expectedRoleState || expectedRoleState === "unknown") {
    return { ok: true, reason: "No expected role state set" };
  }

  if (expectedRoleState === "verified_ok") {
    const ok = actualRoleState === "verified_ok" || actualRoleState === "staff_ok";
    return {
      ok,
      reason: ok ? "Verified role state matches" : `Expected verified state but found ${actualRoleState}`,
    };
  }

  if (expectedRoleState === "staff_ok") {
    const ok = actualRoleState === "staff_ok";
    return {
      ok,
      reason: ok ? "Staff role state matches" : `Expected staff state but found ${actualRoleState}`,
    };
  }

  if (expectedRoleState === "unverified_only") {
    const ok = actualRoleState === "unverified_only";
    return {
      ok,
      reason: ok ? "Unverified state matches" : `Expected unverified state but found ${actualRoleState}`,
    };
  }

  return { ok: true, reason: "No sync rule matched" };
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });

  const body = await req.json().catch(() => ({}));
  const guildId = String(body?.guildId || session.guildId || pickEnv("GUILD_ID", "DISCORD_GUILD_ID") || "").trim();
  if (!guildId) return NextResponse.json({ error: "Missing guildId" }, { status: 400 });

  const botToken = pickEnv("DISCORD_BOT_TOKEN", "DISCORD_TOKEN", "BOT_TOKEN");
  if (!botToken) return NextResponse.json({ error: "Missing DISCORD_BOT_TOKEN env var" }, { status: 500 });

  const [rulesRes, rolesRes, members] = await Promise.all([
    sb.from("guild_role_rules").select("*").eq("guild_id", guildId).eq("active", true),
    discordGET(`/guilds/${guildId}/roles`, botToken).then(async (r) => {
      if (!r.ok) {
        const text = await r.text().catch(() => "");
        throw new Error(`Discord roles fetch failed (${r.status}): ${text || r.statusText}`);
      }
      return (await r.json()) as DiscordRole[];
    }),
    fetchAllGuildMembers(guildId, botToken),
  ]);

  if (rulesRes.error) return NextResponse.json({ error: rulesRes.error.message }, { status: 500 });

  const roleById: Record<string, DiscordRole> = {};
  for (const role of rolesRes) roleById[String(role.id)] = role;

  const ruleSets = buildRoleRuleSets(rulesRes.data || []);
  const seenIds = new Set<string>();
  const upserts: any[] = [];

  for (const member of members) {
    const userId = String(member?.user?.id || "").trim();
    if (!userId) continue;
    seenIds.add(userId);

    const roleIds = Array.isArray(member?.roles) ? member.roles.map(String) : [];
    const roleNames = roleIds.map((id) => roleById[id]?.name).filter(Boolean) as string[];
    const sortedRoles = roleIds
      .map((id) => roleById[id])
      .filter(Boolean)
      .sort((a, b) => Number(b.position || 0) - Number(a.position || 0));
    const highest = sortedRoles[0] || null;

    const evaluation = evaluateRoleState(roleIds, ruleSets);

    upserts.push({
      guild_id: guildId,
      user_id: userId,
      username: member?.user?.username ? String(member.user.username) : null,
      display_name:
        (member?.nick ? String(member.nick) : null) ||
        (member?.user?.global_name ? String(member.user.global_name) : null) ||
        (member?.user?.username ? String(member.user.username) : null),
      avatar_url: avatarUrlFor(userId, member?.user?.avatar ? String(member.user.avatar) : null),
      role_ids: roleIds,
      role_names: roleNames,
      highest_role_id: highest?.id ? String(highest.id) : null,
      highest_role_name: highest?.name ? String(highest.name) : null,
      in_guild: true,
      synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...evaluation,
    });
  }

  if (upserts.length) {
    const { error: upsertError } = await sb
      .from("guild_members")
      .upsert(upserts, { onConflict: "guild_id,user_id" });
    if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  const { data: existingRows, error: existingError } = await sb
    .from("guild_members")
    .select("guild_id,user_id")
    .eq("guild_id", guildId);
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });

  const leftGuildIds = (existingRows || [])
    .map((row: any) => String(row.user_id || ""))
    .filter((userId: string) => userId && !seenIds.has(userId));

  if (leftGuildIds.length) {
    const { error: leftError } = await sb
      .from("guild_members")
      .update({
        in_guild: false,
        data_health: "left_guild",
        role_state: "left_guild",
        role_state_reason: "Member no longer exists in guild",
        synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("guild_id", guildId)
      .in("user_id", leftGuildIds);
    if (leftError) return NextResponse.json({ error: leftError.message }, { status: 500 });
  }

  const { data: tokens, error: tokensError } = await sb
    .from("verification_tokens")
    .select("token,guild_id,requester_id,user_id,expected_role_state")
    .eq("guild_id", guildId);
  if (tokensError) return NextResponse.json({ error: tokensError.message }, { status: 500 });

  const { data: syncedMembers, error: syncedMembersError } = await sb
    .from("guild_members")
    .select("guild_id,user_id,display_name,username,avatar_url,role_ids,role_names,role_state,role_state_reason")
    .eq("guild_id", guildId);
  if (syncedMembersError) return NextResponse.json({ error: syncedMembersError.message }, { status: 500 });

  const memberMap = new Map<string, any>();
  for (const row of syncedMembers || []) {
    memberMap.set(String(row.user_id), row);
  }

  for (const tokenRow of tokens || []) {
    const userId = String(tokenRow?.requester_id || tokenRow?.user_id || "").trim();
    if (!userId) continue;

    const member = memberMap.get(userId);
    if (!member) continue;

    const outcome = syncOutcome(
      String(tokenRow?.expected_role_state || "unknown"),
      String(member?.role_state || "unknown")
    );

    const { error: tokenUpdateError } = await sb
      .from("verification_tokens")
      .update({
        requester_display_name: member.display_name ?? null,
        requester_username: member.username ?? null,
        requester_avatar_url: member.avatar_url ?? null,
        requester_role_ids: member.role_ids ?? [],
        requester_role_names: member.role_names ?? [],
        actual_role_state: member.role_state ?? "unknown",
        role_sync_ok: outcome.ok,
        role_sync_reason: outcome.reason,
        updated_at: new Date().toISOString(),
      })
      .eq("token", tokenRow.token);

    if (tokenUpdateError) {
      return NextResponse.json({ error: tokenUpdateError.message }, { status: 500 });
    }
  }

  await sb.from("audit_logs").insert([
    {
      action: "guild_member_sync",
      token: null,
      staff_id: session.userId,
      meta: {
        guild_id: guildId,
        synced_members: upserts.length,
        left_guild_members: leftGuildIds.length,
        staff_username: session.username,
      },
    },
  ]);

  return NextResponse.json({
    ok: true,
    guildId,
    syncedMembers: upserts.length,
    leftGuildMembers: leftGuildIds.length,
    tokensUpdated: (tokens || []).length,
  });
}

import { NextResponse } from "next/server";
import { requireStaffSessionForRoute, applyAuthCookies } from "@/lib/auth-server";
import { createServerSupabase } from "@/lib/supabase-server";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isoTimeout(minutes) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

function safeAuditReason(value) {
  return encodeURIComponent(String(value || "").slice(0, 512));
}

async function discordApi(path, { method = "GET", body, reason } = {}) {
  const token = process.env.DISCORD_TOKEN || env.discordToken || "";
  if (!token) {
    throw new Error("Missing DISCORD_TOKEN");
  }

  const res = await fetch(`https://discord.com/api/v10${path}`, {
    method,
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
      ...(reason ? { "X-Audit-Log-Reason": safeAuditReason(reason) } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    const error = new Error(`Discord API ${res.status}: ${text}`);
    error.status = res.status;
    throw error;
  }

  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function normalizeGuildRoles(rows) {
  return Array.isArray(rows)
    ? rows
        .map((role) => ({
          id: String(role?.id || "").trim(),
          name: String(role?.name || "").trim(),
          position: Number(role?.position || 0),
          managed: Boolean(role?.managed),
        }))
        .filter((role) => role.id && role.name)
    : [];
}

function resolveRoleGroups({ roleIds, roleNames, roleRules }) {
  const activeRules = Array.isArray(roleRules)
    ? roleRules.filter((rule) => rule?.active !== false)
    : [];

  const byId = new Map(
    activeRules.map((rule) => [String(rule.role_id), String(rule.role_group || "")])
  );

  const byName = new Map(
    activeRules.map((rule) => [
      String(rule.role_name || "").toLowerCase(),
      String(rule.role_group || ""),
    ])
  );

  const envStaffNames = env.staffRoleNames.map((value) =>
    String(value || "").toLowerCase()
  );

  const hits = {
    unverified: false,
    verified: false,
    secondary_verified: false,
    staff: false,
    admin: false,
    cosmetic: false,
    excluded: false,
  };

  for (let i = 0; i < Math.max(roleIds.length, roleNames.length); i += 1) {
    const roleId = String(roleIds[i] || "");
    const roleName = String(roleNames[i] || "").trim();
    const lowered = roleName.toLowerCase();

    let group = byId.get(roleId) || byName.get(lowered) || "";

    if (!group) {
      if (env.staffRoleIds.includes(roleId) || envStaffNames.includes(lowered)) {
        group = "staff";
      } else if (lowered.includes("unverified")) {
        group = "unverified";
      } else if (lowered.includes("verified")) {
        group = "verified";
      } else if (/\b(staff|mod|moderator|admin|owner)\b/i.test(roleName)) {
        group = "staff";
      } else if (
        /\b(booster|musicbot|nitro|resident|perm|dickheads|drunken|stoner)\b/i.test(
          roleName
        )
      ) {
        group = "cosmetic";
      }
    }

    if (group && Object.prototype.hasOwnProperty.call(hits, group)) {
      hits[group] = true;
    }
  }

  return {
    has_unverified: hits.unverified,
    has_verified_role: hits.verified || hits.secondary_verified,
    has_secondary_verified_role: hits.secondary_verified,
    has_staff_role: hits.staff || hits.admin,
    has_cosmetic_only:
      !hits.unverified &&
      !hits.verified &&
      !hits.secondary_verified &&
      !hits.staff &&
      !hits.admin &&
      (hits.cosmetic || roleIds.length > 0),
  };
}

function resolveRoleState({
  inGuild,
  hasAnyRole,
  has_unverified,
  has_verified_role,
  has_staff_role,
  has_cosmetic_only,
}) {
  if (!inGuild) {
    return {
      data_health: "left_guild",
      role_state: "left_guild",
      role_state_reason: "Member is not currently present in Discord.",
    };
  }
  if (has_staff_role && has_unverified) {
    return {
      data_health: "missing_role",
      role_state: "staff_conflict",
      role_state_reason: "Member has both Staff and Unverified.",
    };
  }
  if (has_staff_role) {
    return {
      data_health: "ok",
      role_state: "staff_ok",
      role_state_reason: "Member has staff access with no unverified conflict.",
    };
  }
  if (has_verified_role && has_unverified) {
    return {
      data_health: "missing_role",
      role_state: "verified_conflict",
      role_state_reason: "Member has both Verified and Unverified roles.",
    };
  }
  if (has_verified_role) {
    return {
      data_health: "ok",
      role_state: "verified_ok",
      role_state_reason: "Member has a valid verified role set.",
    };
  }
  if (has_unverified) {
    return {
      data_health: "ok",
      role_state: "unverified_only",
      role_state_reason:
        "Member is pending verification and only has unverified access.",
    };
  }
  if (has_cosmetic_only) {
    return {
      data_health: "missing_role",
      role_state: "booster_only",
      role_state_reason:
        "Member has cosmetic roles but no core verification role.",
    };
  }
  if (!hasAnyRole) {
    return {
      data_health: "missing_role",
      role_state: "missing_unverified",
      role_state_reason:
        "Member has no tracked roles. Expected at least an unverified role.",
    };
  }
  return {
    data_health: "unknown",
    role_state: "unknown",
    role_state_reason:
      "Unable to determine member role state from current role set.",
  };
}

function buildAvatarUrl(memberUser) {
  const avatar = memberUser?.avatar || "";
  const userId = String(memberUser?.id || "");
  const discrim = Number(memberUser?.discriminator || 0) % 5;

  if (avatar && userId) {
    return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.png?size=128`;
  }

  return `https://cdn.discordapp.com/embed/avatars/${discrim}.png`;
}

function extractVoiceSnapshot(discordMember) {
  const voiceState = discordMember?.voice_state || null;
  return {
    voice_channel_id:
      String(
        voiceState?.channel_id ||
          discordMember?.channel_id ||
          discordMember?.voice_channel_id ||
          ""
      ).trim() || null,
    voice_state: voiceState
      ? {
          channel_id: voiceState?.channel_id || null,
          suppress: Boolean(voiceState?.suppress),
          request_to_speak_timestamp:
            voiceState?.request_to_speak_timestamp || null,
          self_mute: Boolean(voiceState?.self_mute),
          self_deaf: Boolean(voiceState?.self_deaf),
          mute: Boolean(voiceState?.mute),
          deaf: Boolean(voiceState?.deaf),
        }
      : null,
  };
}

async function buildFreshMemberSnapshot({ supabase, guildId, userId }) {
  const [discordMember, discordRoles, storedMemberRes, roleRulesRes] =
    await Promise.all([
      discordApi(`/guilds/${guildId}/members/${userId}`),
      discordApi(`/guilds/${guildId}/roles`),
      supabase
        .from("guild_members")
        .select("*")
        .eq("guild_id", guildId)
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("guild_role_rules")
        .select("*")
        .eq("guild_id", guildId)
        .eq("active", true),
    ]);

  if (storedMemberRes?.error) {
    throw new Error(
      storedMemberRes.error.message || "Failed to load stored member record."
    );
  }

  if (roleRulesRes?.error) {
    throw new Error(roleRulesRes.error.message || "Failed to load role rules.");
  }

  const storedMember = storedMemberRes?.data || null;
  const roleCatalog = normalizeGuildRoles(discordRoles);
  const roleMap = new Map(roleCatalog.map((role) => [role.id, role]));
  const roleIds = Array.isArray(discordMember?.roles)
    ? discordMember.roles.map(String)
    : [];

  const fullRoles = roleIds
    .map((roleId) => roleMap.get(roleId))
    .filter(Boolean)
    .sort((a, b) => b.position - a.position);

  const roleNames = fullRoles.map((role) => role.name);

  const highestRole = fullRoles[0] || null;

  const grouped = resolveRoleGroups({
    roleIds,
    roleNames,
    roleRules: roleRulesRes?.data || [],
  });

  const roleState = resolveRoleState({
    inGuild: true,
    hasAnyRole: roleIds.length > 0,
    ...grouped,
  });

  const now = new Date().toISOString();
  const currentUsername = String(discordMember?.user?.username || "").trim();
  const currentDisplayName = String(
    discordMember?.user?.global_name || discordMember?.nick || currentUsername
  ).trim();
  const currentNickname = String(discordMember?.nick || "").trim();
  const voice = extractVoiceSnapshot(discordMember);

  const row = {
    guild_id: guildId,
    user_id: userId,
    username: currentUsername,
    display_name: currentDisplayName,
    avatar_url: buildAvatarUrl(discordMember?.user),
    role_ids: roleIds,
    role_names: roleNames,
    highest_role_id: highestRole?.id || null,
    highest_role_name: highestRole?.name || null,
    in_guild: true,
    has_any_role: roleIds.length > 0,
    data_health: roleState.data_health,
    synced_at: now,
    updated_at: now,
    has_unverified: grouped.has_unverified,
    has_verified_role: grouped.has_verified_role,
    has_staff_role: grouped.has_staff_role,
    has_secondary_verified_role: grouped.has_secondary_verified_role,
    has_cosmetic_only: grouped.has_cosmetic_only,
    role_state: roleState.role_state,
    role_state_reason: roleState.role_state_reason,
    avatar_hash: discordMember?.user?.avatar || null,
    nickname: discordMember?.nick || null,
    roles: fullRoles,
    top_role: highestRole?.name || null,
    joined_at: discordMember?.joined_at || storedMember?.joined_at || now,
    last_seen_username: currentUsername || null,
    last_seen_display_name: currentDisplayName || null,
    last_seen_nickname: currentNickname || null,
    last_seen_at: now,
    voice_channel_id: voice.voice_channel_id,
    voice_state: voice.voice_state,
  };

  const { error: upsertError } = await supabase
    .from("guild_members")
    .upsert(row, { onConflict: "guild_id,user_id" });

  if (upsertError) {
    throw new Error(
      upsertError.message || "Failed to persist member snapshot."
    );
  }

  return {
    user_id: row.user_id,
    username: row.username,
    display_name: row.display_name,
    global_name: row.display_name,
    avatar: row.avatar_hash,
    avatar_url: row.avatar_url,
    nickname: row.nickname,
    joined_at: row.joined_at,
    role_ids: row.role_ids,
    role_names: row.role_names,
    top_role: row.top_role,
    roles: row.roles,
    in_guild: true,
    discord_unavailable: false,
    data_health: row.data_health,
    role_state: row.role_state,
    role_state_reason: row.role_state_reason,
    has_unverified: row.has_unverified,
    has_verified_role: row.has_verified_role,
    has_staff_role: row.has_staff_role,
    has_secondary_verified_role: row.has_secondary_verified_role,
    has_cosmetic_only: row.has_cosmetic_only,
    synced_at: row.synced_at,
    updated_at: row.updated_at,
    highest_role_id: row.highest_role_id,
    highest_role_name: row.highest_role_name,
    last_seen_at: row.last_seen_at,
    voice_channel_id: row.voice_channel_id,
    voice_state: row.voice_state,
  };
}

async function markMemberLeft({ supabase, guildId, userId }) {
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("guild_members")
    .update({
      in_guild: false,
      data_health: "left_guild",
      role_state: "left_guild",
      role_state_reason: "Member is no longer present in Discord.",
      updated_at: now,
      last_seen_at: now,
      left_at: now,
      voice_channel_id: null,
      voice_state: null,
    })
    .eq("guild_id", guildId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message || "Failed to mark member as left_guild.");
  }

  const { data, error: readError } = await supabase
    .from("guild_members")
    .select("*")
    .eq("guild_id", guildId)
    .eq("user_id", userId)
    .maybeSingle();

  if (readError) {
    throw new Error(readError.message || "Failed to load updated member row.");
  }

  return data
    ? {
        ...data,
        discord_unavailable: true,
      }
    : {
        user_id: userId,
        in_guild: false,
        discord_unavailable: true,
        data_health: "left_guild",
        role_state: "left_guild",
        role_state_reason: "Member is no longer present in Discord.",
      };
}

async function refreshMemberAfterAction({ supabase, guildId, userId, action }) {
  const leftGuildActions = new Set(["kick", "ban"]);

  try {
    if (leftGuildActions.has(action)) {
      return await markMemberLeft({ supabase, guildId, userId });
    }

    return await buildFreshMemberSnapshot({ supabase, guildId, userId });
  } catch (error) {
    if (Number(error?.status) === 404 || /unknown member/i.test(String(error?.message || ""))) {
      return await markMemberLeft({ supabase, guildId, userId });
    }
    throw error;
  }
}

export async function POST(req) {
  try {
    const { session, refreshedTokens } = await requireStaffSessionForRoute();
    const supabase = createServerSupabase();
    const guildId = env.guildId || "";
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "").toLowerCase().trim();
    const userId = String(body.user_id || "").trim();
    const reason =
      String(body.reason || "").trim() ||
      "Action taken from Stoney Verify Dashboard";
    const rawMinutes = Number(body.minutes || 10);
    const timeoutMinutes = Number.isFinite(rawMinutes)
      ? Math.max(1, Math.min(rawMinutes, 40320))
      : 10;
    const staffName =
      session?.user?.username ||
      session?.user?.name ||
      env.defaultStaffName ||
      "Dashboard Staff";
    const staffId = session?.user?.id || "unknown";

    if (!guildId) {
      return NextResponse.json({ error: "Missing guild id" }, { status: 500 });
    }

    if (!userId) {
      return NextResponse.json({ error: "Missing user id" }, { status: 400 });
    }

    const normalizedAction =
      action === "remove_timeout" ? "untimeout" : action;

    if (normalizedAction === "warn") {
      const { error } = await supabase.from("warns").insert({
        guild_id: guildId,
        user_id: userId,
        username: body.username || userId,
        reason: `${reason} — issued by ${staffName}`,
        source_message: null,
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else if (normalizedAction === "timeout") {
      await discordApi(`/guilds/${guildId}/members/${userId}`, {
        method: "PATCH",
        body: { communication_disabled_until: isoTimeout(timeoutMinutes) },
        reason: `${reason} — by ${staffName}`,
      });
    } else if (normalizedAction === "untimeout") {
      await discordApi(`/guilds/${guildId}/members/${userId}`, {
        method: "PATCH",
        body: { communication_disabled_until: null },
        reason: `Timeout removed by ${staffName}`,
      });
    } else if (normalizedAction === "kick") {
      await discordApi(`/guilds/${guildId}/members/${userId}`, {
        method: "DELETE",
        reason: `${reason} — by ${staffName}`,
      });
    } else if (normalizedAction === "ban") {
      await discordApi(`/guilds/${guildId}/bans/${userId}`, {
        method: "PUT",
        body: { delete_message_seconds: 0 },
        reason: `${reason} — by ${staffName}`,
      });
    } else if (
      normalizedAction === "add_role" ||
      normalizedAction === "remove_role"
    ) {
      const roleId = String(body.role_id || "").trim();

      if (!roleId) {
        return NextResponse.json({ error: "Missing role_id" }, { status: 400 });
      }

      const roleRows = normalizeGuildRoles(
        await discordApi(`/guilds/${guildId}/roles`)
      );
      const targetRole = roleRows.find((role) => role.id === roleId);

      if (!targetRole) {
        return NextResponse.json(
          { error: "Role not found in Discord." },
          { status: 404 }
        );
      }

      if (targetRole.managed) {
        return NextResponse.json(
          { error: "Managed or integration roles cannot be changed here." },
          { status: 400 }
        );
      }

      await discordApi(`/guilds/${guildId}/members/${userId}/roles/${roleId}`, {
        method: normalizedAction === "add_role" ? "PUT" : "DELETE",
        reason: `${reason} — by ${staffName}`,
      });
    } else if (
      normalizedAction === "mute" ||
      normalizedAction === "unmute" ||
      normalizedAction === "deafen" ||
      normalizedAction === "undeafen"
    ) {
      const patch = {};

      if (normalizedAction === "mute") patch.mute = true;
      if (normalizedAction === "unmute") patch.mute = false;
      if (normalizedAction === "deafen") patch.deaf = true;
      if (normalizedAction === "undeafen") patch.deaf = false;

      await discordApi(`/guilds/${guildId}/members/${userId}`, {
        method: "PATCH",
        body: patch,
        reason: `${reason} — by ${staffName}`,
      });
    } else if (normalizedAction === "disconnect_voice") {
      await discordApi(`/guilds/${guildId}/members/${userId}`, {
        method: "PATCH",
        body: { channel_id: null },
        reason: `${reason} — by ${staffName}`,
      });
    } else if (normalizedAction === "move_voice") {
      const targetChannelId = String(
        body.target_channel_id || body.channel_id || ""
      ).trim();

      if (!targetChannelId) {
        return NextResponse.json(
          { error: "Missing target_channel_id" },
          { status: 400 }
        );
      }

      await discordApi(`/guilds/${guildId}/members/${userId}`, {
        method: "PATCH",
        body: { channel_id: targetChannelId },
        reason: `${reason} — by ${staffName}`,
      });
    } else if (normalizedAction === "history") {
      const { data: warns } = await supabase
        .from("warns")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      const { data: tickets } = await supabase
        .from("tickets")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      const response = NextResponse.json({
        warns: warns || [],
        tickets: tickets || [],
      });
      applyAuthCookies(response, refreshedTokens);
      return response;
    } else {
      return NextResponse.json(
        { error: "Unsupported action" },
        { status: 400 }
      );
    }

    await supabase.from("audit_events").insert({
      title: `Member ${normalizedAction}`,
      description: `${staffName} performed ${normalizedAction} on ${userId}${
        normalizedAction === "timeout"
          ? ` for ${timeoutMinutes} minute(s)`
          : ""
      }. Reason: ${reason}`,
      event_type: `member_${normalizedAction}`,
      related_id: userId,
    });

    let refreshedMember = null;
    let refreshWarning = null;

    try {
      refreshedMember = await refreshMemberAfterAction({
        supabase,
        guildId,
        userId,
        action: normalizedAction,
      });
    } catch (refreshError) {
      refreshWarning =
        refreshError?.message || "Member refresh failed after Discord action.";
    }

    const response = NextResponse.json({
      ok: true,
      action: normalizedAction,
      original_action: action,
      user_id: userId,
      timeout_minutes:
        normalizedAction === "timeout" ? timeoutMinutes : null,
      staff_id: staffId,
      member: refreshedMember,
      refresh_warning: refreshWarning,
    });

    applyAuthCookies(response, refreshedTokens);
    return response;
  } catch (error) {
    const status =
      Number(error?.status) ||
      (String(error?.message || "").toLowerCase() === "unauthorized"
        ? 401
        : 500);

    return NextResponse.json(
      { error: error.message || "Moderation action failed" },
      { status }
    );
  }
}

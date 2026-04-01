import { NextResponse } from "next/server";
import {
  requireStaffSessionForRoute,
  applyAuthCookies,
} from "@/lib/auth-server";
import { createServerSupabase } from "@/lib/supabase-server";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function discordApi(path) {
  const token = process.env.DISCORD_TOKEN || env.discordToken || "";

  if (!token) {
    throw new Error("Missing DISCORD_TOKEN");
  }

  const res = await fetch(`https://discord.com/api/v10${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`Discord API ${res.status}: ${text}`);
    err.status = res.status;
    throw err;
  }

  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeString(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function normalizeStoredMemberPayload(storedMember = {}) {
  return {
    ...storedMember,
    previous_usernames: safeArray(storedMember?.previous_usernames),
    previous_display_names: safeArray(storedMember?.previous_display_names),
    previous_nicknames: safeArray(storedMember?.previous_nicknames),
    role_ids: safeArray(storedMember?.role_ids),
    role_names: safeArray(storedMember?.role_names),
    roles: safeArray(storedMember?.roles),
    activity_log: safeArray(storedMember?.activity_log),
    action_history: safeArray(storedMember?.action_history),
    mod_history: safeArray(storedMember?.mod_history),
  };
}

function normalizeStoredRoles(storedMember) {
  if (Array.isArray(storedMember?.roles) && storedMember.roles.length) {
    return storedMember.roles
      .map((role, index) => {
        if (typeof role === "string") {
          return {
            id: storedMember?.role_ids?.[index] || `stored-${index}`,
            name: role,
            position: 0,
          };
        }

        if (role && typeof role === "object") {
          return {
            id: role.id || storedMember?.role_ids?.[index] || `stored-${index}`,
            name:
              role.name ||
              storedMember?.role_names?.[index] ||
              "Unknown Role",
            position: Number(role.position || 0),
          };
        }

        return null;
      })
      .filter(Boolean);
  }

  if (Array.isArray(storedMember?.role_names) && storedMember.role_names.length) {
    return storedMember.role_names.map((name, index) => ({
      id: storedMember?.role_ids?.[index] || `stored-${index}`,
      name,
      position: 0,
    }));
  }

  return [];
}

async function getStoredMember(supabase, guildId, userId) {
  const { data, error } = await supabase
    .from("guild_members")
    .select("*")
    .eq("guild_id", guildId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to load stored member record.");
  }

  return data || null;
}

function buildAvatarUrl(user, fallback = "") {
  const avatar = safeString(user?.avatar);
  const userId = safeString(user?.id);

  if (avatar && userId) {
    return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.png?size=128`;
  }

  if (fallback) return fallback;

  const discrim = Number(user?.discriminator || 0) % 5;
  return `https://cdn.discordapp.com/embed/avatars/${discrim}.png`;
}

function extractVoiceSnapshot(member, storedMember) {
  const voiceState = member?.voice_state || storedMember?.voice_state || null;

  return {
    voice_channel_id:
      safeString(
        voiceState?.channel_id ||
          member?.channel_id ||
          member?.voice_channel_id ||
          storedMember?.voice_channel_id
      ) || null,
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

function mergeUniqueStrings(...groups) {
  const out = [];
  const seen = new Set();

  for (const group of groups) {
    for (const value of safeArray(group)) {
      const text = safeString(value);
      if (!text) continue;
      const key = text.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(text);
    }
  }

  return out;
}

function chooseDisplayName(member, storedMember) {
  return (
    safeString(storedMember?.display_name) ||
    safeString(member?.user?.global_name) ||
    safeString(member?.nick) ||
    safeString(member?.user?.username) ||
    safeString(storedMember?.username) ||
    ""
  );
}

function chooseNickname(member, storedMember) {
  return safeString(member?.nick) || safeString(storedMember?.nickname) || "";
}

function chooseUsername(member, storedMember) {
  return (
    safeString(member?.user?.username) ||
    safeString(storedMember?.username) ||
    ""
  );
}

function chooseRoleState(storedMember, inGuild) {
  if (!inGuild) {
    return safeString(storedMember?.role_state, "left_guild");
  }
  return safeString(storedMember?.role_state, "unknown");
}

function chooseRoleStateReason(storedMember, inGuild) {
  if (!inGuild) {
    return (
      safeString(storedMember?.role_state_reason) ||
      "Member is no longer present in the guild."
    );
  }
  return safeString(storedMember?.role_state_reason);
}

function buildMergedMemberPayload({
  userId,
  guildMember,
  storedMember,
  fullRoles,
  inGuild,
}) {
  const normalizedStored = normalizeStoredMemberPayload(storedMember || {});
  const storedRoles = normalizeStoredRoles(normalizedStored);
  const mergedRoles = fullRoles.length ? fullRoles : storedRoles;
  const voice = extractVoiceSnapshot(guildMember, normalizedStored);

  const displayName = chooseDisplayName(guildMember, normalizedStored);
  const username = chooseUsername(guildMember, normalizedStored);
  const nickname = chooseNickname(guildMember, normalizedStored);
  const topRoleName =
    mergedRoles[0]?.name ||
    safeString(normalizedStored?.top_role) ||
    safeString(normalizedStored?.highest_role_name) ||
    null;
  const topRoleId =
    mergedRoles[0]?.id ||
    safeString(normalizedStored?.highest_role_id) ||
    null;

  return {
    ...normalizedStored,

    user_id:
      safeString(guildMember?.user?.id) ||
      safeString(normalizedStored?.user_id) ||
      userId,

    username,
    display_name: displayName,
    global_name:
      safeString(guildMember?.user?.global_name) || displayName || "",
    nickname,

    avatar: safeString(guildMember?.user?.avatar) || safeString(normalizedStored?.avatar_hash),
    avatar_hash:
      safeString(guildMember?.user?.avatar) || safeString(normalizedStored?.avatar_hash),
    avatar_url: buildAvatarUrl(
      guildMember?.user,
      safeString(normalizedStored?.avatar_url)
    ),

    joined_at: guildMember?.joined_at || normalizedStored?.joined_at || null,

    role_ids: mergedRoles.map((role) => String(role.id)),
    role_names: mergedRoles.map((role) => String(role.name)),
    roles: mergedRoles,

    top_role: topRoleName,
    highest_role_id: topRoleId,
    highest_role_name: topRoleName,

    in_guild: Boolean(inGuild),
    discord_unavailable: !inGuild,

    data_health: safeString(
      normalizedStored?.data_health,
      inGuild ? "ok" : "left_guild"
    ),

    role_state: chooseRoleState(normalizedStored, inGuild),
    role_state_reason: chooseRoleStateReason(normalizedStored, inGuild),

    has_unverified: Boolean(normalizedStored?.has_unverified),
    has_verified_role: Boolean(normalizedStored?.has_verified_role),
    has_staff_role: Boolean(normalizedStored?.has_staff_role),
    has_secondary_verified_role: Boolean(normalizedStored?.has_secondary_verified_role),
    has_cosmetic_only: Boolean(normalizedStored?.has_cosmetic_only),

    synced_at: normalizedStored?.synced_at || null,
    updated_at: normalizedStored?.updated_at || null,
    last_seen_at: normalizedStored?.last_seen_at || null,
    left_at: normalizedStored?.left_at || null,
    rejoined_at: normalizedStored?.rejoined_at || null,

    voice_channel_id: voice.voice_channel_id,
    voice_state: voice.voice_state,

    previous_usernames: mergeUniqueStrings(
      [safeString(normalizedStored?.username)],
      normalizedStored?.previous_usernames
    ),
    previous_display_names: mergeUniqueStrings(
      [safeString(normalizedStored?.display_name)],
      normalizedStored?.previous_display_names
    ),
    previous_nicknames: mergeUniqueStrings(
      [safeString(normalizedStored?.nickname)],
      normalizedStored?.previous_nicknames
    ),

    activity_log: safeArray(normalizedStored?.activity_log),
    action_history: safeArray(normalizedStored?.action_history),
    mod_history: safeArray(normalizedStored?.mod_history),

    join_method: safeString(normalizedStored?.join_method),
    entry_method: safeString(normalizedStored?.entry_method),
    joined_via: safeString(normalizedStored?.joined_via),
    verification_source: safeString(normalizedStored?.verification_source),
    entry_source: safeString(normalizedStored?.entry_source),
    source_type: safeString(normalizedStored?.source_type),

    invited_by: safeString(normalizedStored?.invited_by),
    invited_by_name: safeString(normalizedStored?.invited_by_name),
    inviter_name: safeString(normalizedStored?.inviter_name),
    inviter_id: safeString(normalizedStored?.inviter_id),

    approved_by: safeString(normalizedStored?.approved_by),
    approved_by_name: safeString(normalizedStored?.approved_by_name),
    verified_by: safeString(normalizedStored?.verified_by),
    verified_by_name: safeString(normalizedStored?.verified_by_name),
    staff_actor_name: safeString(normalizedStored?.staff_actor_name),
    staff_actor_id: safeString(normalizedStored?.staff_actor_id),

    vouched_by: safeString(normalizedStored?.vouched_by),
    vouched_by_name: safeString(normalizedStored?.vouched_by_name),
    voucher_name: safeString(normalizedStored?.voucher_name),
    voucher_id: safeString(normalizedStored?.voucher_id),

    invite_code: safeString(normalizedStored?.invite_code),
    discord_invite_code: safeString(normalizedStored?.discord_invite_code),

    verification_ticket_id: safeString(normalizedStored?.verification_ticket_id),
    ticket_id: safeString(normalizedStored?.ticket_id),
    source_ticket_id: safeString(normalizedStored?.source_ticket_id),
    ticket_channel_id: safeString(normalizedStored?.ticket_channel_id),
    channel_id: safeString(normalizedStored?.channel_id),

    entry_reason: safeString(normalizedStored?.entry_reason),
    join_note: safeString(normalizedStored?.join_note),
    verification_note: safeString(normalizedStored?.verification_note),
    approval_reason: safeString(normalizedStored?.approval_reason),
  };
}

function jsonWithCookies(body, status, refreshedTokens) {
  const response = NextResponse.json(body, { status });
  applyAuthCookies(response, refreshedTokens);
  return response;
}

export async function GET(req) {
  let refreshedTokens = null;

  try {
    const auth = await requireStaffSessionForRoute();
    refreshedTokens = auth?.refreshedTokens || null;

    const supabase = createServerSupabase();
    const url = new URL(req.url);
    const guildId = env.guildId || "";
    const userId = safeString(url.searchParams.get("user_id"));

    if (!guildId) {
      return jsonWithCookies({ error: "Missing guild id" }, 500, refreshedTokens);
    }

    if (!userId) {
      return jsonWithCookies({ error: "Missing user id" }, 400, refreshedTokens);
    }

    const storedMember = await getStoredMember(supabase, guildId, userId);

    let guildMember = null;
    let roles = [];

    try {
      const [memberResult, rolesResult] = await Promise.all([
        discordApi(`/guilds/${guildId}/members/${userId}`),
        discordApi(`/guilds/${guildId}/roles`),
      ]);

      guildMember = memberResult;
      roles = safeArray(rolesResult);
    } catch (err) {
      if (err?.status !== 404) {
        throw err;
      }
    }

    const roleMap = new Map(
      safeArray(roles).map((role) => [String(role.id), role])
    );

    const liveRoleIds = Array.isArray(guildMember?.roles) ? guildMember.roles : [];
    const fullRoles = liveRoleIds
      .map((roleId) => roleMap.get(String(roleId)))
      .filter(Boolean)
      .sort((a, b) => Number(b.position || 0) - Number(a.position || 0))
      .map((role) => ({
        id: String(role.id),
        name: String(role.name || "Unknown Role"),
        position: Number(role.position || 0),
      }));

    const memberPayload = buildMergedMemberPayload({
      userId,
      guildMember,
      storedMember,
      fullRoles,
      inGuild: Boolean(guildMember),
    });

    return jsonWithCookies(
      {
        ok: true,
        member: memberPayload,
      },
      200,
      refreshedTokens
    );
  } catch (error) {
    return jsonWithCookies(
      { error: error?.message || "Failed to load member details" },
      Number(error?.status) || 500,
      refreshedTokens
    );
  }
}

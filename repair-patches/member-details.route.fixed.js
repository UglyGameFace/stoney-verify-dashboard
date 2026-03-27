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
  const avatar = String(user?.avatar || "").trim();
  const userId = String(user?.id || "").trim();

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
      String(
        voiceState?.channel_id ||
          member?.channel_id ||
          member?.voice_channel_id ||
          storedMember?.voice_channel_id ||
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

export async function GET(req) {
  try {
    const { refreshedTokens } = await requireStaffSessionForRoute();
    const supabase = createServerSupabase();
    const url = new URL(req.url);
    const guildId = env.guildId || "";
    const userId = String(url.searchParams.get("user_id") || "").trim();

    if (!guildId) {
      return NextResponse.json({ error: "Missing guild id" }, { status: 500 });
    }

    if (!userId) {
      return NextResponse.json({ error: "Missing user id" }, { status: 400 });
    }

    let member = null;
    let roles = [];

    try {
      const results = await Promise.all([
        discordApi(`/guilds/${guildId}/members/${userId}`),
        discordApi(`/guilds/${guildId}/roles`),
      ]);

      member = results[0];
      roles = results[1];
    } catch (err) {
      if (err?.status === 404) {
        const storedMember = normalizeStoredMemberPayload(
          await getStoredMember(supabase, guildId, userId)
        );
        const storedRoles = normalizeStoredRoles(storedMember);
        const voice = extractVoiceSnapshot(null, storedMember);

        const response = NextResponse.json({
          ok: true,
          member: {
            ...storedMember,
            user_id: storedMember?.user_id || userId,
            username: storedMember?.username || "",
            display_name: storedMember?.display_name || "",
            global_name: storedMember?.display_name || "",
            avatar: storedMember?.avatar_hash || "",
            avatar_url: storedMember?.avatar_url || "",
            nickname: storedMember?.nickname || "",
            joined_at: storedMember?.joined_at || null,
            role_ids: safeArray(storedMember?.role_ids).length
              ? storedMember.role_ids
              : storedRoles.map((role) => role.id),
            role_names: safeArray(storedMember?.role_names).length
              ? storedMember.role_names
              : storedRoles.map((role) => role.name),
            top_role:
              storedMember?.top_role ||
              storedMember?.highest_role_name ||
              storedRoles[0]?.name ||
              null,
            roles: storedRoles,
            in_guild: false,
            discord_unavailable: true,
            data_health: storedMember?.data_health || "left_guild",
            role_state: storedMember?.role_state || "left_guild",
            role_state_reason: storedMember?.role_state_reason || "",
            has_unverified: Boolean(storedMember?.has_unverified),
            has_verified_role: Boolean(storedMember?.has_verified_role),
            has_staff_role: Boolean(storedMember?.has_staff_role),
            has_secondary_verified_role:
              Boolean(storedMember?.has_secondary_verified_role),
            has_cosmetic_only: Boolean(storedMember?.has_cosmetic_only),
            synced_at: storedMember?.synced_at || null,
            updated_at: storedMember?.updated_at || null,
            last_seen_at: storedMember?.last_seen_at || null,
            highest_role_id: storedMember?.highest_role_id || null,
            highest_role_name: storedMember?.highest_role_name || null,
            voice_channel_id: voice.voice_channel_id,
            voice_state: voice.voice_state,
          },
        });

        applyAuthCookies(response, refreshedTokens);
        return response;
      }

      throw err;
    }

    const storedMember = normalizeStoredMemberPayload(
      await getStoredMember(supabase, guildId, userId)
    );

    const roleMap = new Map((roles || []).map((role) => [role.id, role]));
    const roleIds = Array.isArray(member?.roles) ? member.roles : [];

    const fullRoles = roleIds
      .map((roleId) => roleMap.get(roleId))
      .filter(Boolean)
      .sort((a, b) => b.position - a.position)
      .map((role) => ({
        id: role.id,
        name: role.name,
        position: role.position,
      }));

    const voice = extractVoiceSnapshot(member, storedMember);

    const response = NextResponse.json({
      ok: true,
      member: {
        ...storedMember,
        user_id: member?.user?.id || storedMember?.user_id || userId,
        username: member?.user?.username || storedMember?.username || "",
        display_name:
          storedMember?.display_name ||
          member?.user?.global_name ||
          member?.nick ||
          member?.user?.username ||
          "",
        global_name:
          member?.user?.global_name || storedMember?.display_name || "",
        avatar: member?.user?.avatar || storedMember?.avatar_hash || "",
        avatar_url: buildAvatarUrl(
          member?.user,
          storedMember?.avatar_url || ""
        ),
        nickname: member?.nick || storedMember?.nickname || "",
        joined_at: member?.joined_at || storedMember?.joined_at || null,
        role_ids: fullRoles.map((role) => role.id),
        role_names: fullRoles.map((role) => role.name),
        top_role:
          fullRoles[0]?.name ||
          storedMember?.top_role ||
          storedMember?.highest_role_name ||
          null,
        roles: fullRoles,
        in_guild: true,
        discord_unavailable: false,
        data_health: storedMember?.data_health || "ok",
        role_state: storedMember?.role_state || "unknown",
        role_state_reason: storedMember?.role_state_reason || "",
        has_unverified: Boolean(storedMember?.has_unverified),
        has_verified_role: Boolean(storedMember?.has_verified_role),
        has_staff_role: Boolean(storedMember?.has_staff_role),
        has_secondary_verified_role:
          Boolean(storedMember?.has_secondary_verified_role),
        has_cosmetic_only: Boolean(storedMember?.has_cosmetic_only),
        synced_at: storedMember?.synced_at || null,
        updated_at: storedMember?.updated_at || null,
        last_seen_at: storedMember?.last_seen_at || null,
        highest_role_id:
          fullRoles[0]?.id || storedMember?.highest_role_id || null,
        highest_role_name:
          fullRoles[0]?.name || storedMember?.highest_role_name || null,
        voice_channel_id: voice.voice_channel_id,
        voice_state: voice.voice_state,
      },
    });

    applyAuthCookies(response, refreshedTokens);
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to load member details" },
      { status: Number(error?.status) || 500 }
    );
  }
}

import { createServerSupabase } from "@/lib/supabase-server";
import { fetchGuildRoles, discordBotFetch, normalizeMember } from "@/lib/discord-api";
import { env } from "@/lib/env";
import { requireDashboardStaffSession, dashboardAuthJson, dashboardAuthErrorJson } from "@/lib/dashboard-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function normalizeString(value) {
  return String(value || "").trim();
}

function getSessionUser(session) {
  return session?.user || session?.discordUser || session?.staffUser || null;
}

function getActorId(session) {
  const user = getSessionUser(session);
  return normalizeString(user?.discord_id || user?.id || user?.user_id || session?.discordUser?.id || "");
}

function getActorName(session) {
  const user = getSessionUser(session);
  return normalizeString(
    user?.global_name ||
      user?.display_name ||
      user?.username ||
      user?.name ||
      session?.discordUser?.username ||
      "Dashboard Staff"
  );
}

function json(payload, status = 200, session = null) {
  return dashboardAuthJson(payload, status, session);
}

async function fetchGuildMemberBatch(guildId, after = "0", limit = 500) {
  return discordBotFetch(`/guilds/${guildId}/members?limit=${limit}&after=${after}`);
}

async function insertRoleSyncActivity(supabase, args) {
  const now = new Date().toISOString();
  const attempts = [
    {
      guild_id: args.guildId,
      title: "Full role sync completed",
      description: `Synced ${args.roleCount} roles and ${args.memberCount} members from Discord.`,
      event_family: "member",
      event_type: "role_sync",
      source: "dashboard_role_sync",
      actor_user_id: args.actorId,
      actor_name: args.actorName,
      metadata: {
        synced_roles: args.roleCount,
        synced_members: args.memberCount,
        has_more: false,
      },
      created_at: now,
    },
    {
      guild_id: args.guildId,
      title: "Full role sync completed",
      description: `Synced ${args.roleCount} roles and ${args.memberCount} members from Discord.`,
      event_type: "role_sync",
      source: "dashboard_role_sync",
      actor_user_id: args.actorId,
      actor_name: args.actorName,
      created_at: now,
    },
  ];

  for (const candidate of attempts) {
    try {
      const { error } = await supabase.from("activity_feed_events").insert(candidate);
      if (!error) return;
    } catch {
      // Best-effort only.
    }
  }
}

export async function POST() {
  let session = null;
  try {
    session = await requireDashboardStaffSession();
    const supabase = createServerSupabase();
    const guildId = normalizeString(session.selectedGuildId);

    if (!guildId) {
      return json(
        {
          ok: false,
          error: "Select a server before running role sync.",
          error_code: "selected_server_required",
          needsServerSelection: true,
        },
        428,
        session
      );
    }

    const actorId = getActorId(session);
    const actorName = getActorName(session);
    const batchLimit = Math.min(Math.max(Number(env.botAutoSyncBatchLimit || 500), 100), 1000);

    const roles = await fetchGuildRoles(guildId);
    const roleMap = new Map(roles.map((role) => [role.id, role]));
    const roleCounts = new Map();

    const allMembers = [];
    let after = "0";

    while (true) {
      const batch = await fetchGuildMemberBatch(guildId, after, batchLimit);
      const members = Array.isArray(batch) ? batch : [];

      if (!members.length) break;

      allMembers.push(...members);

      for (const member of members) {
        for (const roleId of member.roles || []) {
          roleCounts.set(roleId, (roleCounts.get(roleId) || 0) + 1);
        }
      }

      if (members.length < batchLimit) break;

      after = members[members.length - 1].user.id;
    }

    const now = new Date().toISOString();

    const normalizedMembers = allMembers.map((member) => ({
      guild_id: guildId,
      ...normalizeMember(member, roleMap),
      in_guild: true,
      synced_at: now,
      updated_at: now,
    }));

    const roleRows = roles.map((role) => ({
      guild_id: guildId,
      role_id: role.id,
      name: role.name,
      position: role.position,
      member_count: roleCounts.get(role.id) || 0,
    }));

    if (roleRows.length) {
      const { error: roleError } = await supabase
        .from("guild_roles")
        .upsert(roleRows, { onConflict: "guild_id,role_id" });

      if (roleError) {
        return json({ ok: false, selectedGuildId: guildId, error: roleError.message }, 500, session);
      }
    }

    const { error: markLeftError } = await supabase
      .from("guild_members")
      .update({
        in_guild: false,
        data_health: "left_guild",
        role_state: "left_guild",
        role_state_reason: "Not present in latest Discord role sync.",
        synced_at: now,
        updated_at: now,
      })
      .eq("guild_id", guildId);

    if (markLeftError) {
      return json({ ok: false, selectedGuildId: guildId, error: markLeftError.message }, 500, session);
    }

    if (normalizedMembers.length) {
      const { error: memberError } = await supabase
        .from("guild_members")
        .upsert(normalizedMembers, { onConflict: "guild_id,user_id" });

      if (memberError) {
        return json({ ok: false, selectedGuildId: guildId, error: memberError.message }, 500, session);
      }
    }

    await insertRoleSyncActivity(supabase, {
      guildId,
      actorId,
      actorName,
      roleCount: roles.length,
      memberCount: normalizedMembers.length,
    });

    return json(
      {
        ok: true,
        selectedGuildId: guildId,
        syncedRoles: roles.length,
        syncedMembers: normalizedMembers.length,
        has_more: false,
        next_after: null,
      },
      200,
      session
    );
  } catch (error) {
    return dashboardAuthErrorJson(error, session, 500);
  }
}

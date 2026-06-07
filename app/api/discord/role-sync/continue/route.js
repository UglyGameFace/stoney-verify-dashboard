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
      title: "Continuation role sync completed",
      description: `Synced ${args.memberCount} additional members from Discord.`,
      event_family: "member",
      event_type: "role_sync_continue",
      source: "dashboard_role_sync_continue",
      actor_user_id: args.actorId,
      actor_name: args.actorName,
      metadata: {
        synced_members: args.memberCount,
        next_after: args.nextAfter || null,
        has_more: args.hasMore,
      },
      created_at: now,
    },
    {
      guild_id: args.guildId,
      title: "Continuation role sync completed",
      description: `Synced ${args.memberCount} additional members from Discord.`,
      event_type: "role_sync_continue",
      source: "dashboard_role_sync_continue",
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

export async function GET(request) {
  let session = null;
  try {
    session = await requireDashboardStaffSession();
    const supabase = createServerSupabase();
    const guildId = normalizeString(session.selectedGuildId);

    if (!guildId) {
      return json(
        {
          ok: false,
          error: "Select a server before continuing role sync.",
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
    const url = new URL(request.url);
    const after = normalizeString(url.searchParams.get("after")) || "0";

    const roles = await fetchGuildRoles(guildId);
    const roleMap = new Map(roles.map((role) => [role.id, role]));
    const page = await fetchGuildMemberBatch(guildId, after, batchLimit);
    const members = Array.isArray(page) ? page : [];

    const now = new Date().toISOString();
    const normalizedMembers = members.map((member) => ({
      guild_id: guildId,
      ...normalizeMember(member, roleMap),
      in_guild: true,
      synced_at: now,
      updated_at: now,
    }));

    if (normalizedMembers.length) {
      const { error: memberError } = await supabase
        .from("guild_members")
        .upsert(normalizedMembers, { onConflict: "guild_id,user_id" });
      if (memberError) {
        return json({ ok: false, selectedGuildId: guildId, error: memberError.message }, 500, session);
      }
    }

    const nextAfter = members.length ? members[members.length - 1].user.id : null;
    const hasMore = members.length === batchLimit;

    await insertRoleSyncActivity(supabase, {
      guildId,
      actorId,
      actorName,
      memberCount: normalizedMembers.length,
      nextAfter: hasMore ? nextAfter : null,
      hasMore,
    });

    return json(
      {
        ok: true,
        selectedGuildId: guildId,
        syncedMembers: normalizedMembers.length,
        next_after: hasMore ? nextAfter : null,
        has_more: hasMore,
      },
      200,
      session
    );
  } catch (error) {
    return dashboardAuthErrorJson(error, session, 500);
  }
}

import { NextRequest } from "next/server";
import { queueSyncRoleMembers } from "@/lib/botCommands";
import { requireDashboardStaffSession, dashboardAuthJson, dashboardAuthErrorJson, type DashboardAuthSession } from "@/lib/dashboard-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function clean(value: unknown): string {
  return String(value || "").trim();
}

function getActorId(session: DashboardAuthSession | null): string | null {
  return clean(session?.user?.discord_id || session?.user?.id || session?.discordUser?.id) || null;
}

function json(payload: Record<string, unknown>, status = 200, session: DashboardAuthSession | null = null) {
  return dashboardAuthJson(payload, status, session);
}

export async function POST(req: NextRequest) {
  let session: DashboardAuthSession | null = null;

  try {
    session = await requireDashboardStaffSession();
    const actorId = getActorId(session);
    const guildId = clean(session.selectedGuildId);

    if (!guildId) {
      return json(
        {
          ok: false,
          error: "Select a server before syncing role members.",
          error_code: "selected_server_required",
          needsServerSelection: true,
        },
        428,
        session
      );
    }

    if (!actorId) {
      return json(
        {
          ok: false,
          error: "Could not identify signed-in staff member.",
          error_code: "invalid_request",
          selectedGuildId: guildId,
        },
        400,
        session
      );
    }

    const body = await req.json().catch(() => ({}));
    const roleId = clean(body?.roleId) || clean(body?.role_id);

    if (!roleId) {
      return json(
        {
          ok: false,
          error: "Missing roleId",
          error_code: "invalid_request",
          selectedGuildId: guildId,
        },
        400,
        session
      );
    }

    const command = await queueSyncRoleMembers({ roleId, requestedBy: actorId });

    return json(
      {
        ok: true,
        queued: true,
        selectedGuildId: guildId,
        command,
      },
      200,
      session
    );
  } catch (error) {
    return dashboardAuthErrorJson(error, session, 500);
  }
}

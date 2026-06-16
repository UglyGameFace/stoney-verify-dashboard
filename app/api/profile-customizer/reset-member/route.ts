import {
  dashboardAuthErrorJson,
  dashboardAuthJson,
  requireDashboardStaffSession,
  type DashboardAuthSession,
} from "@/lib/dashboard-auth";
import { queueResetMemberProfileRoles } from "@/lib/botCommands";
import { normalizeProfilePanelKey } from "@/lib/profileCustomizer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function clean(value: unknown): string {
  return String(value || "").trim();
}

function actorId(session: DashboardAuthSession | null): string | null {
  return clean(session?.user?.discord_id || session?.discordUser?.id || session?.user?.id || null) || null;
}

export async function POST(request: Request) {
  let session: DashboardAuthSession | null = null;
  try {
    session = await requireDashboardStaffSession();
    const guildId = clean(session.selectedGuildId);
    const body = await request.json().catch(() => ({}));
    const userId = clean((body as { userId?: unknown; user_id?: unknown }).userId || (body as { user_id?: unknown }).user_id);
    const panelKey = normalizeProfilePanelKey((body as { panelKey?: unknown; panel_key?: unknown }).panelKey || (body as { panel_key?: unknown }).panel_key);

    if (!guildId) {
      return dashboardAuthJson(
        {
          ok: false,
          error: "Select a server before resetting Profile Customizer roles.",
          error_code: "selected_server_required",
          needsServerSelection: true,
        },
        428,
        session
      );
    }

    if (!userId) {
      return dashboardAuthJson(
        {
          ok: false,
          error: "Choose a member before resetting profile roles.",
          error_code: "invalid_request",
        },
        400,
        session
      );
    }

    const command = await queueResetMemberProfileRoles({
      guildId,
      userId,
      panelKey,
      requestedBy: actorId(session),
    });

    return dashboardAuthJson(
      {
        ok: true,
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

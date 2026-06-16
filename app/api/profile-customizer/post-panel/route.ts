import {
  dashboardAuthErrorJson,
  dashboardAuthJson,
  requireDashboardStaffSession,
  type DashboardAuthSession,
} from "@/lib/dashboard-auth";
import { queuePostProfileCustomizerPanel } from "@/lib/botCommands";
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
    const channelId = clean((body as { channelId?: unknown; channel_id?: unknown }).channelId || (body as { channel_id?: unknown }).channel_id);
    const requestedPanelKey = normalizeProfilePanelKey((body as { panelKey?: unknown; panel_key?: unknown }).panelKey || (body as { panel_key?: unknown }).panel_key);

    if (!guildId) {
      return dashboardAuthJson(
        {
          ok: false,
          error: "Select a server before posting Profile Customizer.",
          error_code: "selected_server_required",
          needsServerSelection: true,
        },
        428,
        session
      );
    }

    if (!channelId) {
      return dashboardAuthJson(
        {
          ok: false,
          error: "Choose a channel for the Profile Customizer panel.",
          error_code: "invalid_request",
        },
        400,
        session
      );
    }

    const command = await queuePostProfileCustomizerPanel({
      guildId,
      channelId,
      panelKey: requestedPanelKey || "profile_customizer",
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

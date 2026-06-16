import {
  dashboardAuthErrorJson,
  dashboardAuthJson,
  requireDashboardStaffSession,
  type DashboardAuthSession,
} from "@/lib/dashboard-auth";
import { queueSyncProfileRoles } from "@/lib/botCommands";
import {
  profileCustomizerBotCommandsEnabled,
  profileCustomizerBotCommandsUnavailablePayload,
} from "@/lib/profileCustomizerCapability";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function clean(value: unknown): string {
  return String(value || "").trim();
}

function actorId(session: DashboardAuthSession | null): string | null {
  return clean(session?.user?.discord_id || session?.discordUser?.id || session?.user?.id || null) || null;
}

function bool(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (value === undefined || value === null) return fallback;
  const text = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(text)) return true;
  if (["0", "false", "no", "n", "off"].includes(text)) return false;
  return fallback;
}

export async function POST(request: Request) {
  let session: DashboardAuthSession | null = null;
  try {
    session = await requireDashboardStaffSession();
    const guildId = clean(session.selectedGuildId);
    const body = await request.json().catch(() => ({}));

    if (!guildId) {
      return dashboardAuthJson(
        {
          ok: false,
          error: "Select a server before syncing Profile Customizer roles.",
          error_code: "selected_server_required",
          needsServerSelection: true,
        },
        428,
        session
      );
    }

    if (!profileCustomizerBotCommandsEnabled()) {
      return dashboardAuthJson(
        profileCustomizerBotCommandsUnavailablePayload(),
        409,
        session
      );
    }

    const command = await queueSyncProfileRoles({
      guildId,
      requestedBy: actorId(session),
      dryRun: bool((body as { dryRun?: unknown; dry_run?: unknown }).dryRun || (body as { dry_run?: unknown }).dry_run, false),
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

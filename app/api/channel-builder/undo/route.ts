import { callBotApi, botApiConfigured } from "@/lib/bot-api";
import { requireDashboardStaffSession, dashboardAuthJson, dashboardAuthErrorJson } from "@/lib/dashboard-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function clean(value: unknown): string {
  return String(value || "").trim();
}

export async function POST(request: Request) {
  let session = null;
  try {
    session = await requireDashboardStaffSession();
    const body = await request.json().catch(() => ({}));
    const selectedGuildId = clean(session.selectedGuildId);
    const guildId = clean(body?.guildId);
    const sourceJobId = clean(body?.sourceJobId || body?.source_job_id || body?.jobId || body?.job_id);

    if (!selectedGuildId) {
      return dashboardAuthJson({ ok: false, error: "Select a server before undoing Channel Builder.", error_code: "selected_server_required", needsServerSelection: true }, 428, session);
    }
    if (!guildId || guildId !== selectedGuildId) {
      return dashboardAuthJson({ ok: false, error: "Undo must run inside the currently selected server context.", error_code: "selected_server_mismatch" }, 403, session);
    }
    if (!sourceJobId) {
      return dashboardAuthJson({ ok: false, error: "sourceJobId is required.", error_code: "source_job_id_required" }, 400, session);
    }
    if (!botApiConfigured()) {
      return dashboardAuthJson({ ok: false, error: "Bot API URL is not configured.", error_code: "bot_api_not_configured" }, 503, session);
    }

    const botResponse = await callBotApi("/channel-builder/rollback", {
      guild_id: guildId,
      actor_id: session.user.discord_id,
      source_job_id: sourceJobId,
    });

    return dashboardAuthJson({ ok: true, selectedGuildId, queued: Boolean(botResponse.queued), job: botResponse.job, sourceJobId }, 200, session);
  } catch (error) {
    return dashboardAuthErrorJson(error, session, 500);
  }
}

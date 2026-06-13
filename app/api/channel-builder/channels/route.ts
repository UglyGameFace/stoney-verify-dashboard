import { callBotApi } from "@/lib/bot-api";
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
    const selectedGuildId = clean(session.selectedGuildId);
    const body = await request.json().catch(() => ({}));
    const guildId = clean(body?.guildId);

    if (!selectedGuildId) {
      return dashboardAuthJson({ ok: false, error: "Select a server before scanning channels.", error_code: "selected_server_required", needsServerSelection: true }, 428, session);
    }

    if (!guildId || guildId !== selectedGuildId) {
      return dashboardAuthJson({ ok: false, error: "Channel scan must run inside the currently selected server context.", error_code: "selected_server_mismatch" }, 403, session);
    }

    const botResponse = await callBotApi("/channel-builder/channels", { guild_id: guildId });
    return dashboardAuthJson({
      ok: true,
      selectedGuildId,
      channels: Array.isArray(botResponse.channels) ? botResponse.channels : [],
      total: Number(botResponse.total || 0),
      generated_at: new Date().toISOString(),
    }, 200, session);
  } catch (error) {
    return dashboardAuthErrorJson(error, session, 500);
  }
}

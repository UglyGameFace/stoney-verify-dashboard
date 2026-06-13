import { buildChannelBuilderDryRun, type ChannelStyleOptions } from "@/lib/channel-style";
import { callBotApi, botApiConfigured } from "@/lib/bot-api";
import { requireDashboardStaffSession, dashboardAuthJson, dashboardAuthErrorJson } from "@/lib/dashboard-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type QueueRow = {
  id?: string;
  name?: string;
  baseName?: string;
  currentName?: string;
  currentChannelId?: string;
  channelId?: string;
  type?: string;
  category?: string;
  selected?: boolean;
  protected?: boolean;
};

function clean(value: unknown): string {
  return String(value || "").trim();
}

function rows(value: unknown): QueueRow[] {
  return (Array.isArray(value) ? value : [])
    .slice(0, 150)
    .map((row, index) => {
      const item = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
      return {
        id: clean(item.id) || `row-${index + 1}`,
        name: clean(item.name || item.baseName || item.base_name),
        currentName: clean(item.currentName || item.current_name) || undefined,
        currentChannelId: clean(item.currentChannelId || item.current_channel_id || item.channelId || item.channel_id) || undefined,
        channelId: clean(item.channelId || item.channel_id || item.currentChannelId || item.current_channel_id) || undefined,
        type: clean(item.type) || "text",
        category: clean(item.category) || undefined,
        selected: item.selected !== false,
        protected: Boolean(item.protected),
      };
    })
    .filter((row) => row.name || row.currentName || row.currentChannelId);
}

function options(value: unknown): ChannelStyleOptions {
  const input = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    emoji: input.emoji === null ? null : clean(input.emoji) || undefined,
    autoEmoji: Boolean(input.autoEmoji),
    emojiPosition: clean(input.emojiPosition) as ChannelStyleOptions["emojiPosition"],
    unicodeStyle: clean(input.unicodeStyle) as ChannelStyleOptions["unicodeStyle"],
    separator: clean(input.separator) || undefined,
    bracket: clean(input.bracket) as ChannelStyleOptions["bracket"],
    caseMode: clean(input.caseMode) as ChannelStyleOptions["caseMode"],
    safetyLevel: clean(input.safetyLevel) as ChannelStyleOptions["safetyLevel"],
    allowUnicodeEverywhere: Boolean(input.allowUnicodeEverywhere),
  };
}

export async function POST(request: Request) {
  let session = null;
  try {
    session = await requireDashboardStaffSession();
    const selectedGuildId = clean(session.selectedGuildId);
    const body = await request.json().catch(() => ({}));
    const guildId = clean(body?.guildId);

    if (!selectedGuildId) {
      return dashboardAuthJson({ ok: false, error: "Select a server before using Channel Builder.", error_code: "selected_server_required", needsServerSelection: true }, 428, session);
    }
    if (!guildId || guildId !== selectedGuildId) {
      return dashboardAuthJson({ ok: false, error: "Channel Builder must run inside the currently selected server context.", error_code: "selected_server_mismatch" }, 403, session);
    }
    if (!botApiConfigured()) {
      return dashboardAuthJson({ ok: false, error: "Bot API URL is not configured for queueing.", error_code: "bot_api_not_configured" }, 503, session);
    }

    const inputRows = rows(body?.items);
    const styleOptions = options(body?.options);
    const dryRun = buildChannelBuilderDryRun(inputRows as never, styleOptions);
    if (!dryRun.ok) {
      return dashboardAuthJson({ ok: false, error: "Fix dry-run danger warnings before queueing.", error_code: "dry_run_has_dangers", dryRun }, 409, session);
    }

    const byId = new Map(inputRows.map((row) => [row.id, row]));
    const queueRows = dryRun.items
      .filter((row) => row.selected !== false && ["create", "rename", "keep"].includes(row.action))
      .map((row) => {
        const original = byId.get(row.id);
        return {
          id: row.id,
          action: row.action,
          type: row.type || "text",
          baseName: row.baseName,
          finalName: row.finalName,
          currentName: row.currentName || original?.currentName,
          channelId: original?.channelId || original?.currentChannelId,
          currentChannelId: original?.currentChannelId || original?.channelId,
          category: row.category || original?.category,
          protected: Boolean(row.protected || original?.protected),
          selected: row.selected !== false,
        };
      });

    if (!queueRows.length) {
      return dashboardAuthJson({ ok: false, error: "There are no queueable rows.", error_code: "empty_channel_builder_plan", dryRun }, 400, session);
    }

    const botPreflight = await callBotApi("/channel-builder/preflight", {
      guild_id: guildId,
      actor_id: session.user.discord_id,
      items: queueRows,
      dry_run_summary: dryRun.summary,
    });

    if (!botPreflight.queueable) {
      return dashboardAuthJson({
        ok: false,
        error: "Bot preflight failed. Fix the listed live Discord issues before queueing.",
        error_code: "bot_preflight_failed",
        dryRun,
        preflight: botPreflight.preflight || null,
        validation_errors: Array.isArray(botPreflight.validation_errors) ? botPreflight.validation_errors : [],
      }, 409, session);
    }

    const botResponse = await callBotApi("/channel-builder/jobs", {
      guild_id: guildId,
      actor_id: session.user.discord_id,
      mode: clean(body?.mode) || "apply_plan",
      dry_run: Boolean(body?.dryRunOnly),
      items: queueRows,
      dry_run_summary: dryRun.summary,
      preflight: botPreflight.preflight || null,
    });

    return dashboardAuthJson({ ok: true, selectedGuildId, queued: Boolean(botResponse.queued), job: botResponse.job, dryRun, preflight: botResponse.preflight || botPreflight.preflight || null }, 200, session);
  } catch (error) {
    return dashboardAuthErrorJson(error, session, 500);
  }
}

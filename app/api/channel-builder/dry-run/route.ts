import { buildChannelBuilderDryRun, type ChannelBuilderInputItem, type ChannelStyleOptions } from "@/lib/channel-style";
import { requireDashboardStaffSession, dashboardAuthJson, dashboardAuthErrorJson } from "@/lib/dashboard-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function clean(value: unknown): string {
  return String(value || "").trim();
}

function safeArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function normalizeItems(value: unknown): ChannelBuilderInputItem[] {
  return safeArray(value).slice(0, 150).map((row, index) => {
    const item = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
    return {
      id: clean(item.id) || `row-${index + 1}`,
      name: clean(item.name),
      currentName: clean(item.currentName) || undefined,
      type: clean(item.type) as ChannelBuilderInputItem["type"],
      category: clean(item.category) || undefined,
      selected: item.selected !== false,
      protected: Boolean(item.protected),
    };
  }).filter((item) => item.name || item.currentName);
}

function normalizeOptions(value: unknown): ChannelStyleOptions {
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

    const items = normalizeItems(body?.items);
    const options = normalizeOptions(body?.options);
    const dryRun = buildChannelBuilderDryRun(items, options);

    return dashboardAuthJson({
      ok: true,
      selectedGuildId,
      dryRun,
      generated_at: new Date().toISOString(),
    }, 200, session);
  } catch (error) {
    return dashboardAuthErrorJson(error, session, 500);
  }
}

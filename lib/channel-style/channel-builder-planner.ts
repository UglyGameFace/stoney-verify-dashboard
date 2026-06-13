import { buildStyleWarnings, canonicalPlainName, type StyleWarning } from "./accessibility-warnings";
import { formatChannelName, type ChannelStyleOptions } from "./format-channel-name";

export type ChannelBuilderChannelType = "text" | "voice" | "forum" | "announcement" | "category";
export type ChannelBuilderAction = "create" | "rename" | "keep" | "skip" | "conflict";

export type ChannelBuilderTemplateBlockId =
  | "community_core"
  | "support_core"
  | "gaming_core"
  | "creator_core"
  | "marketplace_core"
  | "safety_staff"
  | "minimal_clean";

export type ChannelBuilderTemplateItem = {
  name: string;
  type: ChannelBuilderChannelType;
  category?: string;
  reason?: string;
  protected?: boolean;
};

export type ChannelBuilderTemplateBlock = {
  id: ChannelBuilderTemplateBlockId;
  label: string;
  description: string;
  items: ChannelBuilderTemplateItem[];
};

export type ChannelBuilderInputItem = {
  id?: string;
  name: string;
  currentName?: string;
  type?: ChannelBuilderChannelType;
  category?: string;
  selected?: boolean;
  protected?: boolean;
};

export type ChannelBuilderDryRunItem = ChannelBuilderInputItem & {
  index: number;
  action: ChannelBuilderAction;
  baseName: string;
  canonicalName: string;
  finalName: string;
  warnings: StyleWarning[];
  reason: string;
};

export type ChannelBuilderDryRunSummary = {
  total: number;
  selected: number;
  create: number;
  rename: number;
  keep: number;
  skip: number;
  conflict: number;
  warnings: number;
  dangers: number;
};

export type ChannelBuilderDryRunResult = {
  ok: boolean;
  generatedAt: string;
  items: ChannelBuilderDryRunItem[];
  summary: ChannelBuilderDryRunSummary;
  warnings: StyleWarning[];
};

export const CHANNEL_TEMPLATE_BLOCKS: ChannelBuilderTemplateBlock[] = [
  {
    id: "community_core",
    label: "Community Core",
    description: "Readable starter channels for most public communities.",
    items: [
      { name: "rules", type: "text", category: "Info", protected: true },
      { name: "announcements", type: "announcement", category: "Info", protected: true },
      { name: "welcome", type: "text", category: "Info" },
      { name: "general", type: "text", category: "Community" },
      { name: "introductions", type: "text", category: "Community" },
      { name: "memes", type: "text", category: "Community" },
    ],
  },
  {
    id: "support_core",
    label: "Support Core",
    description: "Ticket/help channels without locking the server into one niche.",
    items: [
      { name: "support", type: "text", category: "Support", protected: true },
      { name: "open-a-ticket", type: "text", category: "Support", protected: true },
      { name: "faq", type: "text", category: "Support", protected: true },
      { name: "appeals", type: "text", category: "Support", protected: true },
    ],
  },
  {
    id: "gaming_core",
    label: "Gaming Core",
    description: "Generic gaming channels that can be picked one-by-one.",
    items: [
      { name: "gaming-chat", type: "text", category: "Gaming" },
      { name: "gaming-clips", type: "text", category: "Gaming" },
      { name: "squad-up", type: "voice", category: "Gaming" },
      { name: "wins-and-highlights", type: "text", category: "Gaming" },
    ],
  },
  {
    id: "creator_core",
    label: "Creator Core",
    description: "Media and creator-friendly channels.",
    items: [
      { name: "clips", type: "text", category: "Creator" },
      { name: "photos", type: "text", category: "Creator" },
      { name: "music", type: "text", category: "Creator" },
      { name: "self-promo", type: "text", category: "Creator" },
    ],
  },
  {
    id: "marketplace_core",
    label: "Marketplace Core",
    description: "Optional shop/deals/listing channels.",
    items: [
      { name: "marketplace", type: "text", category: "Marketplace", protected: true },
      { name: "deals", type: "text", category: "Marketplace" },
      { name: "buy-sell-trade", type: "text", category: "Marketplace" },
      { name: "vouches", type: "text", category: "Marketplace", protected: true },
    ],
  },
  {
    id: "safety_staff",
    label: "Safety + Staff",
    description: "Important staff/log channels. Keep these readable by default.",
    items: [
      { name: "staff-chat", type: "text", category: "Staff", protected: true },
      { name: "mod-log", type: "text", category: "Staff", protected: true },
      { name: "audit-log", type: "text", category: "Staff", protected: true },
      { name: "reports", type: "text", category: "Staff", protected: true },
    ],
  },
  {
    id: "minimal_clean",
    label: "Minimal Clean",
    description: "Tiny setup for servers that only want the essentials.",
    items: [
      { name: "rules", type: "text", category: "Info", protected: true },
      { name: "announcements", type: "announcement", category: "Info", protected: true },
      { name: "general", type: "text", category: "Community" },
      { name: "support", type: "text", category: "Support", protected: true },
    ],
  },
];

function normalizeInput(items: ChannelBuilderInputItem[]): ChannelBuilderInputItem[] {
  return items.map((item, index) => ({
    id: item.id || `row-${index + 1}`,
    name: String(item.name || "").trim(),
    currentName: String(item.currentName || "").trim() || undefined,
    type: item.type || "text",
    category: String(item.category || "").trim() || undefined,
    selected: item.selected !== false,
    protected: Boolean(item.protected),
  }));
}

function actionFor(item: ChannelBuilderInputItem, finalName: string): ChannelBuilderAction {
  if (item.selected === false) return "skip";
  if (!canonicalPlainName(finalName)) return "conflict";
  if (!item.currentName) return "create";
  if (canonicalPlainName(item.currentName) === canonicalPlainName(finalName)) return "keep";
  return "rename";
}

function buildDuplicateWarnings(rows: ChannelBuilderDryRunItem[]): StyleWarning[] {
  const grouped = new Map<string, ChannelBuilderDryRunItem[]>();
  rows
    .filter((row) => row.selected !== false && row.action !== "skip")
    .forEach((row) => {
      const key = row.finalName.toLowerCase();
      grouped.set(key, [...(grouped.get(key) || []), row]);
    });

  const warnings: StyleWarning[] = [];
  grouped.forEach((dupes, finalName) => {
    if (dupes.length <= 1) return;
    warnings.push({
      code: "duplicate_target_name",
      severity: "danger",
      message: `Multiple selected rows would become #${finalName}. Deselect or rename one before continuing.`,
    });
    dupes.forEach((row) => {
      row.action = "conflict";
      row.warnings.push({
        code: "duplicate_target_name",
        severity: "danger",
        message: `This row conflicts with another selected row targeting #${finalName}.`,
      });
    });
  });
  return warnings;
}

export function buildChannelBuilderDryRun(items: ChannelBuilderInputItem[], options: ChannelStyleOptions = {}): ChannelBuilderDryRunResult {
  const rows = normalizeInput(items).map((item, index) => {
    const formatted = formatChannelName(item.name, options);
    const action = actionFor(item, formatted.finalName);
    const warnings = [...formatted.warnings];

    if (item.protected && action === "rename") {
      warnings.push({
        code: "protected_channel_rename",
        severity: "warning",
        message: "This row is marked protected. Renaming should require explicit owner confirmation in the final queued job.",
      });
    }

    const extraWarnings = buildStyleWarnings({
      baseName: item.name,
      finalName: formatted.finalName,
      unicodeStyle: formatted.unicodeStyle,
      safetyLevel: options.safetyLevel || "recommended_readability",
      allowUnicodeEverywhere: Boolean(options.allowUnicodeEverywhere),
      unsupportedCharacters: formatted.unsupportedCharacters,
      emoji: formatted.emoji,
      isCriticalOverride: item.protected,
    });

    return {
      ...item,
      index,
      action,
      baseName: formatted.baseName,
      canonicalName: formatted.canonicalName,
      finalName: formatted.finalName,
      warnings: [...warnings, ...extraWarnings],
      reason: action === "create" ? "New channel" : action === "rename" ? "Existing channel would be restyled" : action === "keep" ? "Already matches preview" : action === "skip" ? "Deselected" : "Needs attention",
    } satisfies ChannelBuilderDryRunItem;
  });

  const warnings = buildDuplicateWarnings(rows);
  const allWarnings = [...warnings, ...rows.flatMap((row) => row.warnings)];

  const summary: ChannelBuilderDryRunSummary = {
    total: rows.length,
    selected: rows.filter((row) => row.selected !== false).length,
    create: rows.filter((row) => row.action === "create").length,
    rename: rows.filter((row) => row.action === "rename").length,
    keep: rows.filter((row) => row.action === "keep").length,
    skip: rows.filter((row) => row.action === "skip").length,
    conflict: rows.filter((row) => row.action === "conflict").length,
    warnings: allWarnings.filter((warning) => warning.severity === "warning").length,
    dangers: allWarnings.filter((warning) => warning.severity === "danger").length,
  };

  return {
    ok: summary.dangers === 0,
    generatedAt: new Date().toISOString(),
    items: rows,
    summary,
    warnings,
  };
}

export function templateBlocksToItems(blockIds: ChannelBuilderTemplateBlockId[]): ChannelBuilderInputItem[] {
  const selected = new Set(blockIds);
  const items: ChannelBuilderInputItem[] = [];
  CHANNEL_TEMPLATE_BLOCKS.forEach((block) => {
    if (!selected.has(block.id)) return;
    block.items.forEach((item) => {
      items.push({
        id: `${block.id}:${item.name}`,
        name: item.name,
        type: item.type,
        category: item.category,
        selected: true,
        protected: Boolean(item.protected),
      });
    });
  });
  return items;
}

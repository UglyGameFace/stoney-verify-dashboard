import { buildStyleWarnings, canonicalPlainName, stripUnsafeInvisibleCharacters, StyleWarning } from "./accessibility-warnings";
import { suggestEmojiForName } from "./emoji-presets";
import { transformUnicodeStyle, UnicodeSafetyLevel, UnicodeStyleId } from "./unicode-styles";

export type EmojiPosition = "first" | "last" | "bracket" | "none";
export type ChannelCaseMode = "lower" | "title" | "preserve" | "compact";
export type ChannelSeparator = "-" | "・" | "┃" | "︱" | "｜" | "»" | "›" | "•" | "none";
export type ChannelBracket = "「」" | "【】" | "〔〕" | "[]" | "()";

export type ChannelStyleOptions = {
  emoji?: string | null;
  autoEmoji?: boolean;
  emojiPosition?: EmojiPosition;
  unicodeStyle?: UnicodeStyleId;
  separator?: ChannelSeparator | string;
  bracket?: ChannelBracket;
  caseMode?: ChannelCaseMode;
  safetyLevel?: UnicodeSafetyLevel;
  allowUnicodeEverywhere?: boolean;
  maxLength?: number;
};

export type FormattedChannelName = {
  baseName: string;
  canonicalName: string;
  styledCore: string;
  finalName: string;
  emoji: string | null;
  separator: string;
  unicodeStyle: UnicodeStyleId;
  warnings: StyleWarning[];
  unsupportedCharacters: string[];
  truncated: boolean;
};

const DEFAULT_OPTIONS: Required<Omit<ChannelStyleOptions, "emoji">> & { emoji: string | null } = {
  emoji: null,
  autoEmoji: false,
  emojiPosition: "first",
  unicodeStyle: "normal",
  separator: "・",
  bracket: "「」",
  caseMode: "lower",
  safetyLevel: "recommended_readability",
  allowUnicodeEverywhere: false,
  maxLength: 100,
};

const DISCORD_CHANNEL_MAX_LENGTH = 100;

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

export function normalizeBaseChannelName(value: string, caseMode: ChannelCaseMode = "lower"): string {
  const cleaned = stripUnsafeInvisibleCharacters(String(value || ""))
    .normalize("NFKC")
    .replace(/[’'`]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  if (caseMode === "preserve") return cleaned;
  if (caseMode === "title") return titleCase(cleaned.replace(/-/g, "-")).replace(/\s+/g, "-");
  if (caseMode === "compact") return cleaned.replace(/-/g, "").toLowerCase();
  return cleaned.toLowerCase();
}

function normalizeSeparator(value: ChannelSeparator | string | undefined): string {
  if (!value || value === "none") return "";
  return String(value).slice(0, 4);
}

function bracketEmoji(emoji: string, bracket: ChannelBracket): string {
  const pairs: Record<ChannelBracket, [string, string]> = {
    "「」": ["「", "」"],
    "【】": ["【", "】"],
    "〔〕": ["〔", "〕"],
    "[]": ["[", "]"],
    "()": ["(", ")"],
  };
  const [left, right] = pairs[bracket] ?? pairs["「」"];
  return `${left}${emoji}${right}`;
}

function joinName(core: string, emoji: string | null, options: Required<Omit<ChannelStyleOptions, "emoji">> & { emoji: string | null }): string {
  const sep = normalizeSeparator(options.separator);
  if (!emoji || options.emojiPosition === "none") return core;
  if (options.emojiPosition === "last") return sep ? `${core}${sep}${emoji}` : `${core}${emoji}`;
  if (options.emojiPosition === "bracket") return sep ? `${bracketEmoji(emoji, options.bracket)}${sep}${core}` : `${bracketEmoji(emoji, options.bracket)}${core}`;
  return sep ? `${emoji}${sep}${core}` : `${emoji}${core}`;
}

function truncateFinalName(value: string, maxLength: number): { value: string; truncated: boolean } {
  const safeMax = Math.max(1, Math.min(DISCORD_CHANNEL_MAX_LENGTH, Math.floor(maxLength || DISCORD_CHANNEL_MAX_LENGTH)));
  const chars = [...value];
  if (chars.length <= safeMax) return { value, truncated: false };
  return { value: chars.slice(0, safeMax).join("").replace(/[-・┃︱｜»›•]+$/g, ""), truncated: true };
}

export function formatChannelName(input: string, rawOptions: ChannelStyleOptions = {}): FormattedChannelName {
  const options = { ...DEFAULT_OPTIONS, ...rawOptions };
  const baseName = normalizeBaseChannelName(input, options.caseMode);
  const suggestion = options.autoEmoji ? suggestEmojiForName(baseName) : null;
  const emoji = options.emoji ?? suggestion?.emoji ?? null;
  const transformed = transformUnicodeStyle(baseName, options.unicodeStyle);
  const joined = joinName(transformed.value, emoji, options);
  const cleanJoined = stripUnsafeInvisibleCharacters(joined);
  const truncated = truncateFinalName(cleanJoined, options.maxLength);
  const warnings = buildStyleWarnings({
    baseName,
    finalName: truncated.value,
    unicodeStyle: transformed.style.id,
    safetyLevel: options.safetyLevel,
    allowUnicodeEverywhere: options.allowUnicodeEverywhere,
    unsupportedCharacters: transformed.unsupportedCharacters,
    emoji,
  });

  if (truncated.truncated) {
    warnings.push({
      code: "discord_name_truncated",
      severity: "warning",
      message: "Discord channel names are limited to 100 characters. The preview was trimmed before create/update.",
    });
  }

  return {
    baseName,
    canonicalName: canonicalPlainName(baseName),
    styledCore: transformed.value,
    finalName: truncated.value,
    emoji,
    separator: normalizeSeparator(options.separator),
    unicodeStyle: transformed.style.id,
    warnings,
    unsupportedCharacters: transformed.unsupportedCharacters,
    truncated: truncated.truncated,
  };
}

export type ChannelDryRunItem = {
  id?: string;
  currentName?: string;
  baseName: string;
  finalName: string;
  canonicalName: string;
  warnings: StyleWarning[];
};

export type ChannelDryRunResult = {
  items: ChannelDryRunItem[];
  duplicates: Array<{ finalName: string; itemIndexes: number[] }>;
  warnings: StyleWarning[];
};

export function dryRunChannelNames(names: Array<string | { id?: string; currentName?: string; name: string }>, options: ChannelStyleOptions = {}): ChannelDryRunResult {
  const items = names.map((entry) => {
    const name = typeof entry === "string" ? entry : entry.name;
    const formatted = formatChannelName(name, options);
    return {
      id: typeof entry === "string" ? undefined : entry.id,
      currentName: typeof entry === "string" ? undefined : entry.currentName,
      baseName: formatted.baseName,
      finalName: formatted.finalName,
      canonicalName: formatted.canonicalName,
      warnings: formatted.warnings,
    };
  });

  const byFinal = new Map<string, number[]>();
  items.forEach((item, index) => {
    const key = item.finalName.toLowerCase();
    byFinal.set(key, [...(byFinal.get(key) || []), index]);
  });

  const duplicates = [...byFinal.entries()]
    .filter(([, indexes]) => indexes.length > 1)
    .map(([finalName, itemIndexes]) => ({ finalName, itemIndexes }));

  const warnings: StyleWarning[] = duplicates.map((duplicate) => ({
    code: "duplicate_target_name",
    severity: "danger",
    message: `Multiple selected channels would become #${duplicate.finalName}. Rename or deselect one before continuing.`,
  }));

  return { items, duplicates, warnings };
}

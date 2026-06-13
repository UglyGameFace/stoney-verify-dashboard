import { getUnicodeStyle, UnicodeSafetyLevel, UnicodeStyleId } from "./unicode-styles";

export type StyleWarningSeverity = "info" | "warning" | "danger";

export type StyleWarning = {
  code: string;
  severity: StyleWarningSeverity;
  message: string;
};

export const CRITICAL_CHANNEL_PATTERNS = [
  "rules",
  "rule",
  "verify",
  "verification",
  "ticket",
  "tickets",
  "support",
  "announcement",
  "announcements",
  "welcome",
  "mod-log",
  "modlog",
  "audit-log",
  "auditlog",
  "staff",
  "appeals",
  "reports",
  "report",
  "security",
  "safety",
  "faq",
  "help",
];

const INVISIBLE_OR_ZERO_WIDTH = /[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g;

export function stripUnsafeInvisibleCharacters(value: string): string {
  return String(value || "").replace(INVISIBLE_OR_ZERO_WIDTH, "");
}

export function hasUnsafeInvisibleCharacters(value: string): boolean {
  return INVISIBLE_OR_ZERO_WIDTH.test(String(value || ""));
}

export function canonicalPlainName(value: string): string {
  return stripUnsafeInvisibleCharacters(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’'`]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .toLowerCase();
}

export function isCriticalChannelName(value: string): boolean {
  const plain = canonicalPlainName(value);
  if (!plain) return false;
  return CRITICAL_CHANNEL_PATTERNS.some((pattern) => {
    const normalized = canonicalPlainName(pattern);
    return plain === normalized || plain.startsWith(`${normalized}-`) || plain.endsWith(`-${normalized}`) || plain.includes(`-${normalized}-`);
  });
}

export type BuildStyleWarningsInput = {
  baseName: string;
  finalName: string;
  unicodeStyle: UnicodeStyleId;
  safetyLevel: UnicodeSafetyLevel;
  allowUnicodeEverywhere?: boolean;
  unsupportedCharacters?: string[];
  emoji?: string | null;
  isCriticalOverride?: boolean;
};

export function buildStyleWarnings(input: BuildStyleWarningsInput): StyleWarning[] {
  const warnings: StyleWarning[] = [];
  const style = getUnicodeStyle(input.unicodeStyle);
  const finalName = String(input.finalName || "");
  const baseName = String(input.baseName || "");
  const critical = Boolean(input.isCriticalOverride ?? isCriticalChannelName(baseName));
  const unsupported = Array.from(new Set(input.unsupportedCharacters || [])).filter(Boolean);

  if (hasUnsafeInvisibleCharacters(finalName)) {
    warnings.push({
      code: "unsafe_invisible_characters_removed",
      severity: "danger",
      message: "Invisible or zero-width Unicode was detected. Dank Shield removes these by default because they are hard to moderate and easy to abuse.",
    });
  }

  if (style.id !== "normal") {
    warnings.push({
      code: "unicode_not_real_font",
      severity: style.decorative ? "warning" : "info",
      message: "Fancy text here is Unicode lookalike characters, not a real Discord font. It may affect search, screen readers, moderation logs, and device rendering.",
    });
  }

  if (style.readability === "poor" || style.searchRisk === "high" || style.screenReaderRisk === "high") {
    warnings.push({
      code: "high_risk_unicode_style",
      severity: "danger",
      message: style.warning,
    });
  } else if (style.readability === "medium" || style.searchRisk === "medium" || style.screenReaderRisk === "medium") {
    warnings.push({
      code: "medium_risk_unicode_style",
      severity: "warning",
      message: style.warning,
    });
  }

  if (critical && !style.recommendedForCritical) {
    warnings.push({
      code: "critical_channel_readability",
      severity: "danger",
      message: "This looks like an important server channel. Rules, verify, tickets, support, announcements, staff, and log channels should stay readable unless the owner explicitly allows fancy Unicode everywhere.",
    });
  }

  if (input.safetyLevel === "recommended_readability" && style.decorative && !input.allowUnicodeEverywhere) {
    warnings.push({
      code: "blocked_by_recommended_readability",
      severity: "warning",
      message: "Recommended readability mode does not default to decorative Unicode. The owner can still continue by enabling decorative styles with warnings or Unicode everywhere.",
    });
  }

  if (unsupported.length) {
    warnings.push({
      code: "unicode_fallback_characters",
      severity: "info",
      message: `Some characters do not exist in this Unicode style and were left plain: ${unsupported.slice(0, 12).join(" ")}`,
    });
  }

  if (!canonicalPlainName(finalName)) {
    warnings.push({
      code: "empty_after_normalization",
      severity: "danger",
      message: "This name becomes empty after safe normalization. Add normal letters or numbers before creating/updating anything.",
    });
  }

  if (/^[^a-zA-Z0-9]+$/.test(stripUnsafeInvisibleCharacters(finalName))) {
    warnings.push({
      code: "emoji_or_symbol_only",
      severity: "warning",
      message: "Emoji-only or symbol-only names are hard to search and reference. Dank Shield should require explicit confirmation before using this.",
    });
  }

  return warnings;
}

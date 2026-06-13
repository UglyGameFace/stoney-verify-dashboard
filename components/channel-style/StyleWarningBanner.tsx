import type { StyleWarning, StyleWarningSeverity } from "@/lib/channel-style";

type StyleWarningBannerProps = {
  warnings?: StyleWarning[];
  className?: string;
  compact?: boolean;
  title?: string;
};

const severityOrder: Record<StyleWarningSeverity, number> = {
  danger: 0,
  warning: 1,
  info: 2,
};

const severityClass: Record<StyleWarningSeverity, string> = {
  danger: "border-red-500/40 bg-red-950/40 text-red-100",
  warning: "border-amber-500/40 bg-amber-950/40 text-amber-100",
  info: "border-sky-500/30 bg-sky-950/30 text-sky-100",
};

const severityDot: Record<StyleWarningSeverity, string> = {
  danger: "bg-red-400",
  warning: "bg-amber-300",
  info: "bg-sky-300",
};

function dedupeWarnings(warnings: StyleWarning[]): StyleWarning[] {
  const seen = new Set<string>();
  return warnings
    .filter(Boolean)
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
    .filter((warning) => {
      const key = `${warning.code}:${warning.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export default function StyleWarningBanner({
  warnings = [],
  className = "",
  compact = false,
  title = "Style warnings",
}: StyleWarningBannerProps) {
  const rows = dedupeWarnings(warnings);
  if (!rows.length) return null;

  const highest = rows[0]?.severity ?? "info";

  return (
    <section
      className={`rounded-2xl border p-3 ${severityClass[highest]} ${className}`}
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${severityDot[highest]}`}
        />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-white">{title}</div>
          {!compact && (
            <p className="mt-1 text-xs leading-5 opacity-85">
              Fancy Unicode can be fun, but Dank Shield keeps the complications visible before anything touches Discord.
            </p>
          )}
          <ul className="mt-2 space-y-1.5 text-xs leading-5">
            {rows.map((warning) => (
              <li key={`${warning.code}:${warning.message}`} className="flex gap-2">
                <span className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-70" />
                <span>{warning.message}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

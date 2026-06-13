"use client";

import { useMemo } from "react";
import {
  formatChannelName,
  type ChannelStyleOptions,
  type FormattedChannelName,
} from "@/lib/channel-style";
import StyleWarningBanner from "./StyleWarningBanner";

type ChannelNamePreviewProps = {
  name: string;
  options?: ChannelStyleOptions;
  className?: string;
  title?: string;
  showDetails?: boolean;
};

function copyText(value: string) {
  try {
    void navigator.clipboard?.writeText(value);
  } catch {
    // Clipboard is best-effort only. The preview remains usable without it.
  }
}

function DetailRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="min-w-0 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 truncate text-sm text-zinc-100" title={String(value ?? "")}>
        {value || "—"}
      </div>
    </div>
  );
}

export default function ChannelNamePreview({
  name,
  options = {},
  className = "",
  title = "Preview",
  showDetails = true,
}: ChannelNamePreviewProps) {
  const formatted: FormattedChannelName = useMemo(() => formatChannelName(name, options), [name, options]);
  const dangerCount = formatted.warnings.filter((warning) => warning.severity === "danger").length;
  const warningCount = formatted.warnings.filter((warning) => warning.severity === "warning").length;

  return (
    <section className={`rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 ${className}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white">{title}</div>
          <p className="mt-1 text-xs leading-5 text-zinc-400">
            This is the exact name the dashboard will send to the bot after dry-run validation.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {dangerCount > 0 && (
            <span className="rounded-full border border-red-500/40 bg-red-950/40 px-2.5 py-1 text-[11px] font-semibold text-red-100">
              {dangerCount} danger
            </span>
          )}
          {warningCount > 0 && (
            <span className="rounded-full border border-amber-500/40 bg-amber-950/40 px-2.5 py-1 text-[11px] font-semibold text-amber-100">
              {warningCount} warning
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 to-zinc-950 p-4">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-200/80">Discord channel name</div>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <code className="block min-w-0 overflow-hidden text-ellipsis rounded-2xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-base font-semibold text-white sm:text-lg">
            #{formatted.finalName || "channel-name"}
          </code>
          <button
            type="button"
            onClick={() => copyText(formatted.finalName)}
            className="inline-flex min-h-[42px] shrink-0 items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:border-zinc-500"
          >
            Copy name
          </button>
        </div>
      </div>

      {showDetails && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <DetailRow label="Plain canonical" value={formatted.canonicalName} />
          <DetailRow label="Base name" value={formatted.baseName} />
          <DetailRow label="Unicode style" value={formatted.unicodeStyle} />
          <DetailRow label="Length" value={[...formatted.finalName].length} />
        </div>
      )}

      <StyleWarningBanner warnings={formatted.warnings} className="mt-3" />
    </section>
  );
}

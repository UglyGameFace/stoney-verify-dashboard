"use client";

import { useMemo } from "react";
import {
  getUnicodeStyle,
  isUnicodeStyleAllowed,
  UNICODE_STYLES,
  type UnicodeSafetyLevel,
  type UnicodeStyleId,
} from "@/lib/channel-style";

type UnicodeStylePickerProps = {
  value?: UnicodeStyleId;
  onChange?: (style: UnicodeStyleId) => void;
  safetyLevel?: UnicodeSafetyLevel;
  allowUnicodeEverywhere?: boolean;
  className?: string;
  label?: string;
  description?: string;
  disabled?: boolean;
  compact?: boolean;
};

function riskLabel(styleId: UnicodeStyleId) {
  const style = getUnicodeStyle(styleId);
  if (style.readability === "poor" || style.searchRisk === "high" || style.screenReaderRisk === "high") return "High warning";
  if (style.readability === "medium" || style.searchRisk === "medium" || style.screenReaderRisk === "medium") return "Medium warning";
  return "Readable";
}

function riskClass(styleId: UnicodeStyleId) {
  const style = getUnicodeStyle(styleId);
  if (style.readability === "poor" || style.searchRisk === "high" || style.screenReaderRisk === "high") {
    return "border-red-500/40 bg-red-950/20 text-red-100";
  }
  if (style.readability === "medium" || style.searchRisk === "medium" || style.screenReaderRisk === "medium") {
    return "border-amber-500/40 bg-amber-950/20 text-amber-100";
  }
  return "border-emerald-500/30 bg-emerald-950/20 text-emerald-100";
}

export default function UnicodeStylePicker({
  value = "normal",
  onChange,
  safetyLevel = "recommended_readability",
  allowUnicodeEverywhere = false,
  className = "",
  label = "Unicode style",
  description = "These are Unicode lookalike characters, not real Discord fonts.",
  disabled = false,
  compact = false,
}: UnicodeStylePickerProps) {
  const selected = getUnicodeStyle(value);
  const rows = useMemo(
    () =>
      UNICODE_STYLES.map((style) => ({
        style,
        allowed: allowUnicodeEverywhere || isUnicodeStyleAllowed(style.id, safetyLevel),
      })),
    [allowUnicodeEverywhere, safetyLevel],
  );

  return (
    <section className={`rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 ${className}`}>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <label className="text-sm font-semibold text-white">{label}</label>
          {!compact && <p className="mt-1 text-xs leading-5 text-zinc-400">{description}</p>}
        </div>
        <span className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-[11px] font-semibold ${riskClass(selected.id)}`}>
          {riskLabel(selected.id)}
        </span>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map(({ style, allowed }) => {
          const active = style.id === selected.id;
          return (
            <button
              key={style.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange?.(style.id)}
              className={`min-h-[78px] rounded-2xl border p-3 text-left transition ${
                active
                  ? "border-emerald-400 bg-emerald-950/40 shadow-[0_0_0_1px_rgba(52,211,153,0.35)]"
                  : "border-zinc-800 bg-zinc-900/70 hover:border-zinc-600"
              } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
              aria-pressed={active}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0 text-sm font-semibold text-white">{style.label}</span>
                {!allowed && (
                  <span className="shrink-0 rounded-full border border-amber-500/30 bg-amber-950/40 px-2 py-0.5 text-[10px] font-semibold text-amber-100">
                    Warn
                  </span>
                )}
              </div>
              <div className="mt-1 truncate text-base text-zinc-100" title={style.example}>
                {style.example}
              </div>
              {!compact && <div className="mt-1 text-[11px] text-zinc-500">{riskLabel(style.id)}</div>}
            </button>
          );
        })}
      </div>
    </section>
  );
}

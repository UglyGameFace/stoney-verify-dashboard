"use client";

import { useMemo, useState } from "react";
import {
  EMOJI_GROUP_LABELS,
  EMOJI_PRESETS,
  searchEmojiPresets,
  type EmojiGroupId,
} from "@/lib/channel-style";

type EmojiPickerButtonProps = {
  value?: string | null;
  onChange?: (emoji: string | null) => void;
  className?: string;
  label?: string;
  disabled?: boolean;
  allowClear?: boolean;
  compact?: boolean;
};

const GROUP_ORDER: EmojiGroupId[] = [
  "general",
  "safety",
  "support",
  "media",
  "gaming",
  "community",
  "marketplace",
  "roles",
  "seasonal",
];

function inputClass() {
  return "w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500";
}

export default function EmojiPickerButton({
  value = null,
  onChange,
  className = "",
  label = "Emoji",
  disabled = false,
  allowClear = true,
  compact = false,
}: EmojiPickerButtonProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeGroup, setActiveGroup] = useState<EmojiGroupId | "all">("all");

  const filtered = useMemo(() => {
    const base = query.trim() ? searchEmojiPresets(query, 80) : EMOJI_PRESETS;
    return activeGroup === "all" ? base : base.filter((preset) => preset.group === activeGroup);
  }, [activeGroup, query]);

  return (
    <section className={`rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 ${className}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <label className="text-sm font-semibold text-white">{label}</label>
          {!compact && (
            <p className="mt-1 text-xs leading-5 text-zinc-400">
              Pick a normal Unicode emoji so mobile users do not need copy/paste gymnastics.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => setOpen((v) => !v)}
            className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-950/30 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="text-lg" aria-hidden="true">{value || "✨"}</span>
            <span>{value ? "Change emoji" : "Choose emoji"}</span>
          </button>
          {allowClear && value && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange?.(null)}
              className="inline-flex min-h-[42px] items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="mt-4 space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3">
          <input
            className={inputClass()}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search emojis: rules, ticket, gaming, media..."
            disabled={disabled}
          />

          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setActiveGroup("all")}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                activeGroup === "all" ? "border-emerald-400 bg-emerald-950/50 text-emerald-100" : "border-zinc-700 bg-zinc-950 text-zinc-300"
              }`}
            >
              All
            </button>
            {GROUP_ORDER.map((group) => (
              <button
                key={group}
                type="button"
                onClick={() => setActiveGroup(group)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  activeGroup === group ? "border-emerald-400 bg-emerald-950/50 text-emerald-100" : "border-zinc-700 bg-zinc-950 text-zinc-300"
                }`}
              >
                {EMOJI_GROUP_LABELS[group]}
              </button>
            ))}
          </div>

          <div className="grid max-h-[320px] grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6 lg:grid-cols-8">
            {filtered.map((preset) => (
              <button
                key={`${preset.emoji}:${preset.label}`}
                type="button"
                disabled={disabled}
                onClick={() => {
                  onChange?.(preset.emoji);
                  setOpen(false);
                }}
                className={`min-h-[72px] rounded-2xl border p-2 text-center transition ${
                  value === preset.emoji
                    ? "border-emerald-400 bg-emerald-950/40"
                    : "border-zinc-800 bg-zinc-950 hover:border-zinc-600"
                } disabled:cursor-not-allowed disabled:opacity-50`}
                title={`${preset.label} — ${preset.keywords.join(", ")}`}
              >
                <div className="text-2xl leading-none">{preset.emoji}</div>
                <div className="mt-1 truncate text-[11px] font-semibold text-zinc-300">{preset.label}</div>
              </button>
            ))}
          </div>

          {!filtered.length && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">
              No emoji presets matched that search. You can still paste a normal Unicode emoji into the custom field later.
            </div>
          )}
        </div>
      )}
    </section>
  );
}

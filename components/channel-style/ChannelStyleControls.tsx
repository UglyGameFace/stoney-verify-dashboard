"use client";

import { useMemo, useState } from "react";
import {
  type ChannelBracket,
  type ChannelCaseMode,
  type ChannelSeparator,
  type ChannelStyleOptions,
  type EmojiPosition,
  type UnicodeSafetyLevel,
  type UnicodeStyleId,
} from "@/lib/channel-style";
import ChannelNamePreview from "./ChannelNamePreview";
import EmojiPickerButton from "./EmojiPickerButton";
import SeparatorPicker from "./SeparatorPicker";
import UnicodeStylePicker from "./UnicodeStylePicker";

type ChannelStyleControlsProps = {
  initialName?: string;
  initialOptions?: ChannelStyleOptions;
  onChange?: (payload: { name: string; options: ChannelStyleOptions }) => void;
  className?: string;
};

function inputClass() {
  return "w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500";
}

function toggleClass(active: boolean) {
  return `rounded-2xl border px-3 py-2 text-xs font-semibold transition ${
    active ? "border-emerald-400 bg-emerald-950/50 text-emerald-100" : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500"
  }`;
}

export default function ChannelStyleControls({
  initialName = "gaming-clips",
  initialOptions = {},
  onChange,
  className = "",
}: ChannelStyleControlsProps) {
  const [name, setName] = useState(initialName);
  const [emoji, setEmoji] = useState<string | null>(initialOptions.emoji ?? "🎮");
  const [autoEmoji, setAutoEmoji] = useState(Boolean(initialOptions.autoEmoji));
  const [unicodeStyle, setUnicodeStyle] = useState<UnicodeStyleId>(initialOptions.unicodeStyle ?? "normal");
  const [separator, setSeparator] = useState<ChannelSeparator | string>(initialOptions.separator ?? "・");
  const [emojiPosition, setEmojiPosition] = useState<EmojiPosition>(initialOptions.emojiPosition ?? "first");
  const [bracket, setBracket] = useState<ChannelBracket>(initialOptions.bracket ?? "「」");
  const [caseMode, setCaseMode] = useState<ChannelCaseMode>(initialOptions.caseMode ?? "lower");
  const [safetyLevel, setSafetyLevel] = useState<UnicodeSafetyLevel>(initialOptions.safetyLevel ?? "recommended_readability");
  const [allowUnicodeEverywhere, setAllowUnicodeEverywhere] = useState(Boolean(initialOptions.allowUnicodeEverywhere));

  const options = useMemo<ChannelStyleOptions>(() => ({
    emoji,
    autoEmoji,
    unicodeStyle,
    separator,
    emojiPosition,
    bracket,
    caseMode,
    safetyLevel,
    allowUnicodeEverywhere,
  }), [allowUnicodeEverywhere, autoEmoji, bracket, caseMode, emoji, emojiPosition, safetyLevel, separator, unicodeStyle]);

  function emit(nextName = name, nextOptions = options) {
    onChange?.({ name: nextName, options: nextOptions });
  }

  function updateName(value: string) {
    setName(value);
    emit(value, options);
  }

  return (
    <section className={`space-y-4 ${className}`}>
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 flex-1">
            <label className="text-sm font-semibold text-white">Base channel name</label>
            <p className="mt-1 text-xs leading-5 text-zinc-400">
              Keep this plain. Dank Shield stores the canonical name separately so repairs, routing, and rollback do not break.
            </p>
            <input
              className={`${inputClass()} mt-3`}
              value={name}
              onChange={(event) => updateName(event.target.value)}
              placeholder="gaming-clips"
            />
          </div>
          <div className="min-w-[220px]">
            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Case</label>
            <select
              className={`${inputClass()} mt-2`}
              value={caseMode}
              onChange={(event) => setCaseMode(event.target.value as ChannelCaseMode)}
            >
              <option value="lower">Lowercase channel-safe</option>
              <option value="preserve">Preserve</option>
              <option value="title">Title case</option>
              <option value="compact">Compact</option>
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
        <div className="text-sm font-semibold text-white">Unicode safety</div>
        <p className="mt-1 text-xs leading-5 text-zinc-400">
          Warnings stay visible, but owners can still allow decorative Unicode everywhere after acknowledging the risk.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={toggleClass(safetyLevel === "recommended_readability")} onClick={() => setSafetyLevel("recommended_readability")}>
            Recommended readability
          </button>
          <button type="button" className={toggleClass(safetyLevel === "allow_decorative_with_warnings")} onClick={() => setSafetyLevel("allow_decorative_with_warnings")}>
            Decorative with warnings
          </button>
          <button type="button" className={toggleClass(safetyLevel === "allow_unicode_everywhere")} onClick={() => setSafetyLevel("allow_unicode_everywhere")}>
            Unicode everywhere
          </button>
        </div>
        <label className="mt-3 flex items-start gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3 text-sm text-zinc-200">
          <input
            type="checkbox"
            checked={allowUnicodeEverywhere}
            onChange={(event) => setAllowUnicodeEverywhere(event.target.checked)}
            className="mt-1 h-4 w-4 accent-emerald-500"
          />
          <span>
            I understand fancy Unicode can reduce readability, search, screen-reader behavior, and moderation clarity. Allow it across everything I select.
          </span>
        </label>
      </div>

      <EmojiPickerButton value={emoji} onChange={setEmoji} />
      <label className="flex items-start gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 text-sm text-zinc-200">
        <input
          type="checkbox"
          checked={autoEmoji}
          onChange={(event) => setAutoEmoji(event.target.checked)}
          className="mt-1 h-4 w-4 accent-emerald-500"
        />
        <span>
          Auto-suggest emojis from the plain channel name when a row does not have a custom emoji.
        </span>
      </label>

      <UnicodeStylePicker
        value={unicodeStyle}
        onChange={setUnicodeStyle}
        safetyLevel={safetyLevel}
        allowUnicodeEverywhere={allowUnicodeEverywhere}
      />

      <SeparatorPicker
        separator={separator}
        onSeparatorChange={setSeparator}
        emojiPosition={emojiPosition}
        onEmojiPositionChange={setEmojiPosition}
        bracket={bracket}
        onBracketChange={setBracket}
      />

      <ChannelNamePreview name={name} options={options} />
    </section>
  );
}

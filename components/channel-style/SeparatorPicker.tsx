"use client";

import type { ChannelBracket, ChannelSeparator, EmojiPosition } from "@/lib/channel-style";

type SeparatorPickerProps = {
  separator?: ChannelSeparator | string;
  onSeparatorChange?: (separator: ChannelSeparator | string) => void;
  emojiPosition?: EmojiPosition;
  onEmojiPositionChange?: (position: EmojiPosition) => void;
  bracket?: ChannelBracket;
  onBracketChange?: (bracket: ChannelBracket) => void;
  className?: string;
  disabled?: boolean;
  compact?: boolean;
};

const SEPARATORS: Array<{ value: ChannelSeparator | string; label: string; preview: string }> = [
  { value: "-", label: "Hyphen", preview: "🎮-gaming" },
  { value: "・", label: "Dot", preview: "🎮・gaming" },
  { value: "┃", label: "Bar", preview: "🎮┃gaming" },
  { value: "︱", label: "Thin Bar", preview: "🎮︱gaming" },
  { value: "｜", label: "Wide Bar", preview: "🎮｜gaming" },
  { value: "»", label: "Double Arrow", preview: "🎮»gaming" },
  { value: "›", label: "Arrow", preview: "🎮›gaming" },
  { value: "•", label: "Bullet", preview: "🎮•gaming" },
  { value: "none", label: "None", preview: "🎮gaming" },
];

const POSITIONS: Array<{ value: EmojiPosition; label: string; preview: string }> = [
  { value: "first", label: "Emoji first", preview: "🎮・gaming" },
  { value: "last", label: "Emoji last", preview: "gaming・🎮" },
  { value: "bracket", label: "Bracket", preview: "「🎮」・gaming" },
  { value: "none", label: "No emoji", preview: "gaming" },
];

const BRACKETS: Array<{ value: ChannelBracket; label: string; preview: string }> = [
  { value: "「」", label: "Corner", preview: "「🎮」" },
  { value: "【】", label: "Bold", preview: "【🎮】" },
  { value: "〔〕", label: "Soft", preview: "〔🎮〕" },
  { value: "[]", label: "Square", preview: "[🎮]" },
  { value: "()", label: "Round", preview: "(🎮)" },
];

function optionClass(active: boolean, disabled = false) {
  return `min-h-[58px] rounded-2xl border p-3 text-left transition ${
    active ? "border-emerald-400 bg-emerald-950/40 text-white" : "border-zinc-800 bg-zinc-900/70 text-zinc-200 hover:border-zinc-600"
  } ${disabled ? "cursor-not-allowed opacity-50" : ""}`;
}

export default function SeparatorPicker({
  separator = "・",
  onSeparatorChange,
  emojiPosition = "first",
  onEmojiPositionChange,
  bracket = "「」",
  onBracketChange,
  className = "",
  disabled = false,
  compact = false,
}: SeparatorPickerProps) {
  return (
    <section className={`rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 ${className}`}>
      <div>
        <div className="text-sm font-semibold text-white">Layout</div>
        {!compact && (
          <p className="mt-1 text-xs leading-5 text-zinc-400">
            Choose how emojis and separators appear. This is preview-only until the owner confirms a queued job.
          </p>
        )}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Emoji position</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {POSITIONS.map((position) => (
              <button
                key={position.value}
                type="button"
                disabled={disabled}
                onClick={() => onEmojiPositionChange?.(position.value)}
                className={optionClass(position.value === emojiPosition, disabled)}
                aria-pressed={position.value === emojiPosition}
              >
                <div className="text-sm font-semibold">{position.label}</div>
                <div className="mt-1 truncate text-xs text-zinc-400">{position.preview}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Separator</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {SEPARATORS.map((item) => (
              <button
                key={item.value}
                type="button"
                disabled={disabled}
                onClick={() => onSeparatorChange?.(item.value)}
                className={optionClass(item.value === separator, disabled)}
                aria-pressed={item.value === separator}
              >
                <div className="text-sm font-semibold">{item.label}</div>
                <div className="mt-1 truncate text-xs text-zinc-400">{item.preview}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {emojiPosition === "bracket" && (
        <div className="mt-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Bracket style</div>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {BRACKETS.map((item) => (
              <button
                key={item.value}
                type="button"
                disabled={disabled}
                onClick={() => onBracketChange?.(item.value)}
                className={optionClass(item.value === bracket, disabled)}
                aria-pressed={item.value === bracket}
              >
                <div className="text-sm font-semibold">{item.label}</div>
                <div className="mt-1 text-xs text-zinc-400">{item.preview}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

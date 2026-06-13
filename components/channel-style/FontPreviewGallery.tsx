"use client";

import {
  UNICODE_STYLES,
  transformUnicodeStyle,
  type UnicodeSafetyLevel,
  type UnicodeStyleId,
  type UnicodeStyleScope,
} from "@/lib/channel-style";

type FontPreviewGalleryProps = {
  value: UnicodeStyleId;
  scope: UnicodeStyleScope;
  safetyLevel: UnicodeSafetyLevel;
  allowUnicodeEverywhere: boolean;
  onChange: (style: UnicodeStyleId) => void;
};

function previewFor(style: UnicodeStyleId, scope: UnicodeStyleScope) {
  const base = scope === "text_only" ? "general-chat" : "gaming-clips";
  const transformed = transformUnicodeStyle(base, style).value;
  return scope === "text_only" ? `🔥・${transformed}` : `🎮・${transformed}`;
}

function enabled(styleId: UnicodeStyleId, safetyLevel: UnicodeSafetyLevel, allowUnicodeEverywhere: boolean) {
  const style = UNICODE_STYLES.find((item) => item.id === styleId);
  if (!style) return true;
  if (style.id === "normal") return true;
  if (allowUnicodeEverywhere || safetyLevel === "allow_unicode_everywhere") return true;
  if (safetyLevel === "allow_decorative_with_warnings") return true;
  return style.recommendedForCritical;
}

function badgeText(styleId: UnicodeStyleId) {
  const style = UNICODE_STYLES.find((item) => item.id === styleId);
  if (!style) return "Standard";
  if (style.id === "normal") return "Standard";
  if (style.recommendedForCritical) return "Readable";
  if (style.decorative) return "Decorative";
  return "Styled";
}

export default function FontPreviewGallery({ value, scope, safetyLevel, allowUnicodeEverywhere, onChange }: FontPreviewGalleryProps) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-white">Font preview gallery</div>
          <p className="mt-1 text-xs leading-5 text-zinc-400">
            Pick visually. The preview uses the current apply mode so you do not have to test fonts one by one.
          </p>
        </div>
        <div className="rounded-full border border-emerald-500/30 bg-emerald-950/30 px-3 py-1 text-xs font-semibold text-emerald-100">
          {scope === "text_only" ? "Text-only preview" : "Generated-name preview"}
        </div>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {UNICODE_STYLES.map((style) => {
          const active = style.id === value;
          const isEnabled = enabled(style.id, safetyLevel, allowUnicodeEverywhere);
          return (
            <button
              key={style.id}
              type="button"
              onClick={() => onChange(style.id)}
              className={`rounded-2xl border p-3 text-left transition ${
                active
                  ? "border-emerald-400 bg-emerald-950/50"
                  : isEnabled
                    ? "border-zinc-800 bg-zinc-900/70 hover:border-zinc-600"
                    : "border-amber-500/30 bg-amber-950/20 hover:border-amber-400/60"
              }`}
              aria-pressed={active}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-bold text-white">{active ? "✅ " : ""}{style.label}</div>
                <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] font-semibold text-zinc-300">{badgeText(style.id)}</span>
              </div>
              <div className="mt-2 break-all rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100">
                {previewFor(style.id, scope)}
              </div>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-zinc-400">{style.description}</p>
              {!isEnabled ? <p className="mt-2 text-xs font-semibold text-amber-100">Enable decorative styling to use this one.</p> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

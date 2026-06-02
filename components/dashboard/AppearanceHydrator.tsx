"use client";

import { useEffect } from "react";
import {
  DASHBOARD_PREFERENCES_STORAGE_KEY,
  DASHBOARD_PREFERENCES_UPDATED_EVENT,
  DASHBOARD_THEME_PRESETS,
  applyDashboardPreferencesToDocument,
} from "@/lib/useDashboardPreferences";

const DEFAULT_PREFERENCES = {
  appearance: "dark",
  themePreset: "dankShield",
  density: "comfortable",
  theme: DASHBOARD_THEME_PRESETS.dankShield.theme,
};

function safeObject(value: unknown): Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, any>;
}

function readPreferences() {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;

  try {
    const raw = window.localStorage.getItem(DASHBOARD_PREFERENCES_STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;

    const parsed = safeObject(JSON.parse(raw));
    const prefs = safeObject(parsed.currentPreferences || parsed.preferences || parsed);
    const presetId = String(prefs.themePreset || "").trim();
    const preset = (DASHBOARD_THEME_PRESETS as Record<string, any>)[presetId] || null;

    return {
      ...DEFAULT_PREFERENCES,
      ...(preset
        ? {
            appearance: preset.appearance,
            density: preset.density,
            themePreset: preset.id,
            theme: { ...DEFAULT_PREFERENCES.theme, ...preset.theme },
          }
        : {}),
      ...prefs,
      theme: {
        ...DEFAULT_PREFERENCES.theme,
        ...(preset?.theme || {}),
        ...safeObject(prefs.theme),
      },
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export default function AppearanceHydrator() {
  useEffect(() => {
    const hydrate = () => applyDashboardPreferencesToDocument(readPreferences());
    hydrate();

    window.addEventListener(DASHBOARD_PREFERENCES_UPDATED_EVENT, hydrate);
    window.addEventListener("storage", hydrate);

    const media = window.matchMedia?.("(prefers-color-scheme: light)");
    media?.addEventListener?.("change", hydrate);

    return () => {
      window.removeEventListener(DASHBOARD_PREFERENCES_UPDATED_EVENT, hydrate);
      window.removeEventListener("storage", hydrate);
      media?.removeEventListener?.("change", hydrate);
    };
  }, []);

  return null;
}

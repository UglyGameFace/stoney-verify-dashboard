"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DASHBOARD_PREFERENCES_STORAGE_KEY,
  DASHBOARD_PREFERENCES_UPDATED_EVENT,
  DASHBOARD_THEME_PRESETS,
  applyDashboardPreferencesToDocument,
} from "@/lib/useDashboardPreferences";

const APPEARANCE_OPTIONS = [
  { id: "light", label: "Light", helper: "Brightest and easiest to read." },
  { id: "dark", label: "Dark", helper: "Default dashboard look." },
  { id: "system", label: "System", helper: "Matches your device." },
  { id: "high-contrast", label: "High Contrast", helper: "Best for mobile/sunlight." },
];

const FALLBACK_STATE = {
  currentPreferences: {
    appearance: "dark",
    themePreset: "dankShield",
    theme: DASHBOARD_THEME_PRESETS.dankShield.theme,
    density: "comfortable",
  },
  activeProfileId: "profile-1",
  lastUsedProfileId: "profile-1",
  profiles: [],
};

function safeObject(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

function readStoredState() {
  if (typeof window === "undefined") return FALLBACK_STATE;
  try {
    const raw = window.localStorage.getItem(DASHBOARD_PREFERENCES_STORAGE_KEY);
    if (!raw) return FALLBACK_STATE;
    return { ...FALLBACK_STATE, ...safeObject(JSON.parse(raw)) };
  } catch {
    return FALLBACK_STATE;
  }
}

function writeStoredState(nextState: Record<string, any>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DASHBOARD_PREFERENCES_STORAGE_KEY, JSON.stringify(nextState));
  applyDashboardPreferencesToDocument(nextState.currentPreferences);
  window.dispatchEvent(new CustomEvent(DASHBOARD_PREFERENCES_UPDATED_EVENT));
}

export default function QuickAppearancePanel() {
  const [state, setState] = useState(FALLBACK_STATE);

  useEffect(() => {
    setState(readStoredState());
  }, []);

  const preferences = safeObject(state.currentPreferences);
  const currentAppearance = String(preferences.appearance || "dark");
  const currentPreset = String(preferences.themePreset || "dankShield");
  const currentDensity = String(preferences.density || "comfortable");

  const presetRows = useMemo(() => Object.values(DASHBOARD_THEME_PRESETS), []);

  function updatePreferences(patch: Record<string, any>) {
    const latest = readStoredState();
    const nextPreferences = {
      ...safeObject(latest.currentPreferences),
      ...patch,
    };
    const nextState = {
      ...latest,
      currentPreferences: nextPreferences,
    };
    setState(nextState as any);
    writeStoredState(nextState);
  }

  function applyPreset(presetId: string) {
    const preset = DASHBOARD_THEME_PRESETS[presetId as keyof typeof DASHBOARD_THEME_PRESETS];
    if (!preset) return;
    updatePreferences({
      appearance: preset.appearance,
      themePreset: preset.id,
      density: preset.density || currentDensity,
      theme: {
        ...safeObject(preferences.theme),
        ...preset.theme,
      },
    });
  }

  function applyAppearance(appearance: string) {
    updatePreferences({ appearance });
  }

  function applyDensity(density: string) {
    updatePreferences({ density });
  }

  return (
    <section className="card quick-appearance-card" aria-label="Quick appearance settings">
      <div className="quick-appearance-head">
        <div>
          <div className="muted quick-appearance-eyebrow">Quick Appearance</div>
          <h2 className="quick-appearance-title">Make the dashboard readable first</h2>
          <p className="muted quick-appearance-copy">
            Use one-tap presets for normal users. The full Personalize UI still exists for advanced layout and saved profile tweaks.
          </p>
        </div>
      </div>

      <div className="quick-appearance-grid">
        <div className="quick-appearance-section">
          <div className="quick-appearance-section-title">Mode</div>
          <div className="quick-pill-grid compact">
            {APPEARANCE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`quick-preset-pill ${currentAppearance === option.id ? "active" : ""}`}
                onClick={() => applyAppearance(option.id)}
              >
                <strong>{option.label}</strong>
                <span>{option.helper}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="quick-appearance-section wide">
          <div className="quick-appearance-section-title">Color Presets</div>
          <div className="quick-preset-grid">
            {presetRows.map((preset: any) => (
              <button
                key={preset.id}
                type="button"
                className={`quick-theme-card ${currentPreset === preset.id ? "active" : ""}`}
                onClick={() => applyPreset(preset.id)}
              >
                <span className="quick-theme-dots">
                  <span style={{ background: preset.theme.accent }} />
                  <span style={{ background: preset.theme.accent2 }} />
                  <span style={{ background: preset.theme.panelBg }} />
                </span>
                <strong>{preset.name}</strong>
                <span>{preset.helper}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="quick-appearance-section">
          <div className="quick-appearance-section-title">Spacing</div>
          <div className="quick-pill-grid">
            {["compact", "comfortable", "spacious"].map((density) => (
              <button
                key={density}
                type="button"
                className={`quick-preset-pill ${currentDensity === density ? "active" : ""}`}
                onClick={() => applyDensity(density)}
              >
                <strong>{density[0].toUpperCase() + density.slice(1)}</strong>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

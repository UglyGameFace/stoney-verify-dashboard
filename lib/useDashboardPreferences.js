"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "stoney_dashboard_preferences_v1";

const DEFAULTS = {
  theme: {
    accent: "#45d483",
    accent2: "#3b82f6",
    panelBg: "rgba(19,32,49,0.88)",
    panelBgSoft: "rgba(255,255,255,0.02)",
    panelBorder: "rgba(255,255,255,0.08)",
    textStrong: "#f8fafc",
    textMuted: "rgba(255,255,255,0.72)",
    danger: "#f87171",
    warn: "#fbbf24",
    success: "#4ade80",
  },
  density: "comfortable", // compact | comfortable | spacious
  sectionVisibility: {
    intelligence: true,
    stats: true,
    quickActions: true,
    activity: true,
    warns: true,
    raids: true,
    fraud: true,
    freshEntrants: true,
    memberSnapshot: true,
    staffMetrics: true,
    roleHierarchy: true,
    memberSearch: true,
    categories: true,
  },
  layout: {
    home: [
      "intelligence",
      "stats",
      "quickActions",
      "activity",
      "warns",
      "raids",
      "fraud",
    ],
    members: [
      "freshEntrants",
      "memberSnapshot",
      "staffMetrics",
      "roleHierarchy",
      "memberSearch",
    ],
  },
};

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function deepMerge(base, incoming) {
  if (!isObject(base) || !isObject(incoming)) {
    return incoming ?? base;
  }

  const output = { ...base };

  for (const key of Object.keys(incoming)) {
    const baseValue = base[key];
    const incomingValue = incoming[key];

    if (Array.isArray(baseValue) && Array.isArray(incomingValue)) {
      output[key] = [...incomingValue];
      continue;
    }

    if (isObject(baseValue) && isObject(incomingValue)) {
      output[key] = deepMerge(baseValue, incomingValue);
      continue;
    }

    output[key] = incomingValue;
  }

  return output;
}

function loadPreferences() {
  if (typeof window === "undefined") {
    return DEFAULTS;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;

    const parsed = JSON.parse(raw);
    return deepMerge(DEFAULTS, parsed);
  } catch {
    return DEFAULTS;
  }
}

function applyThemeToDocument(theme, density) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  root.style.setProperty("--accent", theme.accent);
  root.style.setProperty("--accent-2", theme.accent2);
  root.style.setProperty("--panel-bg", theme.panelBg);
  root.style.setProperty("--panel-bg-soft", theme.panelBgSoft);
  root.style.setProperty("--panel-border", theme.panelBorder);
  root.style.setProperty("--text-strong", theme.textStrong);
  root.style.setProperty("--text-muted", theme.textMuted);
  root.style.setProperty("--tone-danger", theme.danger);
  root.style.setProperty("--tone-warn", theme.warn);
  root.style.setProperty("--tone-success", theme.success);

  root.dataset.dashboardDensity = density;
}

export function useDashboardPreferences() {
  const [preferences, setPreferences] = useState(DEFAULTS);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const loaded = loadPreferences();
    setPreferences(loaded);
    applyThemeToDocument(loaded.theme, loaded.density);
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (!isReady || typeof window === "undefined") return;

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      // ignore localStorage errors
    }

    applyThemeToDocument(preferences.theme, preferences.density);
  }, [preferences, isReady]);

  const setThemeValue = useCallback((key, value) => {
    setPreferences((prev) => ({
      ...prev,
      theme: {
        ...prev.theme,
        [key]: value,
      },
    }));
  }, []);

  const setDensity = useCallback((density) => {
    setPreferences((prev) => ({
      ...prev,
      density,
    }));
  }, []);

  const toggleSectionVisibility = useCallback((sectionKey) => {
    setPreferences((prev) => ({
      ...prev,
      sectionVisibility: {
        ...prev.sectionVisibility,
        [sectionKey]: !prev.sectionVisibility[sectionKey],
      },
    }));
  }, []);

  const setSectionVisibility = useCallback((sectionKey, value) => {
    setPreferences((prev) => ({
      ...prev,
      sectionVisibility: {
        ...prev.sectionVisibility,
        [sectionKey]: Boolean(value),
      },
    }));
  }, []);

  const moveSection = useCallback((area, fromIndex, toIndex) => {
    setPreferences((prev) => {
      const current = Array.isArray(prev.layout?.[area])
        ? [...prev.layout[area]]
        : [];

      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= current.length ||
        toIndex >= current.length
      ) {
        return prev;
      }

      const [moved] = current.splice(fromIndex, 1);
      current.splice(toIndex, 0, moved);

      return {
        ...prev,
        layout: {
          ...prev.layout,
          [area]: current,
        },
      };
    });
  }, []);

  const resetPreferences = useCallback(() => {
    setPreferences(DEFAULTS);
  }, []);

  const api = useMemo(
    () => ({
      preferences,
      isReady,
      setThemeValue,
      setDensity,
      toggleSectionVisibility,
      setSectionVisibility,
      moveSection,
      resetPreferences,
    }),
    [
      preferences,
      isReady,
      setThemeValue,
      setDensity,
      toggleSectionVisibility,
      setSectionVisibility,
      moveSection,
      resetPreferences,
    ]
  );

  return api;
}

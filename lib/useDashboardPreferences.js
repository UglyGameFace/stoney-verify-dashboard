"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  HOME_WORKSPACE_KEYS,
  ACTIVITY_WORKSPACE_KEYS,
  MEMBERS_WORKSPACE_KEYS,
} from "@/components/dashboard/workspaceModel";

export const DASHBOARD_PREFERENCES_STORAGE_KEY = "stoney_dashboard_preferences_v3";
export const DASHBOARD_PREFERENCES_UPDATED_EVENT = "dank-dashboard-preferences-updated";

const STORAGE_KEY = DASHBOARD_PREFERENCES_STORAGE_KEY;
const MAX_PROFILES = 5;

const HOME_SECTION_KEYS = [...HOME_WORKSPACE_KEYS];
const ACTIVITY_SECTION_KEYS = [...ACTIVITY_WORKSPACE_KEYS];
const MEMBERS_SECTION_KEYS = [...MEMBERS_WORKSPACE_KEYS];

const ALL_SECTION_KEYS = [
  ...HOME_SECTION_KEYS,
  ...ACTIVITY_SECTION_KEYS,
  ...MEMBERS_SECTION_KEYS,
  "categories",
];

export const DASHBOARD_THEME_PRESETS = {
  dankShield: {
    id: "dankShield",
    name: "Dank Shield",
    helper: "The branded green/blue look, but brighter than before.",
    appearance: "dark",
    density: "comfortable",
    theme: {
      accent: "#6dff9d",
      accent2: "#78ddff",
      panelBg: "rgba(17,31,43,0.96)",
      panelBgSoft: "rgba(255,255,255,0.075)",
      panelBorder: "rgba(255,255,255,0.16)",
      textStrong: "#ffffff",
      textMuted: "#c7ddcf",
      danger: "#ff6f8e",
      warn: "#ffd36b",
      success: "#6dff9d",
      effectsMode: "reduced",
    },
  },
  cleanBlue: {
    id: "cleanBlue",
    name: "Clean Blue",
    helper: "Professional SaaS feel with less neon and easier scanning.",
    appearance: "light",
    density: "comfortable",
    theme: {
      accent: "#2563eb",
      accent2: "#06b6d4",
      panelBg: "rgba(255,255,255,0.96)",
      panelBgSoft: "rgba(37,99,235,0.06)",
      panelBorder: "rgba(15,23,42,0.14)",
      textStrong: "#0f172a",
      textMuted: "#475569",
      danger: "#dc2626",
      warn: "#b45309",
      success: "#15803d",
      effectsMode: "minimal",
    },
  },
  softGreen: {
    id: "softGreen",
    name: "Soft Green",
    helper: "Still on-brand, brighter, calmer, and better for long sessions.",
    appearance: "light",
    density: "comfortable",
    theme: {
      accent: "#16a34a",
      accent2: "#0891b2",
      panelBg: "rgba(255,255,255,0.96)",
      panelBgSoft: "rgba(22,163,74,0.07)",
      panelBorder: "rgba(20,83,45,0.16)",
      textStrong: "#0f2418",
      textMuted: "#3f5d49",
      danger: "#dc2626",
      warn: "#b45309",
      success: "#15803d",
      effectsMode: "minimal",
    },
  },
  neonPurple: {
    id: "neonPurple",
    name: "Neon Purple",
    helper: "Unique and flashy without going full dark cave mode.",
    appearance: "dark",
    density: "comfortable",
    theme: {
      accent: "#c084fc",
      accent2: "#22d3ee",
      panelBg: "rgba(30,24,52,0.96)",
      panelBgSoft: "rgba(192,132,252,0.08)",
      panelBorder: "rgba(216,180,254,0.22)",
      textStrong: "#ffffff",
      textMuted: "#ddd6fe",
      danger: "#fb7185",
      warn: "#facc15",
      success: "#86efac",
      effectsMode: "reduced",
    },
  },
  highContrast: {
    id: "highContrast",
    name: "High Contrast",
    helper: "Maximum readability for mobile, sunlight, and tired eyes.",
    appearance: "dark",
    density: "comfortable",
    theme: {
      accent: "#facc15",
      accent2: "#38bdf8",
      panelBg: "rgba(0,0,0,0.97)",
      panelBgSoft: "rgba(255,255,255,0.11)",
      panelBorder: "rgba(255,255,255,0.32)",
      textStrong: "#ffffff",
      textMuted: "#f4f4f5",
      danger: "#fb7185",
      warn: "#facc15",
      success: "#4ade80",
      effectsMode: "minimal",
    },
  },
};

const DEFAULTS = {
  appearance: "dark",
  themePreset: "dankShield",
  theme: DASHBOARD_THEME_PRESETS.dankShield.theme,
  density: "comfortable",
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
    home: [...HOME_SECTION_KEYS],
    activity: [...ACTIVITY_SECTION_KEYS],
    members: [...MEMBERS_SECTION_KEYS],
  },
};

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clonePreferences(preferences) {
  return JSON.parse(JSON.stringify(preferences));
}

function sanitizeColor(value, fallback) {
  const text = String(value || "").trim();
  if (!text) return fallback;
  const isHex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(text);
  const isRgbFamily = /^(rgb|rgba|hsl|hsla)\(.+\)$/i.test(text);
  return isHex || isRgbFamily ? text : fallback;
}

function sanitizeAppearance(value) {
  const mode = String(value || "").trim().toLowerCase();
  if (mode === "light" || mode === "system" || mode === "high-contrast") return mode;
  return "dark";
}

function sanitizeThemePreset(value) {
  const key = String(value || "").trim();
  return DASHBOARD_THEME_PRESETS[key] ? key : "custom";
}

function sanitizeEffectsMode(value) {
  const mode = String(value || "").trim().toLowerCase();
  if (mode === "minimal") return "minimal";
  if (mode === "reduced") return "reduced";
  return "full";
}

function sanitizeDensity(value) {
  const density = String(value || "").trim().toLowerCase();
  if (density === "compact") return "compact";
  if (density === "spacious") return "spacious";
  return "comfortable";
}

function sanitizeVisibilityMap(rawVisibility) {
  const next = { ...DEFAULTS.sectionVisibility };
  if (!isObject(rawVisibility)) return next;
  for (const key of ALL_SECTION_KEYS) {
    if (key in rawVisibility) next[key] = Boolean(rawVisibility[key]);
  }
  return next;
}

function sanitizeLayoutArea(rawArea, allowedKeys, fallbackArea) {
  const incoming = Array.isArray(rawArea) ? rawArea : [];
  const allowed = new Set(allowedKeys);
  const seen = new Set();
  const out = [];
  for (const item of incoming) {
    const key = String(item || "").trim();
    if (!allowed.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  for (const key of fallbackArea) {
    if (!seen.has(key)) {
      seen.add(key);
      out.push(key);
    }
  }
  return out;
}

function sanitizeTheme(theme) {
  const incoming = isObject(theme) ? theme : {};
  return {
    accent: sanitizeColor(incoming.accent, DEFAULTS.theme.accent),
    accent2: sanitizeColor(incoming.accent2, DEFAULTS.theme.accent2),
    panelBg: sanitizeColor(incoming.panelBg, DEFAULTS.theme.panelBg),
    panelBgSoft: sanitizeColor(incoming.panelBgSoft, DEFAULTS.theme.panelBgSoft),
    panelBorder: sanitizeColor(incoming.panelBorder, DEFAULTS.theme.panelBorder),
    textStrong: sanitizeColor(incoming.textStrong, DEFAULTS.theme.textStrong),
    textMuted: sanitizeColor(incoming.textMuted, DEFAULTS.theme.textMuted),
    danger: sanitizeColor(incoming.danger, DEFAULTS.theme.danger),
    warn: sanitizeColor(incoming.warn, DEFAULTS.theme.warn),
    success: sanitizeColor(incoming.success, DEFAULTS.theme.success),
    effectsMode: sanitizeEffectsMode(incoming.effectsMode),
  };
}

function sanitizePreferences(preferences) {
  const incoming = isObject(preferences) ? preferences : {};
  const incomingLayout = isObject(incoming.layout) ? incoming.layout : {};
  const legacyHomeLayout = Array.isArray(incomingLayout.home) ? incomingLayout.home : [];
  const legacyActivitySource = Array.isArray(incomingLayout.activity) ? incomingLayout.activity : legacyHomeLayout;

  return {
    appearance: sanitizeAppearance(incoming.appearance),
    themePreset: sanitizeThemePreset(incoming.themePreset),
    theme: sanitizeTheme(incoming.theme),
    density: sanitizeDensity(incoming.density),
    sectionVisibility: sanitizeVisibilityMap(incoming.sectionVisibility),
    layout: {
      home: sanitizeLayoutArea(legacyHomeLayout, HOME_SECTION_KEYS, DEFAULTS.layout.home),
      activity: sanitizeLayoutArea(legacyActivitySource, ACTIVITY_SECTION_KEYS, DEFAULTS.layout.activity),
      members: sanitizeLayoutArea(incomingLayout.members, MEMBERS_SECTION_KEYS, DEFAULTS.layout.members),
    },
  };
}

function buildDefaultProfiles() {
  return Array.from({ length: MAX_PROFILES }, (_, index) => ({
    id: `profile-${index + 1}`,
    slot: index + 1,
    name: `Profile ${index + 1}`,
    isEmpty: index !== 0,
    preferences: clonePreferences(DEFAULTS),
    updatedAt: index === 0 ? new Date().toISOString() : null,
  }));
}

function sanitizeProfiles(rawProfiles) {
  const defaults = buildDefaultProfiles();
  const incoming = Array.isArray(rawProfiles) ? rawProfiles : [];
  return defaults.map((fallbackProfile, index) => {
    const raw = incoming[index];
    if (!isObject(raw)) return fallbackProfile;
    return {
      id: String(raw.id || fallbackProfile.id),
      slot: index + 1,
      name: String(raw.name || fallbackProfile.name),
      isEmpty: Boolean(raw.isEmpty),
      preferences: sanitizePreferences(raw.preferences),
      updatedAt: raw.updatedAt || null,
    };
  });
}

function normalizeStorageShape(parsed) {
  const profiles = sanitizeProfiles(isObject(parsed) ? parsed.profiles : null);
  const fallbackActive = profiles[0]?.id || "profile-1";
  if (!isObject(parsed)) {
    return {
      currentPreferences: clonePreferences(DEFAULTS),
      activeProfileId: fallbackActive,
      lastUsedProfileId: fallbackActive,
      profiles,
    };
  }

  if ("currentPreferences" in parsed || "profiles" in parsed || "preferences" in parsed) {
    const activeProfileId = profiles.some((p) => p.id === parsed.activeProfileId)
      ? String(parsed.activeProfileId)
      : fallbackActive;
    const lastUsedProfileId = profiles.some((p) => p.id === parsed.lastUsedProfileId)
      ? String(parsed.lastUsedProfileId)
      : activeProfileId;
    return {
      currentPreferences: sanitizePreferences(parsed.currentPreferences || parsed.preferences || DEFAULTS),
      activeProfileId,
      lastUsedProfileId,
      profiles,
    };
  }

  const upgradedPreferences = sanitizePreferences(parsed);
  profiles[0] = {
    ...profiles[0],
    isEmpty: false,
    preferences: clonePreferences(upgradedPreferences),
    updatedAt: new Date().toISOString(),
  };
  return {
    currentPreferences: upgradedPreferences,
    activeProfileId: fallbackActive,
    lastUsedProfileId: fallbackActive,
    profiles,
  };
}

function loadStoredState() {
  if (typeof window === "undefined") {
    const profiles = buildDefaultProfiles();
    return {
      currentPreferences: clonePreferences(DEFAULTS),
      activeProfileId: profiles[0].id,
      lastUsedProfileId: profiles[0].id,
      profiles,
    };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return normalizeStorageShape(null);
    return normalizeStorageShape(JSON.parse(raw));
  } catch {
    return normalizeStorageShape(null);
  }
}

function resolveAppearance(mode) {
  const appearance = sanitizeAppearance(mode);
  if (appearance !== "system") return appearance;
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: light)")?.matches) {
    return "light";
  }
  return "dark";
}

export function applyDashboardPreferencesToDocument(preferences) {
  if (typeof document === "undefined") return;
  const safePreferences = sanitizePreferences(preferences);
  const root = document.documentElement;
  const safeTheme = safePreferences.theme;
  const resolvedAppearance = resolveAppearance(safePreferences.appearance);

  root.style.setProperty("--accent", safeTheme.accent);
  root.style.setProperty("--accent-2", safeTheme.accent2);
  root.style.setProperty("--panel-bg", safeTheme.panelBg);
  root.style.setProperty("--panel-bg-soft", safeTheme.panelBgSoft);
  root.style.setProperty("--panel-border", safeTheme.panelBorder);
  root.style.setProperty("--text-strong", safeTheme.textStrong);
  root.style.setProperty("--text-muted", safeTheme.textMuted);
  root.style.setProperty("--tone-danger", safeTheme.danger);
  root.style.setProperty("--tone-warn", safeTheme.warn);
  root.style.setProperty("--tone-success", safeTheme.success);

  root.dataset.dashboardAppearance = resolvedAppearance;
  root.dataset.dashboardAppearancePreference = safePreferences.appearance;
  root.dataset.dashboardPreset = safePreferences.themePreset || "custom";
  root.dataset.dashboardDensity = safePreferences.density;
  root.dataset.dashboardEffectsMode = safeTheme.effectsMode;
}

function persistDashboardState({ preferences, profiles, activeProfileId, lastUsedProfileId }) {
  if (typeof window === "undefined") return;
  const safePreferences = sanitizePreferences(preferences);
  const safeProfiles = sanitizeProfiles(profiles);
  const payload = {
    currentPreferences: safePreferences,
    activeProfileId,
    lastUsedProfileId,
    profiles: safeProfiles,
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage failures
  }
  applyDashboardPreferencesToDocument(safePreferences);
}

export function useDashboardPreferences() {
  const [preferences, setPreferences] = useState(clonePreferences(DEFAULTS));
  const [profiles, setProfiles] = useState(buildDefaultProfiles());
  const [activeProfileId, setActiveProfileId] = useState("profile-1");
  const [lastUsedProfileId, setLastUsedProfileId] = useState("profile-1");
  const [isReady, setIsReady] = useState(false);

  const hydrateFromStorage = useCallback(() => {
    const loaded = loadStoredState();
    const safePreferences = sanitizePreferences(loaded.currentPreferences);
    setPreferences(safePreferences);
    setProfiles(sanitizeProfiles(loaded.profiles));
    setActiveProfileId(String(loaded.activeProfileId || "profile-1"));
    setLastUsedProfileId(String(loaded.lastUsedProfileId || "profile-1"));
    applyDashboardPreferencesToDocument(safePreferences);
    return loaded;
  }, []);

  useEffect(() => {
    hydrateFromStorage();
    setIsReady(true);
  }, [hydrateFromStorage]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handler = () => hydrateFromStorage();
    window.addEventListener(DASHBOARD_PREFERENCES_UPDATED_EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(DASHBOARD_PREFERENCES_UPDATED_EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, [hydrateFromStorage]);

  useEffect(() => {
    if (!isReady) return;
    persistDashboardState({ preferences, profiles, activeProfileId, lastUsedProfileId });
  }, [preferences, profiles, activeProfileId, lastUsedProfileId, isReady]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const query = window.matchMedia?.("(prefers-color-scheme: light)");
    if (!query) return undefined;
    const handler = () => applyDashboardPreferencesToDocument(preferences);
    query.addEventListener?.("change", handler);
    return () => query.removeEventListener?.("change", handler);
  }, [preferences]);

  const setThemeValue = useCallback((key, value) => {
    setPreferences((prev) => sanitizePreferences({
      ...prev,
      themePreset: "custom",
      theme: { ...prev.theme, [key]: value },
    }));
  }, []);

  const setAppearance = useCallback((appearance) => {
    setPreferences((prev) => sanitizePreferences({ ...prev, appearance }));
  }, []);

  const setThemePreset = useCallback((presetId) => {
    const preset = DASHBOARD_THEME_PRESETS[presetId];
    if (!preset) return false;
    setPreferences((prev) => sanitizePreferences({
      ...prev,
      appearance: preset.appearance || prev.appearance,
      density: preset.density || prev.density,
      themePreset: preset.id,
      theme: { ...prev.theme, ...preset.theme },
    }));
    return true;
  }, []);

  const setDensity = useCallback((density) => {
    setPreferences((prev) => sanitizePreferences({ ...prev, density }));
  }, []);

  const toggleSectionVisibility = useCallback((sectionKey) => {
    setPreferences((prev) => sanitizePreferences({
      ...prev,
      sectionVisibility: {
        ...prev.sectionVisibility,
        [sectionKey]: !prev.sectionVisibility?.[sectionKey],
      },
    }));
  }, []);

  const setSectionVisibility = useCallback((sectionKey, value) => {
    setPreferences((prev) => sanitizePreferences({
      ...prev,
      sectionVisibility: {
        ...prev.sectionVisibility,
        [sectionKey]: Boolean(value),
      },
    }));
  }, []);

  const moveSection = useCallback((area, fromIndex, toIndex) => {
    setPreferences((prev) => {
      const allowedKeys = area === "activity" ? ACTIVITY_SECTION_KEYS : area === "members" ? MEMBERS_SECTION_KEYS : HOME_SECTION_KEYS;
      const current = Array.isArray(prev?.layout?.[area]) ? [...prev.layout[area]] : [...allowedKeys];
      if (fromIndex < 0 || toIndex < 0 || fromIndex >= current.length || toIndex >= current.length || fromIndex === toIndex) return prev;
      const [moved] = current.splice(fromIndex, 1);
      current.splice(toIndex, 0, moved);
      return sanitizePreferences({ ...prev, layout: { ...prev.layout, [area]: current } });
    });
  }, []);

  const resetPreferences = useCallback(() => {
    setPreferences(clonePreferences(DEFAULTS));
  }, []);

  const getProfileById = useCallback((profileId) => profiles.find((profile) => profile.id === profileId) || null, [profiles]);

  const saveProfile = useCallback((profileId, nextName) => {
    const target = getProfileById(profileId);
    if (!target) return false;
    const now = new Date().toISOString();
    const safeName = String(nextName || target.name || `Profile ${target.slot}`).trim();
    setProfiles((prev) => sanitizeProfiles(prev.map((profile) => profile.id === profileId ? {
      ...profile,
      name: safeName || `Profile ${profile.slot}`,
      isEmpty: false,
      preferences: clonePreferences(sanitizePreferences(preferences)),
      updatedAt: now,
    } : profile)));
    setActiveProfileId(profileId);
    setLastUsedProfileId(profileId);
    return true;
  }, [getProfileById, preferences]);

  const loadProfile = useCallback((profileId) => {
    const target = getProfileById(profileId);
    if (!target) return false;
    setPreferences(sanitizePreferences(target.preferences));
    setActiveProfileId(profileId);
    setLastUsedProfileId(profileId);
    return true;
  }, [getProfileById]);

  const renameProfile = useCallback((profileId, nextName) => {
    const cleaned = String(nextName || "").trim();
    if (!cleaned) return false;
    setProfiles((prev) => sanitizeProfiles(prev.map((profile) => profile.id === profileId ? { ...profile, name: cleaned } : profile)));
    return true;
  }, []);

  const deleteProfile = useCallback((profileId) => {
    const target = getProfileById(profileId);
    if (!target) return false;
    const fallbackId = "profile-1";
    setProfiles((prev) => sanitizeProfiles(prev.map((profile) => profile.id === profileId ? {
      ...profile,
      name: `Profile ${profile.slot}`,
      isEmpty: profile.id !== fallbackId,
      preferences: clonePreferences(DEFAULTS),
      updatedAt: profile.id === fallbackId ? new Date().toISOString() : null,
    } : profile)));
    if (profileId === fallbackId || activeProfileId === profileId || lastUsedProfileId === profileId) {
      const fallbackProfile = getProfileById(fallbackId);
      setPreferences(sanitizePreferences(fallbackProfile?.preferences || DEFAULTS));
      setActiveProfileId(fallbackId);
      setLastUsedProfileId(fallbackId);
    }
    return true;
  }, [activeProfileId, getProfileById, lastUsedProfileId]);

  const saveActiveProfile = useCallback((nextName) => saveProfile(activeProfileId, nextName), [activeProfileId, saveProfile]);

  const activeProfile = useMemo(() => profiles.find((profile) => profile.id === activeProfileId) || null, [profiles, activeProfileId]);
  const lastUsedProfile = useMemo(() => profiles.find((profile) => profile.id === lastUsedProfileId) || null, [profiles, lastUsedProfileId]);

  return useMemo(() => ({
    preferences,
    isReady,
    profiles,
    activeProfileId,
    activeProfile,
    lastUsedProfileId,
    lastUsedProfile,
    maxProfiles: MAX_PROFILES,
    themePresets: DASHBOARD_THEME_PRESETS,
    setThemeValue,
    setThemePreset,
    setAppearance,
    setDensity,
    toggleSectionVisibility,
    setSectionVisibility,
    moveSection,
    resetPreferences,
    saveProfile,
    saveActiveProfile,
    loadProfile,
    renameProfile,
    deleteProfile,
    setActiveProfileId,
  }), [
    preferences,
    isReady,
    profiles,
    activeProfileId,
    activeProfile,
    lastUsedProfileId,
    lastUsedProfile,
    setThemeValue,
    setThemePreset,
    setAppearance,
    setDensity,
    toggleSectionVisibility,
    setSectionVisibility,
    moveSection,
    resetPreferences,
    saveProfile,
    saveActiveProfile,
    loadProfile,
    renameProfile,
    deleteProfile,
  ]);
}

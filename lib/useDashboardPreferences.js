"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "stoney_dashboard_preferences_v3";
const MAX_PROFILES = 5;

const HOME_SECTION_KEYS = [
  "intelligence",
  "stats",
  "quickActions",
  "activity",
  "warns",
  "raids",
  "fraud",
];

const MEMBERS_SECTION_KEYS = [
  "freshEntrants",
  "memberSnapshot",
  "staffMetrics",
  "roleHierarchy",
  "memberSearch",
];

const ALL_SECTION_KEYS = [
  ...HOME_SECTION_KEYS,
  ...MEMBERS_SECTION_KEYS,
  "categories",
];

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
    effectsMode: "full",
  },
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
    if (key in rawVisibility) {
      next[key] = Boolean(rawVisibility[key]);
    }
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
    if (!allowed.has(key)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }

  for (const key of fallbackArea) {
    if (!seen.has(key)) {
      out.push(key);
      seen.add(key);
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

  return {
    theme: sanitizeTheme(incoming.theme),
    density: sanitizeDensity(incoming.density),
    sectionVisibility: sanitizeVisibilityMap(incoming.sectionVisibility),
    layout: {
      home: sanitizeLayoutArea(
        incoming?.layout?.home,
        HOME_SECTION_KEYS,
        DEFAULTS.layout.home
      ),
      members: sanitizeLayoutArea(
        incoming?.layout?.members,
        MEMBERS_SECTION_KEYS,
        DEFAULTS.layout.members
      ),
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

    if (!isObject(raw)) {
      return fallbackProfile;
    }

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
  if (!isObject(parsed)) {
    const profiles = buildDefaultProfiles();
    return {
      currentPreferences: clonePreferences(DEFAULTS),
      activeProfileId: profiles[0].id,
      lastUsedProfileId: profiles[0].id,
      profiles,
    };
  }

  if ("currentPreferences" in parsed || "profiles" in parsed || "preferences" in parsed) {
    const profiles = sanitizeProfiles(parsed.profiles);
    const fallbackActive = profiles[0]?.id || "profile-1";

    const activeProfileId = profiles.some((p) => p.id === parsed.activeProfileId)
      ? String(parsed.activeProfileId)
      : fallbackActive;

    const lastUsedProfileId = profiles.some((p) => p.id === parsed.lastUsedProfileId)
      ? String(parsed.lastUsedProfileId)
      : activeProfileId;

    return {
      currentPreferences: sanitizePreferences(
        parsed.currentPreferences || parsed.preferences || DEFAULTS
      ),
      activeProfileId,
      lastUsedProfileId,
      profiles,
    };
  }

  const profiles = buildDefaultProfiles();
  const upgradedPreferences = sanitizePreferences(parsed);

  profiles[0] = {
    ...profiles[0],
    isEmpty: false,
    preferences: clonePreferences(upgradedPreferences),
    updatedAt: new Date().toISOString(),
  };

  return {
    currentPreferences: upgradedPreferences,
    activeProfileId: profiles[0].id,
    lastUsedProfileId: profiles[0].id,
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

    if (!raw) {
      const profiles = buildDefaultProfiles();
      return {
        currentPreferences: clonePreferences(DEFAULTS),
        activeProfileId: profiles[0].id,
        lastUsedProfileId: profiles[0].id,
        profiles,
      };
    }

    return normalizeStorageShape(JSON.parse(raw));
  } catch {
    const profiles = buildDefaultProfiles();
    return {
      currentPreferences: clonePreferences(DEFAULTS),
      activeProfileId: profiles[0].id,
      lastUsedProfileId: profiles[0].id,
      profiles,
    };
  }
}

function applyThemeToDocument(theme, density) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const safeTheme = sanitizeTheme(theme);
  const safeDensity = sanitizeDensity(density);

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

  root.dataset.dashboardDensity = safeDensity;
  root.dataset.dashboardEffectsMode = safeTheme.effectsMode;
}

export function useDashboardPreferences() {
  const [preferences, setPreferences] = useState(clonePreferences(DEFAULTS));
  const [profiles, setProfiles] = useState(buildDefaultProfiles());
  const [activeProfileId, setActiveProfileId] = useState("profile-1");
  const [lastUsedProfileId, setLastUsedProfileId] = useState("profile-1");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const loaded = loadStoredState();

    setPreferences(sanitizePreferences(loaded.currentPreferences));
    setProfiles(sanitizeProfiles(loaded.profiles));
    setActiveProfileId(String(loaded.activeProfileId || "profile-1"));
    setLastUsedProfileId(String(loaded.lastUsedProfileId || "profile-1"));

    applyThemeToDocument(
      loaded.currentPreferences?.theme || DEFAULTS.theme,
      loaded.currentPreferences?.density || DEFAULTS.density
    );

    setIsReady(true);
  }, []);

  useEffect(() => {
    if (!isReady || typeof window === "undefined") return;

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

    applyThemeToDocument(safePreferences.theme, safePreferences.density);
  }, [preferences, profiles, activeProfileId, lastUsedProfileId, isReady]);

  const setThemeValue = useCallback((key, value) => {
    setPreferences((prev) =>
      sanitizePreferences({
        ...prev,
        theme: {
          ...prev.theme,
          [key]: value,
        },
      })
    );
  }, []);

  const setDensity = useCallback((density) => {
    setPreferences((prev) =>
      sanitizePreferences({
        ...prev,
        density,
      })
    );
  }, []);

  const toggleSectionVisibility = useCallback((sectionKey) => {
    setPreferences((prev) =>
      sanitizePreferences({
        ...prev,
        sectionVisibility: {
          ...prev.sectionVisibility,
          [sectionKey]: !prev.sectionVisibility?.[sectionKey],
        },
      })
    );
  }, []);

  const setSectionVisibility = useCallback((sectionKey, value) => {
    setPreferences((prev) =>
      sanitizePreferences({
        ...prev,
        sectionVisibility: {
          ...prev.sectionVisibility,
          [sectionKey]: Boolean(value),
        },
      })
    );
  }, []);

  const moveSection = useCallback((area, fromIndex, toIndex) => {
    setPreferences((prev) => {
      const allowedKeys = area === "home" ? HOME_SECTION_KEYS : MEMBERS_SECTION_KEYS;
      const current = Array.isArray(prev?.layout?.[area])
        ? [...prev.layout[area]]
        : [...allowedKeys];

      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= current.length ||
        toIndex >= current.length ||
        fromIndex === toIndex
      ) {
        return prev;
      }

      const [moved] = current.splice(fromIndex, 1);
      current.splice(toIndex, 0, moved);

      return sanitizePreferences({
        ...prev,
        layout: {
          ...prev.layout,
          [area]: current,
        },
      });
    });
  }, []);

  const resetPreferences = useCallback(() => {
    setPreferences(clonePreferences(DEFAULTS));
  }, []);

  const getProfileById = useCallback(
    (profileId) => profiles.find((profile) => profile.id === profileId) || null,
    [profiles]
  );

  const saveProfile = useCallback(
    (profileId, nextName) => {
      const target = getProfileById(profileId);
      if (!target) return false;

      const now = new Date().toISOString();
      const safeName = String(nextName || target.name || `Profile ${target.slot}`).trim();

      setProfiles((prev) =>
        sanitizeProfiles(
          prev.map((profile) =>
            profile.id === profileId
              ? {
                  ...profile,
                  name: safeName || `Profile ${profile.slot}`,
                  isEmpty: false,
                  preferences: clonePreferences(sanitizePreferences(preferences)),
                  updatedAt: now,
                }
              : profile
          )
        )
      );

      setActiveProfileId(profileId);
      setLastUsedProfileId(profileId);
      return true;
    },
    [getProfileById, preferences]
  );

  const loadProfile = useCallback(
    (profileId) => {
      const target = getProfileById(profileId);
      if (!target) return false;

      const nextPreferences = sanitizePreferences(target.preferences);
      setPreferences(nextPreferences);
      setActiveProfileId(profileId);
      setLastUsedProfileId(profileId);
      return true;
    },
    [getProfileById]
  );

  const renameProfile = useCallback((profileId, nextName) => {
    const cleaned = String(nextName || "").trim();
    if (!cleaned) return false;

    setProfiles((prev) =>
      sanitizeProfiles(
        prev.map((profile) =>
          profile.id === profileId
            ? {
                ...profile,
                name: cleaned,
              }
            : profile
        )
      )
    );

    return true;
  }, []);

  const deleteProfile = useCallback(
    (profileId) => {
      const target = getProfileById(profileId);
      if (!target) return false;

      const fallbackId = "profile-1";

      setProfiles((prev) =>
        sanitizeProfiles(
          prev.map((profile) =>
            profile.id === profileId
              ? {
                  ...profile,
                  name: `Profile ${profile.slot}`,
                  isEmpty: profile.id !== fallbackId,
                  preferences: clonePreferences(DEFAULTS),
                  updatedAt: profile.id === fallbackId ? new Date().toISOString() : null,
                }
              : profile
          )
        )
      );

      if (profileId === fallbackId) {
        setPreferences(clonePreferences(DEFAULTS));
        setActiveProfileId(fallbackId);
        setLastUsedProfileId(fallbackId);
        return true;
      }

      if (activeProfileId === profileId || lastUsedProfileId === profileId) {
        const fallbackProfile = getProfileById(fallbackId);

        setPreferences(
          sanitizePreferences(fallbackProfile?.preferences || DEFAULTS)
        );
        setActiveProfileId(fallbackId);
        setLastUsedProfileId(fallbackId);
      }

      return true;
    },
    [activeProfileId, getProfileById, lastUsedProfileId]
  );

  const saveActiveProfile = useCallback(
    (nextName) => saveProfile(activeProfileId, nextName),
    [activeProfileId, saveProfile]
  );

  const activeProfile = useMemo(
    () => profiles.find((profile) => profile.id === activeProfileId) || null,
    [profiles, activeProfileId]
  );

  const lastUsedProfile = useMemo(
    () => profiles.find((profile) => profile.id === lastUsedProfileId) || null,
    [profiles, lastUsedProfileId]
  );

  return useMemo(
    () => ({
      preferences,
      isReady,
      profiles,
      activeProfileId,
      activeProfile,
      lastUsedProfileId,
      lastUsedProfile,
      maxProfiles: MAX_PROFILES,
      setThemeValue,
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
    }),
    [
      preferences,
      isReady,
      profiles,
      activeProfileId,
      activeProfile,
      lastUsedProfileId,
      lastUsedProfile,
      setThemeValue,
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
    ]
  );
}

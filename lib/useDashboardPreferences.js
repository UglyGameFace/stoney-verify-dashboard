"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "stoney_dashboard_preferences_v2";
const MAX_PROFILES = 5;

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

function clonePreferences(preferences) {
  return JSON.parse(JSON.stringify(preferences));
}

function sanitizePreferences(preferences) {
  return deepMerge(DEFAULTS, preferences || {});
}

function buildDefaultProfiles() {
  return Array.from({ length: MAX_PROFILES }, (_, index) => ({
    id: `profile-${index + 1}`,
    slot: index + 1,
    name: `Profile ${index + 1}`,
    isEmpty: index !== 0,
    preferences: clonePreferences(DEFAULTS),
    updatedAt: null,
  }));
}

function sanitizeProfiles(rawProfiles) {
  const defaults = buildDefaultProfiles();
  const incoming = Array.isArray(rawProfiles) ? rawProfiles : [];

  return defaults.map((fallbackProfile, index) => {
    const raw = incoming[index];
    if (!raw || typeof raw !== "object") {
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
  if (!parsed || typeof parsed !== "object") {
    const profiles = buildDefaultProfiles();
    return {
      currentPreferences: clonePreferences(DEFAULTS),
      activeProfileId: profiles[0].id,
      lastUsedProfileId: profiles[0].id,
      profiles,
    };
  }

  if ("currentPreferences" in parsed || "profiles" in parsed) {
    const profiles = sanitizeProfiles(parsed.profiles);
    const fallbackActive = profiles[0]?.id || "profile-1";

    const activeProfileId = profiles.some((p) => p.id === parsed.activeProfileId)
      ? parsed.activeProfileId
      : fallbackActive;

    const lastUsedProfileId = profiles.some((p) => p.id === parsed.lastUsedProfileId)
      ? parsed.lastUsedProfileId
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
  profiles[0] = {
    ...profiles[0],
    isEmpty: false,
    preferences: sanitizePreferences(parsed),
    updatedAt: new Date().toISOString(),
  };

  return {
    currentPreferences: sanitizePreferences(parsed),
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
  const [profiles, setProfiles] = useState(buildDefaultProfiles());
  const [activeProfileId, setActiveProfileId] = useState("profile-1");
  const [lastUsedProfileId, setLastUsedProfileId] = useState("profile-1");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const loaded = loadStoredState();

    setPreferences(loaded.currentPreferences);
    setProfiles(loaded.profiles);
    setActiveProfileId(loaded.activeProfileId);
    setLastUsedProfileId(loaded.lastUsedProfileId);

    applyThemeToDocument(
      loaded.currentPreferences.theme,
      loaded.currentPreferences.density
    );

    setIsReady(true);
  }, []);

  useEffect(() => {
    if (!isReady || typeof window === "undefined") return;

    const payload = {
      currentPreferences: preferences,
      activeProfileId,
      lastUsedProfileId,
      profiles,
    };

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore localStorage errors
    }

    applyThemeToDocument(preferences.theme, preferences.density);
  }, [preferences, profiles, activeProfileId, lastUsedProfileId, isReady]);

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
        prev.map((profile) =>
          profile.id === profileId
            ? {
                ...profile,
                name: safeName || `Profile ${profile.slot}`,
                isEmpty: false,
                preferences: clonePreferences(preferences),
                updatedAt: now,
              }
            : profile
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
      prev.map((profile) =>
        profile.id === profileId
          ? {
              ...profile,
              name: cleaned,
            }
          : profile
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
        prev.map((profile) =>
          profile.id === profileId
            ? {
                ...profile,
                name: `Profile ${profile.slot}`,
                isEmpty: true,
                preferences: clonePreferences(DEFAULTS),
                updatedAt: null,
              }
            : profile
        )
      );

      if (activeProfileId === profileId || lastUsedProfileId === profileId) {
        const fallbackProfile =
          profileId === fallbackId
            ? {
                id: fallbackId,
                preferences: clonePreferences(DEFAULTS),
              }
            : getProfileById(fallbackId);

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

  const api = useMemo(
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

  return api;
}

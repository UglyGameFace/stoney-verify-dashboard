"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const SECTION_LABELS = {
  intelligence: "Moderator Intelligence",
  stats: "Stat Cards",
  quickActions: "Quick Actions",
  activity: "Activity Feed",
  warns: "Warn Intelligence",
  raids: "Raid Intelligence",
  fraud: "Fraud Intelligence",
  freshEntrants: "Fresh Entrants",
  memberSnapshot: "Member Snapshot",
  staffMetrics: "Staff Metrics",
  roleHierarchy: "Role Hierarchy",
  memberSearch: "Member Search",
  categories: "Categories",
};

const DEFAULT_THEME = {
  accent: "#45d483",
  accent2: "#3b82f6",
  textStrong: "#f8fafc",
  textMuted: "#b8c0cc",
  effectsMode: "full",
};

const DENSITY_OPTIONS = {
  compact: "Compact",
  comfortable: "Comfortable",
  spacious: "Spacious",
};

const EFFECTS_MODES = {
  full: "Full",
  reduced: "Reduced",
  minimal: "Minimal",
};

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function formatUpdatedAt(value) {
  if (!value) return "Never saved";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "Never saved";
  }
}

function normalizeTheme(theme) {
  return {
    ...DEFAULT_THEME,
    ...(theme || {}),
    effectsMode:
      theme?.effectsMode === "reduced" || theme?.effectsMode === "minimal"
        ? theme.effectsMode
        : "full",
  };
}

function themesEqual(a, b) {
  return (
    a.accent === b.accent &&
    a.accent2 === b.accent2 &&
    a.textStrong === b.textStrong &&
    a.textMuted === b.textMuted &&
    a.effectsMode === b.effectsMode
  );
}

function preserveScrollPosition(fn) {
  if (typeof window === "undefined") {
    fn();
    return;
  }

  const root = document.scrollingElement || document.documentElement;
  const pageX = window.scrollX;
  const pageY = window.scrollY;
  const activeEl = document.activeElement;

  fn();

  requestAnimationFrame(() => {
    if (root) {
      root.scrollTop = pageY;
      root.scrollLeft = pageX;
    }
    window.scrollTo(pageX, pageY);

    if (
      activeEl &&
      typeof activeEl.focus === "function" &&
      document.contains(activeEl)
    ) {
      try {
        activeEl.focus({ preventScroll: true });
      } catch {
        try {
          activeEl.focus();
        } catch {
          // ignore
        }
      }
    }
  });
}

function useCompactSettingsLayout(breakpoint = 900) {
  const [isCompact, setIsCompact] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth <= breakpoint;
  });

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const update = () => setIsCompact(window.innerWidth <= breakpoint);
    update();

    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, [breakpoint]);

  return isCompact;
}

function useFlashMessage() {
  const [message, setMessage] = useState("");
  const timerRef = useRef(null);

  const flash = useCallback((text) => {
    setMessage(text);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setMessage(""), 2200);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return [message, flash];
}

function usePreventBodyScroll(open) {
  useEffect(() => {
    if (!open) return undefined;

    const html = document.documentElement;
    const body = document.body;

    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevBodyTouchAction = body.style.touchAction;

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.touchAction = "none";

    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      body.style.touchAction = prevBodyTouchAction;
    };
  }, [open]);
}

function focusWithoutScroll(node) {
  if (!node || typeof node.focus !== "function") return;
  try {
    node.focus({ preventScroll: true });
  } catch {
    try {
      node.focus();
    } catch {
      // ignore
    }
  }
}

function useModalKeyboard(open, onClose, panelRef) {
  const previousFocusRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    previousFocusRef.current = document.activeElement;

    const panel = panelRef?.current;

    requestAnimationFrame(() => {
      if (!panel) return;
      focusWithoutScroll(panel);
    });

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose?.();
        return;
      }

      if (e.key !== "Tab" || !panel) return;

      const nodes = Array.from(
        panel.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter(
        (el) =>
          !el.hasAttribute("disabled") &&
          el.getAttribute("aria-hidden") !== "true"
      );

      if (!nodes.length) return;

      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;

      if (e.shiftKey) {
        if (active === first || !panel.contains(active)) {
          e.preventDefault();
          focusWithoutScroll(last);
        }
      } else if (active === last) {
        e.preventDefault();
        focusWithoutScroll(first);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);

      if (
        previousFocusRef.current &&
        typeof previousFocusRef.current.focus === "function" &&
        document.contains(previousFocusRef.current)
      ) {
        focusWithoutScroll(previousFocusRef.current);
      }
    };
  }, [open, onClose, panelRef]);
}

function ToneSwatch({ label, value, onChange, helper }) {
  const inputRef = useRef(null);

  return (
    <div className="settings-lab-card">
      <div className="ticket-info-label">{label}</div>

      <input
        ref={inputRef}
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="settings-color-input-hidden"
        tabIndex={-1}
        aria-hidden="true"
      />

      <button
        type="button"
        className="settings-color-trigger"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        aria-label={`Choose ${label} color`}
      >
        <span
          className="settings-color-preview"
          style={{ background: value }}
        />
        <span className="settings-color-trigger-text">
          {String(value || "").toUpperCase()}
        </span>
      </button>

      {helper ? <div className="muted settings-helper-copy">{helper}</div> : null}
    </div>
  );
}

function VisibilityPill({ label, active, onToggle }) {
  return (
    <button
      type="button"
      className={`settings-pill ${active ? "active" : ""}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onToggle}
      aria-pressed={active}
    >
      <span className="settings-pill-label">{label}</span>
      <span className={`settings-pill-badge ${active ? "active" : ""}`}>
        {active ? "Shown" : "Hidden"}
      </span>
    </button>
  );
}

function SectionVisibilityList({ title, keys, visibility, onToggle }) {
  return (
    <div className="settings-section-card">
      <div className="settings-section-heading">
        <div>
          <div className="settings-chip-row">
            <span className="section-chip">Visibility</span>
          </div>
          <div className="settings-title-sm">{title}</div>
        </div>
      </div>

      <div className="settings-pill-grid">
        {keys.map((key) => (
          <VisibilityPill
            key={key}
            label={SECTION_LABELS[key] || key}
            active={!!visibility[key]}
            onToggle={() => onToggle(key)}
          />
        ))}
      </div>
    </div>
  );
}

function MoveButtons({ area, items, onMove }) {
  return (
    <div className="settings-section-card">
      <div className="settings-section-heading">
        <div>
          <div className="settings-chip-row">
            <span className="section-chip">Layout Order</span>
          </div>
          <div className="settings-title-sm">
            {area === "home" ? "Home Layout Order" : "Members Layout Order"}
          </div>
        </div>
      </div>

      <div className="space">
        {items.map((item, index) => (
          <div key={`${area}-${item}`} className="settings-move-card">
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="settings-move-label">
                {SECTION_LABELS[item] || item}
              </div>
              <div className="muted settings-helper-copy">Position {index + 1}</div>
            </div>

            <div className="settings-move-actions">
              <button
                type="button"
                className="button ghost settings-mini-btn"
                disabled={index === 0}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onMove(area, index, index - 1)}
                aria-label="Move up"
              >
                ↑
              </button>

              <button
                type="button"
                className="button ghost settings-mini-btn"
                disabled={index === items.length - 1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onMove(area, index, index + 1)}
                aria-label="Move down"
              >
                ↓
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DensityPreview({ active, label, helper, onClick }) {
  return (
    <button
      type="button"
      className={`density-preview ${active ? "active" : ""}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      aria-pressed={active}
    >
      <div className="density-preview-bars">
        <span />
        <span />
        <span />
      </div>
      <div className="density-preview-title">{label}</div>
      <div className="muted settings-helper-copy">{helper}</div>
    </button>
  );
}

function EffectsModeCard({ active, label, helper, onClick }) {
  return (
    <button
      type="button"
      className={`density-preview ${active ? "active" : ""}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      aria-pressed={active}
    >
      <div className="density-preview-bars effects-bars">
        <span />
        <span />
        <span />
      </div>
      <div className="density-preview-title">{label}</div>
      <div className="muted settings-helper-copy">{helper}</div>
    </button>
  );
}

function ProfileCard({
  profile,
  isActive,
  isLastUsed,
  onLoad,
  onSave,
  onRename,
  onDelete,
}) {
  const [renameValue, setRenameValue] = useState(profile.name || "");

  useEffect(() => {
    setRenameValue(profile.name || "");
  }, [profile.name]);

  const handleRename = () => {
    const next = String(renameValue || "").trim();
    if (next) onRename(profile.id, next);
  };

  const handleSave = () => {
    onSave(profile.id, String(renameValue || "").trim());
  };

  return (
    <div className={`profile-slot-card ${isActive ? "active" : ""}`}>
      <div className="settings-chip-row" style={{ marginBottom: 8 }}>
        <span className="section-chip">Slot {profile.slot}</span>
        {isActive ? <span className="badge claimed">Active</span> : null}
        {isLastUsed ? <span className="badge low">Last Used</span> : null}
        {profile.isEmpty ? <span className="badge medium">Empty</span> : null}
      </div>

      <div className="profile-slot-title">{profile.name}</div>
      <div className="muted settings-helper-copy" style={{ marginTop: 6 }}>
        {formatUpdatedAt(profile.updatedAt)}
      </div>

      <div className="settings-profile-rename-row">
        <input
          className="input"
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleRename();
          }}
          placeholder={`Profile ${profile.slot}`}
          aria-label="Profile name"
        />

        <button
          type="button"
          className="button ghost"
          style={{ width: "auto", minWidth: 96 }}
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleRename}
        >
          Rename
        </button>
      </div>

      <div className="settings-profile-action-row">
        <button
          type="button"
          className={isActive ? "button" : "button ghost"}
          style={{ width: "auto", minWidth: 96 }}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onLoad(profile.id)}
        >
          Load
        </button>

        <button
          type="button"
          className="button ghost"
          style={{ width: "auto", minWidth: 118 }}
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleSave}
        >
          Save Current
        </button>

        <button
          type="button"
          className="button danger"
          style={{ width: "auto", minWidth: 96 }}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onDelete(profile.id)}
        >
          Clear
        </button>
      </div>
    </div>
  );
}

function SettingsAccordion({ title, chip, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="settings-accordion">
      <button
        type="button"
        className="settings-accordion-head"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        <div>
          <div className="settings-chip-row">
            <span className="section-chip">{chip}</span>
          </div>
          <div className="settings-title-sm">{title}</div>
        </div>

        <span className={`settings-accordion-chevron ${open ? "open" : ""}`}>
          ⌄
        </span>
      </button>

      {open ? <div className="settings-accordion-body">{children}</div> : null}
    </div>
  );
}

function DraftThemePanel({
  draftTheme,
  baselineTheme,
  setDraftThemeValue,
  applyDraftTheme,
  resetDraftTheme,
  hasDraftChanges,
}) {
  return (
    <div className="settings-section-card">
      <div className="settings-section-heading">
        <div>
          <div className="settings-chip-row">
            <span className="section-chip">Color Engine</span>
            {hasDraftChanges ? <span className="badge medium">Draft Changes</span> : null}
          </div>
          <div className="settings-title-sm">Neon Palette</div>
        </div>

        <div className="settings-head-actions">
          <button
            type="button"
            className="button ghost"
            style={{ width: "auto", minWidth: 96 }}
            disabled={!hasDraftChanges}
            onMouseDown={(e) => e.preventDefault()}
            onClick={resetDraftTheme}
          >
            Reset
          </button>

          <button
            type="button"
            className="button"
            style={{ width: "auto", minWidth: 96 }}
            disabled={!hasDraftChanges}
            onMouseDown={(e) => e.preventDefault()}
            onClick={applyDraftTheme}
          >
            Apply
          </button>
        </div>
      </div>

      <div className="settings-theme-grid">
        <ToneSwatch
          label="Accent"
          value={draftTheme.accent}
          onChange={(value) => setDraftThemeValue("accent", value)}
          helper="Main green glow and primary dashboard energy."
        />
        <ToneSwatch
          label="Accent 2"
          value={draftTheme.accent2}
          onChange={(value) => setDraftThemeValue("accent2", value)}
          helper="Secondary neon balance for haze and highlights."
        />
        <ToneSwatch
          label="Primary Text"
          value={draftTheme.textStrong}
          onChange={(value) => setDraftThemeValue("textStrong", value)}
          helper="High-contrast headline and card text."
        />
        <ToneSwatch
          label="Muted Text"
          value={draftTheme.textMuted}
          onChange={(value) => setDraftThemeValue("textMuted", value)}
          helper="Subtext, labels, and helper copy."
        />
      </div>

      <div className="settings-effects-wrap">
        <div className="settings-title-sm" style={{ fontSize: 16, marginBottom: 10 }}>
          Effects Mode
        </div>

        <div className="settings-density-grid">
          {Object.entries(EFFECTS_MODES).map(([mode, label]) => (
            <EffectsModeCard
              key={mode}
              active={draftTheme.effectsMode === mode}
              label={label}
              helper={
                mode === "full"
                  ? "Maximum glow, blur, and visual atmosphere."
                  : mode === "reduced"
                    ? "Less extra glow and softer visual effects for cheaper devices."
                    : "Lowest visual overhead. Best for weak phones or laggy browsers."
              }
              onClick={() => setDraftThemeValue("effectsMode", mode)}
            />
          ))}
        </div>
      </div>

      <div className={`settings-preview-stage effects-${draftTheme.effectsMode}`}>
        <div className="settings-preview-card">
          <div className="settings-preview-title">Live Mood Preview</div>
          <div className="settings-preview-sub">
            Draft preview only. Colors and effects apply when you press{" "}
            <strong>Apply</strong>.
          </div>

          <div className="settings-preview-chip-row">
            <span className="badge low">Verified</span>
            <span className="badge claimed">Claimed</span>
            <span className="badge open">Open</span>
            <span className="badge danger">High Risk</span>
          </div>

          <div className="settings-preview-swatch-grid">
            <div className="settings-preview-swatch">
              <span>Accent</span>
              <code>{draftTheme.accent}</code>
            </div>
            <div className="settings-preview-swatch">
              <span>Accent 2</span>
              <code>{draftTheme.accent2}</code>
            </div>
            <div className="settings-preview-swatch">
              <span>Primary Text</span>
              <code>{draftTheme.textStrong}</code>
            </div>
            <div className="settings-preview-swatch">
              <span>Muted Text</span>
              <code>{draftTheme.textMuted}</code>
            </div>
          </div>

          <div className="muted settings-helper-copy" style={{ marginTop: 12 }}>
            Current applied effects mode: <strong>{baselineTheme.effectsMode}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardSettingsPanel({
  open,
  onClose,
  preferences,
  profiles = [],
  activeProfileId,
  lastUsedProfileId,
  setThemeValue,
  setDensity,
  toggleSectionVisibility,
  moveSection,
  resetPreferences,
  saveProfile,
  saveActiveProfile,
  loadProfile,
  renameProfile,
  deleteProfile,
}) {
  const [message, flashMessage] = useFlashMessage();
  const isCompact = useCompactSettingsLayout(900);
  const panelRef = useRef(null);
  const scrollRef = useRef(0);

  const homeKeys = useMemo(
    () => safeArray(preferences?.layout?.home),
    [preferences?.layout?.home]
  );
  const membersKeys = useMemo(
    () => safeArray(preferences?.layout?.members),
    [preferences?.layout?.members]
  );
  const visibility = useMemo(
    () => preferences?.sectionVisibility || {},
    [preferences?.sectionVisibility]
  );

  const baselineTheme = useMemo(
    () => normalizeTheme(preferences?.theme),
    [preferences?.theme]
  );

  const [draftTheme, setDraftTheme] = useState(baselineTheme);

  const sortedProfiles = useMemo(() => {
    return [...safeArray(profiles)]
      .filter(Boolean)
      .sort((a, b) => (a.slot || 0) - (b.slot || 0));
  }, [profiles]);

  const hasDraftChanges = useMemo(
    () => !themesEqual(draftTheme, baselineTheme),
    [draftTheme, baselineTheme]
  );

  useEffect(() => {
    if (open) {
      setDraftTheme(normalizeTheme(preferences?.theme));
    }
  }, [open, preferences?.theme]);

  useEffect(() => {
    if (!open) return undefined;
    const panel = panelRef.current;
    if (!panel) return undefined;

    const onScroll = () => {
      scrollRef.current = panel.scrollTop;
    };

    panel.addEventListener("scroll", onScroll, { passive: true });
    return () => panel.removeEventListener("scroll", onScroll);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;

    requestAnimationFrame(() => {
      panel.scrollTop = scrollRef.current || 0;
    });
  }, [
    open,
    draftTheme,
    preferences?.density,
    preferences?.layout?.home,
    preferences?.layout?.members,
    preferences?.sectionVisibility,
    profiles,
  ]);

  usePreventBodyScroll(open);
  useModalKeyboard(open, onClose, panelRef);

  const noopToggleSectionVisibility = useCallback(() => {}, []);
  const noopMoveSection = useCallback(() => {}, []);
  const noopSetDensity = useCallback(() => {}, []);

  const setDraftThemeValue = useCallback((key, value) => {
    preserveScrollPosition(() => {
      setDraftTheme((prev) => ({ ...prev, [key]: value }));
    });
  }, []);

  const applyDraftTheme = useCallback(() => {
    const next = normalizeTheme(draftTheme);

    preserveScrollPosition(() => {
      if (setThemeValue) {
        setThemeValue("accent", next.accent);
        setThemeValue("accent2", next.accent2);
        setThemeValue("textStrong", next.textStrong);
        setThemeValue("textMuted", next.textMuted);
        setThemeValue("effectsMode", next.effectsMode);
      }
    });

    flashMessage("Theme draft applied.");
  }, [draftTheme, setThemeValue, flashMessage]);

  const resetDraftTheme = useCallback(() => {
    preserveScrollPosition(() => {
      setDraftTheme(normalizeTheme(preferences?.theme));
    });
    flashMessage("Draft reset to current applied theme.");
  }, [preferences?.theme, flashMessage]);

  const handleRename = useCallback(
    (profileId, nextName) => {
      preserveScrollPosition(() => {
        const ok = renameProfile?.(profileId, nextName);
        flashMessage(ok ? "Profile renamed." : "Enter a valid profile name.");
      });
    },
    [renameProfile, flashMessage]
  );

  const handleSave = useCallback(
    (profileId, nextName) => {
      preserveScrollPosition(() => {
        const ok = saveProfile?.(profileId, nextName);
        flashMessage(ok ? "Profile saved." : "Unable to save profile.");
      });
    },
    [saveProfile, flashMessage]
  );

  const handleLoad = useCallback(
    (profileId) => {
      const target = sortedProfiles.find((profile) => profile.id === profileId) || null;

      preserveScrollPosition(() => {
        const ok = loadProfile?.(profileId);
        if (ok && target?.preferences?.theme) {
          setDraftTheme(normalizeTheme(target.preferences.theme));
        }
        flashMessage(ok ? "Profile loaded." : "Unable to load profile.");
      });
    },
    [loadProfile, sortedProfiles, flashMessage]
  );

  const handleDelete = useCallback(
    (profileId) => {
      preserveScrollPosition(() => {
        const ok = deleteProfile?.(profileId);
        flashMessage(ok ? "Profile cleared." : "Unable to clear profile.");
      });
    },
    [deleteProfile, flashMessage]
  );

  const handleQuickSave = useCallback(() => {
    preserveScrollPosition(() => {
      const ok = saveActiveProfile?.();
      flashMessage(ok ? "Active profile saved." : "Unable to save active profile.");
    });
  }, [saveActiveProfile, flashMessage]);

  const handleResetCurrent = useCallback(() => {
    preserveScrollPosition(() => {
      resetPreferences?.();
    });
    flashMessage("Current preferences reset.");
  }, [resetPreferences, flashMessage]);

  const handleDensityChange = useCallback(
    (density) => {
      preserveScrollPosition(() => {
        (setDensity || noopSetDensity)(density);
      });
      flashMessage(`Layout feel set to ${String(density)}.`);
    },
    [setDensity, noopSetDensity, flashMessage]
  );

  const handleToggleVisibility = useCallback(
    (key) => {
      preserveScrollPosition(() => {
        (toggleSectionVisibility || noopToggleSectionVisibility)(key);
      });
    },
    [toggleSectionVisibility, noopToggleSectionVisibility]
  );

  const handleMoveSection = useCallback(
    (area, from, to) => {
      preserveScrollPosition(() => {
        (moveSection || noopMoveSection)(area, from, to);
      });
    },
    [moveSection, noopMoveSection]
  );

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Dashboard personalization"
      className="settings-overlay"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        className="settings-sheet"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        <div className="settings-sheet-handle" />

        <div className="settings-head">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="settings-chip-row" style={{ marginBottom: 10 }}>
              <span className="section-chip">420 Theme Lab</span>
              <span className="badge claimed">Customization Studio</span>
              {hasDraftChanges ? <span className="badge medium">Unsaved Draft</span> : null}
            </div>

            <div className="settings-title-lg">Dashboard Personalization</div>

            <div className="muted settings-head-copy">
              Cleaner opening behavior, lower device strain, draft-based theme editing,
              and smoother control over how heavy the visuals feel on weaker phones.
            </div>
          </div>

          <div className="settings-head-actions">
            <button
              type="button"
              className="button ghost"
              style={{ width: "auto", minWidth: 132 }}
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleQuickSave}
            >
              Save Active
            </button>

            <button
              type="button"
              className="button ghost"
              style={{ width: "auto", minWidth: 124 }}
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleResetCurrent}
            >
              Reset Current
            </button>

            <button
              type="button"
              className="button ghost"
              style={{ width: "auto", minWidth: 110 }}
              onMouseDown={(e) => e.preventDefault()}
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>

        {message ? (
          <div className="info-banner" style={{ marginBottom: 14 }} role="status">
            {message}
          </div>
        ) : null}

        <div className="settings-content-stack">
          {isCompact ? (
            <>
              <SettingsAccordion title="Profile Slots" chip="Saved Looks" defaultOpen>
                <div className="settings-profile-grid">
                  {sortedProfiles.map((profile) => (
                    <ProfileCard
                      key={profile.id}
                      profile={profile}
                      isActive={profile.id === activeProfileId}
                      isLastUsed={profile.id === lastUsedProfileId}
                      onLoad={handleLoad}
                      onSave={handleSave}
                      onRename={handleRename}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </SettingsAccordion>

              <SettingsAccordion title="Neon Palette + Effects" chip="Color Engine" defaultOpen>
                <DraftThemePanel
                  draftTheme={draftTheme}
                  baselineTheme={baselineTheme}
                  setDraftThemeValue={setDraftThemeValue}
                  applyDraftTheme={applyDraftTheme}
                  resetDraftTheme={resetDraftTheme}
                  hasDraftChanges={hasDraftChanges}
                />
              </SettingsAccordion>

              <SettingsAccordion title="Density" chip="Layout Feel" defaultOpen>
                <div className="settings-density-grid">
                  {Object.entries(DENSITY_OPTIONS).map(([density, label]) => (
                    <DensityPreview
                      key={density}
                      active={preferences?.density === density}
                      label={label}
                      helper={
                        density === "compact"
                          ? "Tighter spacing for more control on one screen."
                          : density === "comfortable"
                            ? "Balanced spacing for daily moderation use."
                            : "More breathing room and stronger visual separation."
                      }
                      onClick={() => handleDensityChange(density)}
                    />
                  ))}
                </div>
              </SettingsAccordion>

              <SettingsAccordion title="Home Visibility" chip="Visibility">
                <SectionVisibilityList
                  title="Home Section Visibility"
                  keys={homeKeys}
                  visibility={visibility}
                  onToggle={handleToggleVisibility}
                />
              </SettingsAccordion>

              <SettingsAccordion title="Members Visibility" chip="Visibility">
                <SectionVisibilityList
                  title="Members Section Visibility"
                  keys={membersKeys}
                  visibility={visibility}
                  onToggle={handleToggleVisibility}
                />
              </SettingsAccordion>

              <SettingsAccordion title="Home Layout Order" chip="Layout Order">
                <MoveButtons
                  area="home"
                  items={homeKeys}
                  onMove={handleMoveSection}
                />
              </SettingsAccordion>

              <SettingsAccordion title="Members Layout Order" chip="Layout Order">
                <MoveButtons
                  area="members"
                  items={membersKeys}
                  onMove={handleMoveSection}
                />
              </SettingsAccordion>
            </>
          ) : (
            <>
              <div className="settings-section-card">
                <div className="settings-section-heading">
                  <div>
                    <div className="settings-chip-row">
                      <span className="section-chip">Saved Looks</span>
                    </div>
                    <div className="settings-title-sm">Profile Slots</div>
                  </div>
                </div>

                <div className="settings-profile-grid">
                  {sortedProfiles.map((profile) => (
                    <ProfileCard
                      key={profile.id}
                      profile={profile}
                      isActive={profile.id === activeProfileId}
                      isLastUsed={profile.id === lastUsedProfileId}
                      onLoad={handleLoad}
                      onSave={handleSave}
                      onRename={handleRename}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </div>

              <DraftThemePanel
                draftTheme={draftTheme}
                baselineTheme={baselineTheme}
                setDraftThemeValue={setDraftThemeValue}
                applyDraftTheme={applyDraftTheme}
                resetDraftTheme={resetDraftTheme}
                hasDraftChanges={hasDraftChanges}
              />

              <div className="settings-section-card">
                <div className="settings-section-heading">
                  <div>
                    <div className="settings-chip-row">
                      <span className="section-chip">Density</span>
                    </div>
                    <div className="settings-title-sm">Layout Feel</div>
                  </div>
                </div>

                <div className="settings-density-grid">
                  {Object.entries(DENSITY_OPTIONS).map(([density, label]) => (
                    <DensityPreview
                      key={density}
                      active={preferences?.density === density}
                      label={label}
                      helper={
                        density === "compact"
                          ? "Tighter spacing for more control on one screen."
                          : density === "comfortable"
                            ? "Balanced spacing for daily moderation use."
                            : "More breathing room and stronger visual separation."
                      }
                      onClick={() => handleDensityChange(density)}
                    />
                  ))}
                </div>
              </div>

              <SectionVisibilityList
                title="Home Section Visibility"
                keys={homeKeys}
                visibility={visibility}
                onToggle={handleToggleVisibility}
              />

              <SectionVisibilityList
                title="Members Section Visibility"
                keys={membersKeys}
                visibility={visibility}
                onToggle={handleToggleVisibility}
              />

              <MoveButtons
                area="home"
                items={homeKeys}
                onMove={handleMoveSection}
              />

              <MoveButtons
                area="members"
                items={membersKeys}
                onMove={handleMoveSection}
              />
            </>
          )}
        </div>

        <style jsx global>{`
          .settings-overlay {
            position: fixed;
            inset: 0;
            z-index: 130;
            background: rgba(8, 12, 18, 0.82);
            display: flex;
            align-items: center;
            justify-content: center;
            padding:
              max(16px, env(safe-area-inset-top, 0px))
              12px
              max(16px, env(safe-area-inset-bottom, 0px));
            overscroll-behavior: contain;
          }

          .settings-sheet {
            width: 100%;
            max-width: 1080px;
            max-height: min(90vh, 920px);
            overflow-y: auto;
            overflow-x: hidden;
            -webkit-overflow-scrolling: touch;
            border-radius: 24px;
            border: 1px solid rgba(90, 255, 180, 0.12);
            background:
              radial-gradient(circle at top left, rgba(69, 212, 131, 0.08), transparent 28%),
              radial-gradient(circle at top right, rgba(59, 130, 246, 0.08), transparent 30%),
              linear-gradient(
                180deg,
                rgba(10, 18, 30, 0.985),
                rgba(6, 12, 22, 0.985)
              );
            box-shadow:
              0 14px 40px rgba(0, 0, 0, 0.34),
              0 0 0 1px rgba(69, 212, 131, 0.04) inset;
            color: var(--text-strong, #f8fafc);
            padding: 14px;
            backdrop-filter: blur(10px);
            outline: none;
            scroll-behavior: auto;
          }

          .settings-sheet-handle {
            width: 52px;
            height: 5px;
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.16);
            margin: 0 auto 14px;
          }

          .settings-head {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 12px;
            margin-bottom: 16px;
            flex-wrap: wrap;
          }

          .settings-head-actions {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
          }

          .settings-title-lg {
            font-weight: 900;
            font-size: 28px;
            line-height: 1.02;
            letter-spacing: -0.04em;
            color: var(--text-strong, #f8fafc);
          }

          .settings-title-sm {
            font-weight: 900;
            font-size: 18px;
            line-height: 1.08;
            letter-spacing: -0.02em;
            color: var(--text-strong, #f8fafc);
          }

          .settings-head-copy {
            margin-top: 8px;
            font-size: 14px;
            line-height: 1.55;
            max-width: 860px;
            color: var(--text-muted, #b8c0cc);
          }

          .settings-chip-row {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
          }

          .settings-helper-copy,
          .muted {
            font-size: 12px;
            line-height: 1.45;
            color: var(--text-muted, #b8c0cc);
          }

          .settings-content-stack {
            display: grid;
            gap: 14px;
          }

          .settings-section-card {
            border: 1px solid rgba(255, 255, 255, 0.08);
            background: rgba(255, 255, 255, 0.025);
            border-radius: 20px;
            padding: 16px;
          }

          .settings-section-heading {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 12px;
            margin-bottom: 12px;
            flex-wrap: wrap;
          }

          .settings-profile-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
            gap: 12px;
          }

          .profile-slot-card {
            border: 1px solid rgba(255, 255, 255, 0.08);
            background: rgba(255, 255, 255, 0.03);
            border-radius: 18px;
            padding: 14px;
          }

          .profile-slot-card.active {
            border-color: rgba(93, 255, 141, 0.22);
            box-shadow: 0 0 0 1px rgba(93, 255, 141, 0.08);
          }

          .profile-slot-title {
            font-weight: 900;
            color: var(--text-strong, #f8fafc);
            overflow-wrap: anywhere;
            font-size: 18px;
            letter-spacing: -0.02em;
          }

          .settings-profile-rename-row {
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 8px;
            margin-top: 12px;
          }

          .settings-profile-action-row {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            margin-top: 10px;
          }

          .settings-theme-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 12px;
          }

          .settings-lab-card {
            border: 1px solid rgba(255, 255, 255, 0.08);
            background: rgba(255, 255, 255, 0.025);
            border-radius: 18px;
            padding: 14px;
          }

          .ticket-info-label {
            color: var(--text-muted, #b8c0cc);
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.02em;
          }

          .settings-color-input-hidden {
            position: absolute;
            opacity: 0;
            pointer-events: none;
            width: 0;
            height: 0;
          }

          .settings-color-trigger {
            margin-top: 12px;
            width: 100%;
            min-height: 56px;
            border-radius: 14px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            background: rgba(255, 255, 255, 0.03);
            padding: 10px 12px;
            display: flex;
            align-items: center;
            gap: 12px;
            color: var(--text-strong, #f8fafc);
            cursor: pointer;
            text-align: left;
          }

          .settings-color-preview {
            width: 34px;
            height: 34px;
            min-width: 34px;
            border-radius: 10px;
            border: 1px solid rgba(255, 255, 255, 0.14);
            box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.12);
          }

          .settings-color-trigger-text {
            font-size: 12px;
            font-weight: 800;
            letter-spacing: 0.04em;
            color: var(--text-strong, #f8fafc);
          }

          .settings-effects-wrap {
            margin-top: 16px;
          }

          .settings-preview-stage {
            margin-top: 14px;
          }

          .settings-preview-card {
            border: 1px solid rgba(255, 255, 255, 0.08);
            background:
              radial-gradient(circle at top left, rgba(69, 212, 131, 0.12), transparent 42%),
              radial-gradient(circle at top right, rgba(59, 130, 246, 0.12), transparent 42%),
              rgba(255, 255, 255, 0.03);
            border-radius: 20px;
            padding: 16px;
            box-shadow: 0 10px 28px rgba(0, 0, 0, 0.18);
            transition: box-shadow 0.18s ease, background 0.18s ease, filter 0.18s ease;
          }

          .effects-reduced .settings-preview-card {
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
            background: rgba(255, 255, 255, 0.03);
            filter: saturate(0.94);
          }

          .effects-minimal .settings-preview-card {
            box-shadow: none;
            background: rgba(255, 255, 255, 0.02);
            filter: saturate(0.88);
          }

          .settings-preview-title {
            font-weight: 900;
            font-size: 18px;
            letter-spacing: -0.02em;
            color: var(--text-strong, #f8fafc);
          }

          .settings-preview-sub {
            margin-top: 6px;
            color: var(--text-muted, rgba(255, 255, 255, 0.72));
            font-size: 13px;
            line-height: 1.5;
          }

          .settings-preview-chip-row {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            margin-top: 12px;
          }

          .settings-preview-swatch-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 10px;
            margin-top: 14px;
          }

          .settings-preview-swatch {
            border: 1px solid rgba(255, 255, 255, 0.08);
            background: rgba(255, 255, 255, 0.025);
            border-radius: 14px;
            padding: 10px 12px;
            display: grid;
            gap: 4px;
          }

          .settings-preview-swatch span {
            font-size: 12px;
            color: var(--text-muted, rgba(255, 255, 255, 0.72));
          }

          .settings-preview-swatch code {
            font-size: 12px;
            font-weight: 800;
            color: var(--text-strong, #f8fafc);
          }

          .settings-density-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 12px;
          }

          .density-preview {
            appearance: none;
            border: 1px solid rgba(255, 255, 255, 0.08);
            background: rgba(255, 255, 255, 0.03);
            border-radius: 18px;
            padding: 14px;
            text-align: left;
            color: var(--text-strong, #f8fafc);
            cursor: pointer;
            transition:
              border-color 0.16s ease,
              transform 0.16s ease,
              box-shadow 0.16s ease;
          }

          .density-preview:hover,
          .density-preview.active {
            border-color: rgba(93, 255, 141, 0.2);
            box-shadow: 0 0 0 1px rgba(93, 255, 141, 0.08);
            transform: translateY(-1px);
          }

          .density-preview-bars {
            display: grid;
            gap: 6px;
            margin-bottom: 12px;
          }

          .density-preview-bars span {
            display: block;
            height: 10px;
            border-radius: 999px;
            background: linear-gradient(
              90deg,
              rgba(93, 255, 141, 0.7),
              rgba(99, 213, 255, 0.7)
            );
          }

          .effects-bars span:nth-child(2) {
            width: 86%;
          }

          .effects-bars span:nth-child(3) {
            width: 72%;
          }

          .density-preview-title {
            font-weight: 900;
            font-size: 18px;
            line-height: 1.05;
            letter-spacing: -0.02em;
            color: var(--text-strong, #f8fafc);
          }

          .settings-pill-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 10px;
          }

          .settings-pill {
            appearance: none;
            width: 100%;
            min-height: 64px;
            border: 1px solid rgba(255, 255, 255, 0.08);
            background: rgba(255, 255, 255, 0.025);
            color: var(--text-strong, #f8fafc);
            border-radius: 18px;
            padding: 12px 14px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
            cursor: pointer;
            text-align: left;
            transition:
              border-color 0.16s ease,
              transform 0.16s ease,
              box-shadow 0.16s ease;
          }

          .settings-pill.active,
          .settings-pill:hover {
            border-color: rgba(93, 255, 141, 0.18);
            box-shadow: 0 0 0 1px rgba(93, 255, 141, 0.08);
            transform: translateY(-1px);
          }

          .settings-pill-label {
            min-width: 0;
            flex: 1;
            overflow-wrap: anywhere;
            font-weight: 800;
            line-height: 1.2;
            color: var(--text-strong, #f8fafc);
          }

          .settings-pill-badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-height: 30px;
            padding: 7px 10px;
            border-radius: 999px;
            font-size: 12px;
            font-weight: 800;
            border: 1px solid rgba(255, 255, 255, 0.1);
            background: rgba(255, 255, 255, 0.06);
            color: var(--text-strong, #f8fafc);
            white-space: nowrap;
          }

          .settings-pill-badge.active {
            background: rgba(93, 255, 141, 0.14);
            border-color: rgba(93, 255, 141, 0.18);
            color: #d9ffe8;
          }

          .settings-move-card {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 12px 14px;
            border-radius: 16px;
            border: 1px solid rgba(255, 255, 255, 0.08);
            background: rgba(255, 255, 255, 0.025);
            flex-wrap: wrap;
          }

          .settings-move-label {
            font-weight: 800;
            color: var(--text-strong, #f8fafc);
          }

          .settings-move-actions {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
          }

          .settings-mini-btn {
            min-width: 58px;
          }

          .settings-accordion {
            border: 1px solid rgba(255, 255, 255, 0.08);
            background: rgba(255, 255, 255, 0.02);
            border-radius: 20px;
            overflow: hidden;
          }

          .settings-accordion-head {
            appearance: none;
            width: 100%;
            border: 0;
            background: transparent;
            color: inherit;
            text-align: left;
            padding: 14px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
            cursor: pointer;
          }

          .settings-accordion-body {
            padding: 0 12px 12px;
          }

          .settings-accordion-chevron {
            font-size: 22px;
            line-height: 1;
            transition: transform 0.16s ease;
            color: var(--text-strong, #f8fafc);
          }

          .settings-accordion-chevron.open {
            transform: rotate(180deg);
          }

          .button,
          .button.ghost,
          .button.danger {
            appearance: none;
            border: 1px solid rgba(255, 255, 255, 0.08);
            background: rgba(255, 255, 255, 0.04);
            color: var(--text-strong, #f8fafc);
            border-radius: 16px;
            padding: 10px 14px;
            font-weight: 800;
            cursor: pointer;
            min-height: 44px;
          }

          .button:hover,
          .button.ghost:hover,
          .button.danger:hover {
            border-color: rgba(93, 255, 141, 0.18);
          }

          .button:disabled,
          .button.ghost:disabled,
          .button.danger:disabled,
          .density-preview:disabled,
          .settings-pill:disabled {
            opacity: 0.55;
            cursor: not-allowed;
          }

          .button.danger {
            background: rgba(170, 55, 80, 0.22);
            border-color: rgba(220, 90, 120, 0.22);
          }

          .input {
            appearance: none;
            width: 100%;
            min-height: 46px;
            border-radius: 14px;
            border: 1px solid rgba(255, 255, 255, 0.08);
            background: rgba(255, 255, 255, 0.03);
            color: var(--text-strong, #f8fafc);
            padding: 0 14px;
            outline: none;
          }

          .input::placeholder {
            color: rgba(184, 192, 204, 0.7);
          }

          .input:focus {
            border-color: rgba(93, 255, 141, 0.2);
            box-shadow: 0 0 0 1px rgba(93, 255, 141, 0.08);
          }

          .badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-height: 24px;
            padding: 4px 10px;
            border-radius: 999px;
            font-size: 11px;
            font-weight: 800;
            letter-spacing: 0.02em;
            border: 1px solid rgba(255, 255, 255, 0.08);
            color: var(--text-strong, #f8fafc);
            background: rgba(255, 255, 255, 0.05);
          }

          .badge.claimed {
            background: rgba(69, 212, 131, 0.14);
            border-color: rgba(69, 212, 131, 0.2);
          }

          .badge.low {
            background: rgba(59, 130, 246, 0.14);
            border-color: rgba(59, 130, 246, 0.2);
          }

          .badge.medium {
            background: rgba(255, 196, 94, 0.14);
            border-color: rgba(255, 196, 94, 0.2);
          }

          .badge.open {
            background: rgba(82, 167, 255, 0.14);
            border-color: rgba(82, 167, 255, 0.2);
          }

          .badge.danger {
            background: rgba(214, 84, 113, 0.18);
            border-color: rgba(214, 84, 113, 0.22);
          }

          .section-chip {
            display: inline-flex;
            align-items: center;
            min-height: 24px;
            padding: 4px 10px;
            border-radius: 999px;
            font-size: 11px;
            font-weight: 800;
            color: #e9fff3;
            background: rgba(69, 212, 131, 0.12);
            border: 1px solid rgba(69, 212, 131, 0.18);
          }

          .info-banner {
            border: 1px solid rgba(69, 212, 131, 0.18);
            background: rgba(69, 212, 131, 0.1);
            color: #ebfff3;
            padding: 12px 14px;
            border-radius: 14px;
            font-weight: 700;
          }

          .space {
            display: grid;
            gap: 10px;
          }

          @media (max-width: 900px) {
            .settings-overlay {
              align-items: stretch;
              justify-content: stretch;
              padding:
                max(10px, env(safe-area-inset-top, 0px))
                8px
                max(10px, env(safe-area-inset-bottom, 0px));
            }

            .settings-sheet {
              max-width: none;
              max-height: none;
              height: 100%;
              border-radius: 22px;
              padding: 12px;
              backdrop-filter: none;
            }

            .settings-title-lg {
              font-size: 24px;
            }

            .settings-profile-grid,
            .settings-theme-grid,
            .settings-density-grid,
            .settings-pill-grid,
            .settings-preview-swatch-grid {
              grid-template-columns: 1fr;
            }

            .settings-profile-rename-row {
              grid-template-columns: 1fr;
            }

            .settings-profile-action-row,
            .settings-head-actions {
              display: grid;
              grid-template-columns: 1fr;
            }

            .settings-head-actions .button,
            .settings-profile-action-row .button {
              width: 100% !important;
              min-width: 0 !important;
            }

            .settings-pill {
              min-height: 72px;
              align-items: flex-start;
              flex-direction: column;
            }

            .settings-pill-badge {
              align-self: flex-start;
            }
          }
        `}</style>
      </div>
    </div>
  );
}

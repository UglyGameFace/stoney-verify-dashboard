"use client";

import { useEffect, useMemo, useState } from "react";

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
  const left = normalizeTheme(a);
  const right = normalizeTheme(b);
  return (
    left.accent === right.accent &&
    left.accent2 === right.accent2 &&
    left.textStrong === right.textStrong &&
    left.textMuted === right.textMuted &&
    left.effectsMode === right.effectsMode
  );
}

function useCompactSettingsLayout(breakpoint = 900) {
  const getValue = () => {
    if (typeof window === "undefined") return false;
    return window.innerWidth <= breakpoint;
  };

  const [isCompact, setIsCompact] = useState(getValue);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const update = () => setIsCompact(getValue());

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

function ToneSwatch({ label, value, onChange, helper }) {
  return (
    <div className="settings-lab-card">
      <div className="ticket-info-label">{label}</div>
      <input
        type="color"
        value={value || "#45d483"}
        onChange={(e) => onChange(e.target.value)}
        className="settings-color-input"
      />
      <div
        className="settings-color-readout"
        style={{ color: "var(--text-strong, #f8fafc)" }}
      >
        {String(value || "").toUpperCase()}
      </div>
      {helper ? <div className="muted settings-helper-copy">{helper}</div> : null}
    </div>
  );
}

function VisibilityPill({ label, active, onToggle }) {
  return (
    <button
      type="button"
      className={`settings-pill ${active ? "active" : ""}`}
      onClick={onToggle}
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
            active={Boolean(visibility?.[key])}
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
                onClick={() => onMove(area, index, index - 1)}
              >
                ↑
              </button>

              <button
                type="button"
                className="button ghost settings-mini-btn"
                disabled={index === items.length - 1}
                onClick={() => onMove(area, index, index + 1)}
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
      onClick={onClick}
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
      onClick={onClick}
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
  const [renameValue, setRenameValue] = useState(profile?.name || "");

  useEffect(() => {
    setRenameValue(profile?.name || "");
  }, [profile?.name]);

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
          placeholder={`Profile ${profile.slot}`}
        />

        <button
          type="button"
          className="button ghost"
          style={{ width: "auto", minWidth: 96 }}
          onClick={() => onRename(profile.id, renameValue)}
        >
          Rename
        </button>
      </div>

      <div className="settings-profile-action-row">
        <button
          type="button"
          className={isActive ? "button" : "button ghost"}
          style={{ width: "auto", minWidth: 96 }}
          onClick={() => onLoad(profile.id)}
        >
          Load
        </button>

        <button
          type="button"
          className="button ghost"
          style={{ width: "auto", minWidth: 118 }}
          onClick={() => onSave(profile.id, renameValue)}
        >
          Save Current
        </button>

        <button
          type="button"
          className="button danger"
          style={{ width: "auto", minWidth: 96 }}
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
        onClick={() => setOpen((prev) => !prev)}
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
            onClick={resetDraftTheme}
          >
            Reset
          </button>

          <button
            type="button"
            className="button"
            style={{ width: "auto", minWidth: 96 }}
            disabled={!hasDraftChanges}
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
          <EffectsModeCard
            active={draftTheme.effectsMode === "full"}
            label="Full"
            helper="Maximum glow, blur, and visual atmosphere."
            onClick={() => setDraftThemeValue("effectsMode", "full")}
          />
          <EffectsModeCard
            active={draftTheme.effectsMode === "reduced"}
            label="Reduced"
            helper="Less extra glow and softer visual effects for cheaper devices."
            onClick={() => setDraftThemeValue("effectsMode", "reduced")}
          />
          <EffectsModeCard
            active={draftTheme.effectsMode === "minimal"}
            label="Minimal"
            helper="Lowest visual overhead. Best for weak phones or laggy browsers."
            onClick={() => setDraftThemeValue("effectsMode", "minimal")}
          />
        </div>
      </div>

      <div
        className={`settings-preview-stage effects-${draftTheme.effectsMode || "full"}`}
      >
        <div className="settings-preview-card">
          <div className="settings-preview-title">Live Mood Preview</div>
          <div className="settings-preview-sub">
            Draft preview only. Colors and effects apply when you press <strong>Apply</strong>.
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
            Current applied effects mode: <strong>{baselineTheme.effectsMode || "full"}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsDesktopContent(props) {
  const {
    sortedProfiles,
    activeProfileId,
    lastUsedProfileId,
    handleLoad,
    handleSave,
    handleRename,
    handleDelete,
    draftTheme,
    baselineTheme,
    setDraftThemeValue,
    applyDraftTheme,
    resetDraftTheme,
    hasDraftChanges,
    preferences,
    setDensity,
  } = props;

  return (
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
          <DensityPreview
            active={preferences?.density === "compact"}
            label="Compact"
            helper="Tighter spacing for more control on one screen."
            onClick={() => setDensity("compact")}
          />
          <DensityPreview
            active={preferences?.density === "comfortable"}
            label="Comfortable"
            helper="Balanced spacing for daily moderation use."
            onClick={() => setDensity("comfortable")}
          />
          <DensityPreview
            active={preferences?.density === "spacious"}
            label="Spacious"
            helper="More breathing room and stronger visual separation."
            onClick={() => setDensity("spacious")}
          />
        </div>
      </div>
    </>
  );
}

function SettingsMobileContent(props) {
  const {
    sortedProfiles,
    activeProfileId,
    lastUsedProfileId,
    handleLoad,
    handleSave,
    handleRename,
    handleDelete,
    draftTheme,
    baselineTheme,
    setDraftThemeValue,
    applyDraftTheme,
    resetDraftTheme,
    hasDraftChanges,
    preferences,
    setDensity,
    homeKeys,
    membersKeys,
    visibility,
    toggleSectionVisibility,
    moveSection,
  } = props;

  return (
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
          <DensityPreview
            active={preferences?.density === "compact"}
            label="Compact"
            helper="Tighter spacing for more control on one screen."
            onClick={() => setDensity("compact")}
          />
          <DensityPreview
            active={preferences?.density === "comfortable"}
            label="Comfortable"
            helper="Balanced spacing for daily moderation use."
            onClick={() => setDensity("comfortable")}
          />
          <DensityPreview
            active={preferences?.density === "spacious"}
            label="Spacious"
            helper="More breathing room and stronger visual separation."
            onClick={() => setDensity("spacious")}
          />
        </div>
      </SettingsAccordion>

      <SettingsAccordion title="Home Visibility" chip="Visibility">
        <SectionVisibilityList
          title="Home Section Visibility"
          keys={homeKeys}
          visibility={visibility}
          onToggle={toggleSectionVisibility}
        />
      </SettingsAccordion>

      <SettingsAccordion title="Members Visibility" chip="Visibility">
        <SectionVisibilityList
          title="Members Section Visibility"
          keys={membersKeys}
          visibility={visibility}
          onToggle={toggleSectionVisibility}
        />
      </SettingsAccordion>

      <SettingsAccordion title="Home Layout Order" chip="Layout Order">
        <MoveButtons area="home" items={homeKeys} onMove={moveSection} />
      </SettingsAccordion>

      <SettingsAccordion title="Members Layout Order" chip="Layout Order">
        <MoveButtons area="members" items={membersKeys} onMove={moveSection} />
      </SettingsAccordion>
    </>
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
  const [message, setMessage] = useState("");
  const isCompact = useCompactSettingsLayout(900);

  const homeKeys = preferences?.layout?.home || [];
  const membersKeys = preferences?.layout?.members || [];
  const visibility = preferences?.sectionVisibility || {};
  const baselineTheme = useMemo(
    () => normalizeTheme(preferences?.theme),
    [preferences?.theme]
  );

  const [draftTheme, setDraftTheme] = useState(baselineTheme);

  const sortedProfiles = useMemo(
    () =>
      safeArray(profiles)
        .slice()
        .sort((a, b) => Number(a.slot || 0) - Number(b.slot || 0)),
    [profiles]
  );

  const hasDraftChanges = useMemo(
    () => !themesEqual(draftTheme, baselineTheme),
    [draftTheme, baselineTheme]
  );

  useEffect(() => {
    if (!open) return;
    setDraftTheme(normalizeTheme(preferences?.theme));
  }, [open, preferences?.theme]);

  useEffect(() => {
    if (!open) return undefined;

    const body = document.body;
    const prevBodyOverflow = body.style.overflow;
    const prevSettingsFlag = body.dataset.settingsOpen || "";

    body.style.overflow = "hidden";
    body.dataset.settingsOpen = "true";

    return () => {
      body.style.overflow = prevBodyOverflow;

      if (prevSettingsFlag) {
        body.dataset.settingsOpen = prevSettingsFlag;
      } else {
        delete body.dataset.settingsOpen;
      }
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose?.();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  function flashMessage(text) {
    setMessage(text);
    if (typeof window !== "undefined") {
      window.clearTimeout(window.__dashboardSettingsMsgTimer);
      window.__dashboardSettingsMsgTimer = window.setTimeout(() => {
        setMessage("");
      }, 2200);
    }
  }

  function setDraftThemeValue(key, value) {
    setDraftTheme((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function applyDraftTheme() {
    const next = normalizeTheme(draftTheme);
    setThemeValue?.("accent", next.accent);
    setThemeValue?.("accent2", next.accent2);
    setThemeValue?.("textStrong", next.textStrong);
    setThemeValue?.("textMuted", next.textMuted);
    setThemeValue?.("effectsMode", next.effectsMode);
    flashMessage("Theme draft applied.");
  }

  function resetDraftTheme() {
    setDraftTheme(normalizeTheme(preferences?.theme));
    flashMessage("Draft reset to current applied theme.");
  }

  function handleRename(profileId, nextName) {
    const ok = renameProfile?.(profileId, nextName);
    flashMessage(ok ? "Profile renamed." : "Enter a valid profile name.");
  }

  function handleSave(profileId, nextName) {
    const ok = saveProfile?.(profileId, nextName);
    flashMessage(ok ? "Profile saved." : "Unable to save profile.");
  }

  function handleLoad(profileId) {
    const ok = loadProfile?.(profileId);
    if (ok) {
      setDraftTheme(normalizeTheme(preferences?.theme));
    }
    flashMessage(ok ? "Profile loaded." : "Unable to load profile.");
  }

  function handleDelete(profileId) {
    const ok = deleteProfile?.(profileId);
    flashMessage(ok ? "Profile cleared." : "Unable to clear profile.");
  }

  function handleQuickSave() {
    const ok = saveActiveProfile?.();
    flashMessage(ok ? "Active profile saved." : "Unable to save active profile.");
  }

  function handleResetCurrent() {
    resetPreferences?.();
    flashMessage("Current preferences reset.");
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Dashboard personalization"
      className="settings-overlay"
      onClick={onClose}
    >
      <div className="settings-sheet" onClick={(e) => e.stopPropagation()}>
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
              onClick={handleQuickSave}
            >
              Save Active
            </button>

            <button
              type="button"
              className="button ghost"
              style={{ width: "auto", minWidth: 124 }}
              onClick={handleResetCurrent}
            >
              Reset Current
            </button>

            <button
              type="button"
              className="button ghost"
              style={{ width: "auto", minWidth: 110 }}
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>

        {message ? (
          <div className="info-banner" style={{ marginBottom: 14 }}>
            {message}
          </div>
        ) : null}

        <div className="settings-content-stack">
          {isCompact ? (
            <SettingsMobileContent
              sortedProfiles={sortedProfiles}
              activeProfileId={activeProfileId}
              lastUsedProfileId={lastUsedProfileId}
              handleLoad={handleLoad}
              handleSave={handleSave}
              handleRename={handleRename}
              handleDelete={handleDelete}
              draftTheme={draftTheme}
              baselineTheme={baselineTheme}
              setDraftThemeValue={setDraftThemeValue}
              applyDraftTheme={applyDraftTheme}
              resetDraftTheme={resetDraftTheme}
              hasDraftChanges={hasDraftChanges}
              preferences={preferences}
              setDensity={setDensity}
              homeKeys={homeKeys}
              membersKeys={membersKeys}
              visibility={visibility}
              toggleSectionVisibility={toggleSectionVisibility}
              moveSection={moveSection}
            />
          ) : (
            <SettingsDesktopContent
              sortedProfiles={sortedProfiles}
              activeProfileId={activeProfileId}
              lastUsedProfileId={lastUsedProfileId}
              handleLoad={handleLoad}
              handleSave={handleSave}
              handleRename={handleRename}
              handleDelete={handleDelete}
              draftTheme={draftTheme}
              baselineTheme={baselineTheme}
              setDraftThemeValue={setDraftThemeValue}
              applyDraftTheme={applyDraftTheme}
              resetDraftTheme={resetDraftTheme}
              hasDraftChanges={hasDraftChanges}
              preferences={preferences}
              setDensity={setDensity}
            />
          )}

          {!isCompact ? (
            <>
              <SectionVisibilityList
                title="Home Section Visibility"
                keys={homeKeys}
                visibility={visibility}
                onToggle={toggleSectionVisibility}
              />

              <SectionVisibilityList
                title="Members Section Visibility"
                keys={membersKeys}
                visibility={visibility}
                onToggle={toggleSectionVisibility}
              />

              <MoveButtons area="home" items={homeKeys} onMove={moveSection} />
              <MoveButtons area="members" items={membersKeys} onMove={moveSection} />
            </>
          ) : null}
        </div>

        <style jsx>{`
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
            overscroll-behavior: contain;
            border-radius: 24px;
            border: 1px solid rgba(255, 255, 255, 0.08);
            background: linear-gradient(
              180deg,
              rgba(18, 27, 39, 0.985),
              rgba(11, 18, 27, 0.985)
            );
            box-shadow: 0 14px 40px rgba(0, 0, 0, 0.34);
            color: var(--text-strong, #f8fafc);
            padding: 14px;
            backdrop-filter: blur(10px);
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
          }

          .settings-title-sm {
            font-weight: 900;
            font-size: 18px;
            line-height: 1.08;
            letter-spacing: -0.02em;
          }

          .settings-head-copy {
            margin-top: 8px;
            font-size: 14px;
            line-height: 1.55;
            max-width: 860px;
          }

          .settings-chip-row {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
          }

          .settings-helper-copy {
            font-size: 12px;
            line-height: 1.45;
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

          .settings-color-input {
            margin-top: 12px;
            width: 100%;
            height: 52px;
            border-radius: 14px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            background: transparent;
            padding: 0;
          }

          .settings-color-readout {
            margin-top: 8px;
            font-size: 12px;
            font-weight: 800;
            letter-spacing: 0.04em;
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
          }

          .effects-reduced .settings-preview-card {
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
            background: rgba(255, 255, 255, 0.03);
          }

          .effects-minimal .settings-preview-card {
            box-shadow: none;
            background: rgba(255, 255, 255, 0.02);
          }

          .settings-preview-title {
            font-weight: 900;
            font-size: 18px;
            letter-spacing: -0.02em;
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
            color: var(--text-muted, rgba(255,255,255,0.72));
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
            -webkit-appearance: none;
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
            -webkit-appearance: none;
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
            color: var(--text);
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
            -webkit-appearance: none;
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
          }

          .settings-accordion-chevron.open {
            transform: rotate(180deg);
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

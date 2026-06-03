"use client";

import { useEffect, useMemo, useState } from "react";
import QuickAppearancePanel from "@/components/dashboard/QuickAppearancePanel";
import {
  HOME_WORKSPACE_KEYS,
  ACTIVITY_WORKSPACE_KEYS,
  MEMBERS_WORKSPACE_KEYS,
} from "@/components/dashboard/workspaceModel";

const HOME_SECTION_KEYS = [...HOME_WORKSPACE_KEYS];
const ACTIVITY_SECTION_KEYS = [...ACTIVITY_WORKSPACE_KEYS];
const MEMBERS_SECTION_KEYS = [...MEMBERS_WORKSPACE_KEYS];

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

const DENSITY_OPTIONS = [
  { id: "compact", label: "Compact", helper: "Shows more on one screen. Best for power users and desktop." },
  { id: "comfortable", label: "Comfortable", helper: "Balanced spacing for daily moderation. Recommended default." },
  { id: "spacious", label: "Spacious", helper: "More breathing room for tablets, touch, and readability." },
];

const COLOR_ROWS = [
  { key: "accent", label: "Main Accent", helper: "Primary buttons, glow, and important actions." },
  { key: "accent2", label: "Second Accent", helper: "Secondary glow and supporting highlights." },
  { key: "textStrong", label: "Main Text", helper: "Headings and strong readable text." },
  { key: "textMuted", label: "Muted Text", helper: "Helper copy, labels, and smaller notes." },
];

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeText(value, fallback = "") {
  const text = String(value || "").trim();
  return text || fallback;
}

function formatUpdatedAt(value) {
  if (!value) return "Never saved";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "Never saved";
  }
}

function useLockBody(open) {
  useEffect(() => {
    if (!open || typeof document === "undefined") return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);
}

function SectionCard({ eyebrow, title, helper, children }) {
  return (
    <section className="advanced-section-card">
      <div className="advanced-section-head">
        <div>
          {eyebrow ? <div className="advanced-eyebrow">{eyebrow}</div> : null}
          <h3>{title}</h3>
          {helper ? <p>{helper}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function Disclosure({ eyebrow, title, helper, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="advanced-disclosure">
      <button type="button" className="advanced-disclosure-head" onClick={() => setOpen((prev) => !prev)} aria-expanded={open}>
        <div>
          {eyebrow ? <div className="advanced-eyebrow">{eyebrow}</div> : null}
          <h3>{title}</h3>
          {helper ? <p>{helper}</p> : null}
        </div>
        <span className={`advanced-chevron ${open ? "open" : ""}`}>⌄</span>
      </button>
      {open ? <div className="advanced-disclosure-body">{children}</div> : null}
    </section>
  );
}

function ProfileCard({ profile, active, lastUsed, onLoad, onSave, onRename, onDelete }) {
  const [name, setName] = useState(profile?.name || "");

  useEffect(() => {
    setName(profile?.name || "");
  }, [profile?.name]);

  return (
    <div className={`advanced-profile-card ${active ? "active" : ""}`}>
      <div className="advanced-profile-top">
        <span>Slot {profile?.slot || "—"}</span>
        {active ? <strong>Active</strong> : null}
        {lastUsed ? <em>Last Used</em> : null}
        {profile?.isEmpty ? <em>Empty</em> : null}
      </div>

      <div className="advanced-profile-title">{safeText(profile?.name, `Profile ${profile?.slot || ""}`)}</div>
      <div className="advanced-muted">{formatUpdatedAt(profile?.updatedAt)}</div>

      <div className="advanced-profile-rename-row">
        <input className="input" value={name} onChange={(event) => setName(event.target.value)} placeholder={`Profile ${profile?.slot || ""}`} />
        <button type="button" className="button ghost" onClick={() => onRename(profile?.id, name)}>Rename</button>
      </div>

      <div className="advanced-profile-actions">
        <button type="button" className={active ? "button" : "button ghost"} onClick={() => onLoad(profile?.id)}>Load</button>
        <button type="button" className="button ghost" onClick={() => onSave(profile?.id, name)}>Save Current</button>
        <button type="button" className="button danger" onClick={() => onDelete(profile?.id)}>Clear</button>
      </div>
    </div>
  );
}

function DensityChooser({ value, onChange }) {
  return (
    <div className="advanced-choice-grid">
      {DENSITY_OPTIONS.map((option) => (
        <button key={option.id} type="button" className={`advanced-choice-card ${value === option.id ? "active" : ""}`} onClick={() => onChange(option.id)}>
          <strong>{option.label}</strong>
          <span>{option.helper}</span>
        </button>
      ))}
    </div>
  );
}

function VisibilityGrid({ title, keys, visibility, onToggle }) {
  return (
    <div className="advanced-subsection">
      <div className="advanced-subtitle">{title}</div>
      <div className="advanced-visibility-grid">
        {keys.map((key) => {
          const active = visibility?.[key] !== false;
          return (
            <button key={key} type="button" className={`advanced-visibility-pill ${active ? "active" : ""}`} onClick={() => onToggle(key)}>
              <span>{SECTION_LABELS[key] || key}</span>
              <strong>{active ? "Shown" : "Hidden"}</strong>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MoveList({ title, area, keys, onMove }) {
  return (
    <div className="advanced-subsection">
      <div className="advanced-subtitle">{title}</div>
      <div className="advanced-move-list">
        {keys.map((key, index) => (
          <div key={`${area}-${key}`} className="advanced-move-row">
            <div>
              <strong>{SECTION_LABELS[key] || key}</strong>
              <span>Position {index + 1}</span>
            </div>
            <div className="advanced-move-actions">
              <button type="button" className="button ghost" disabled={index === 0} onClick={() => onMove(area, index, index - 1)}>↑</button>
              <button type="button" className="button ghost" disabled={index === keys.length - 1} onClick={() => onMove(area, index, index + 1)}>↓</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ManualColorEngine({ theme, setThemeValue }) {
  const effectsMode = safeText(theme?.effectsMode, "reduced");

  return (
    <div className="advanced-manual-grid">
      {COLOR_ROWS.map((row) => (
        <label key={row.key} className="advanced-color-card">
          <span>{row.label}</span>
          <small>{row.helper}</small>
          <div className="advanced-color-row">
            <input type="color" value={safeText(theme?.[row.key], row.key.includes("text") ? "#ffffff" : "#6dff9d")} onChange={(event) => setThemeValue?.(row.key, event.target.value)} />
            <code>{safeText(theme?.[row.key], "—")}</code>
          </div>
        </label>
      ))}

      <div className="advanced-subsection full">
        <div className="advanced-subtitle">Visual Effects</div>
        <div className="advanced-choice-grid">
          {[
            ["full", "Full", "Maximum glow and atmosphere."],
            ["reduced", "Reduced", "Cleaner and easier on phones."],
            ["minimal", "Minimal", "Fastest and least distracting."],
          ].map(([id, label, helper]) => (
            <button key={id} type="button" className={`advanced-choice-card ${effectsMode === id ? "active" : ""}`} onClick={() => setThemeValue?.("effectsMode", id)}>
              <strong>{label}</strong>
              <span>{helper}</span>
            </button>
          ))}
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
  const [message, setMessage] = useState("");
  useLockBody(open);

  const sortedProfiles = useMemo(() => {
    return [...safeArray(profiles)].filter(Boolean).sort((a, b) => (a?.slot || 0) - (b?.slot || 0));
  }, [profiles]);

  const homeKeys = useMemo(() => {
    const fromPrefs = safeArray(preferences?.layout?.home);
    return fromPrefs.length ? fromPrefs : HOME_SECTION_KEYS;
  }, [preferences?.layout?.home]);

  const activityKeys = useMemo(() => {
    const fromPrefs = safeArray(preferences?.layout?.activity);
    return fromPrefs.length ? fromPrefs : ACTIVITY_SECTION_KEYS;
  }, [preferences?.layout?.activity]);

  const membersKeys = useMemo(() => {
    const fromPrefs = safeArray(preferences?.layout?.members);
    return fromPrefs.length ? fromPrefs : MEMBERS_SECTION_KEYS;
  }, [preferences?.layout?.members]);

  const visibility = preferences?.sectionVisibility || {};
  const density = safeText(preferences?.density, "comfortable");
  const theme = preferences?.theme || {};

  function flash(text) {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 2200);
  }

  function handleSaveActive() {
    const ok = saveActiveProfile?.();
    flash(ok ? "Current advanced layout saved." : "Could not save the current layout.");
  }

  function handleReset() {
    resetPreferences?.();
    flash("Advanced customization reset to defaults.");
  }

  function handleProfileAction(fn, success, failure) {
    const ok = fn?.();
    flash(ok ? success : failure);
  }

  if (!open) return null;

  return (
    <div className="advanced-overlay" role="dialog" aria-modal="true" aria-label="Advanced customization" onClick={onClose}>
      <div className="advanced-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="advanced-sheet-handle" />

        <header className="advanced-head">
          <div>
            <div className="advanced-eyebrow">Power User Settings</div>
            <h2>Advanced Customization</h2>
            <p>
              Use the floating Appearance button for simple light/dark/color presets. This panel is for saved looks, dashboard layout, section visibility, and manual theme tuning.
            </p>
          </div>

          <div className="advanced-head-actions">
            <button type="button" className="button ghost" onClick={handleSaveActive}>Save Active Look</button>
            <button type="button" className="button ghost" onClick={handleReset}>Reset Advanced</button>
            <button type="button" className="button primary" onClick={onClose}>Done</button>
          </div>
        </header>

        {message ? <div className="info-banner advanced-message">{message}</div> : null}

        <div className="advanced-stack">
          <SectionCard
            eyebrow="Step 1"
            title="Quick Appearance"
            helper="These are the same simple controls as the floating Appearance button. Start here before touching advanced layout controls."
          >
            <QuickAppearancePanel />
          </SectionCard>

          <SectionCard
            eyebrow="Step 2"
            title="Saved Looks"
            helper="Save different dashboard looks for different devices or staff styles. Example: Mobile High Contrast, Desktop Clean Blue, Compact Staff View."
          >
            <div className="advanced-profile-grid">
              {sortedProfiles.map((profile) => (
                <ProfileCard
                  key={profile.id}
                  profile={profile}
                  active={profile.id === activeProfileId}
                  lastUsed={profile.id === lastUsedProfileId}
                  onLoad={(id) => handleProfileAction(() => loadProfile?.(id), "Saved look loaded.", "Could not load saved look.")}
                  onSave={(id, name) => handleProfileAction(() => saveProfile?.(id, name), "Saved current look.", "Could not save look.")}
                  onRename={(id, name) => handleProfileAction(() => renameProfile?.(id, name), "Saved look renamed.", "Enter a valid look name.")}
                  onDelete={(id) => handleProfileAction(() => deleteProfile?.(id), "Saved look cleared.", "Could not clear look.")}
                />
              ))}
            </div>
          </SectionCard>

          <SectionCard
            eyebrow="Step 3"
            title="Layout Spacing"
            helper="Choose how tight the dashboard feels. This affects mobile, tablet, and desktop spacing."
          >
            <DensityChooser value={density} onChange={(value) => { setDensity?.(value); flash(`Spacing set to ${value}.`); }} />
          </SectionCard>

          <Disclosure
            eyebrow="Optional"
            title="Show / Hide Sections"
            helper="Hide dashboard blocks your staff does not use. You can bring them back any time. Activity is now separate from Home, so logs and risk signals are easier to manage."
          >
            <VisibilityGrid title="Home Workspace" keys={homeKeys} visibility={visibility} onToggle={toggleSectionVisibility || (() => {})} />
            <VisibilityGrid title="Activity Workspace" keys={activityKeys} visibility={visibility} onToggle={toggleSectionVisibility || (() => {})} />
            <VisibilityGrid title="Members Workspace" keys={membersKeys} visibility={visibility} onToggle={toggleSectionVisibility || (() => {})} />
          </Disclosure>

          <Disclosure
            eyebrow="Optional"
            title="Reorder Dashboard"
            helper="Move important sections higher inside each workspace. Home, Activity, and Members now have separate ordering."
          >
            <MoveList title="Home Order" area="home" keys={homeKeys} onMove={moveSection || (() => {})} />
            <MoveList title="Activity Order" area="activity" keys={activityKeys} onMove={moveSection || (() => {})} />
            <MoveList title="Members Order" area="members" keys={membersKeys} onMove={moveSection || (() => {})} />
          </Disclosure>

          <Disclosure
            eyebrow="Advanced"
            title="Manual Color Engine"
            helper="Use this only if presets are not enough. Most servers should use Quick Appearance instead."
          >
            <ManualColorEngine theme={theme} setThemeValue={setThemeValue} />
          </Disclosure>
        </div>
      </div>

      <style jsx global>{`
        .advanced-overlay {
          position: fixed;
          inset: 0;
          z-index: 180;
          background: rgba(2, 6, 10, 0.78);
          display: flex;
          justify-content: center;
          align-items: center;
          padding: max(14px, env(safe-area-inset-top, 0px)) 12px max(14px, env(safe-area-inset-bottom, 0px));
        }

        .advanced-sheet {
          width: min(1120px, 100%);
          max-height: min(92vh, 960px);
          overflow: auto;
          -webkit-overflow-scrolling: touch;
          border: 1px solid rgba(255,255,255,0.18);
          border-radius: 26px;
          background:
            radial-gradient(circle at top left, color-mix(in srgb, var(--accent, #6dff9d) 9%, transparent), transparent 28%),
            radial-gradient(circle at top right, color-mix(in srgb, var(--accent-2, #78ddff) 10%, transparent), transparent 30%),
            rgba(8, 16, 24, 0.98);
          color: var(--text-strong, #fff);
          box-shadow: 0 24px 74px rgba(0,0,0,0.46);
          padding: 16px;
        }

        .advanced-sheet-handle {
          width: 56px;
          height: 5px;
          border-radius: 999px;
          background: rgba(255,255,255,0.18);
          margin: 0 auto 14px;
        }

        .advanced-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 14px;
          flex-wrap: wrap;
          margin-bottom: 14px;
        }

        .advanced-head h2 {
          margin: 0;
          font-size: clamp(28px, 5vw, 42px);
          letter-spacing: -0.05em;
          color: var(--text-strong, #fff);
        }

        .advanced-head p,
        .advanced-muted,
        .advanced-section-head p,
        .advanced-disclosure-head p,
        .advanced-choice-card span,
        .advanced-color-card small {
          color: var(--text-muted, #c7ddcf);
          line-height: 1.48;
        }

        .advanced-head p,
        .advanced-section-head p,
        .advanced-disclosure-head p {
          max-width: 820px;
          margin: 8px 0 0;
        }

        .advanced-eyebrow {
          color: var(--muted, #c7ddcf);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-size: 11px;
          font-weight: 950;
          margin-bottom: 7px;
        }

        .advanced-head-actions,
        .advanced-profile-actions,
        .advanced-move-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .advanced-message {
          margin-bottom: 14px;
        }

        .advanced-stack {
          display: grid;
          gap: 14px;
        }

        .advanced-section-card,
        .advanced-disclosure {
          border: 1px solid rgba(255,255,255,0.14);
          border-radius: 22px;
          background: rgba(255,255,255,0.055);
          padding: 14px;
        }

        .advanced-section-head,
        .advanced-disclosure-head {
          width: 100%;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          text-align: left;
          color: inherit;
        }

        .advanced-disclosure-head {
          appearance: none;
          border: 0;
          background: transparent;
          cursor: pointer;
          padding: 0;
        }

        .advanced-section-head h3,
        .advanced-disclosure-head h3,
        .advanced-subtitle {
          margin: 0;
          color: var(--text-strong, #fff);
          font-weight: 950;
        }

        .advanced-section-head h3,
        .advanced-disclosure-head h3 {
          font-size: 22px;
          letter-spacing: -0.03em;
        }

        .advanced-disclosure-body {
          margin-top: 14px;
          display: grid;
          gap: 14px;
        }

        .advanced-chevron {
          width: 34px;
          height: 34px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          background: rgba(255,255,255,0.08);
          transition: transform 160ms ease;
        }

        .advanced-chevron.open {
          transform: rotate(180deg);
        }

        .advanced-profile-grid,
        .advanced-choice-grid,
        .advanced-visibility-grid,
        .advanced-manual-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 10px;
          margin-top: 12px;
        }

        .advanced-profile-card,
        .advanced-choice-card,
        .advanced-visibility-pill,
        .advanced-move-row,
        .advanced-color-card {
          border: 1px solid rgba(255,255,255,0.14);
          border-radius: 18px;
          background: rgba(0,0,0,0.14);
          padding: 12px;
          color: var(--text-strong, #fff);
        }

        .advanced-choice-card,
        .advanced-visibility-pill {
          appearance: none;
          text-align: left;
          cursor: pointer;
          display: grid;
          gap: 6px;
        }

        .advanced-choice-card.active,
        .advanced-visibility-pill.active,
        .advanced-profile-card.active {
          border-color: color-mix(in srgb, var(--accent, #6dff9d) 44%, transparent);
          background: color-mix(in srgb, var(--accent, #6dff9d) 10%, transparent);
        }

        .advanced-profile-top {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          align-items: center;
          font-size: 11px;
          text-transform: uppercase;
          color: var(--muted, #c7ddcf);
          font-weight: 900;
        }

        .advanced-profile-top strong,
        .advanced-profile-top em {
          border: 1px solid rgba(255,255,255,0.14);
          border-radius: 999px;
          padding: 3px 7px;
          font-style: normal;
          color: var(--text-strong, #fff);
          background: rgba(255,255,255,0.07);
        }

        .advanced-profile-title {
          margin-top: 9px;
          font-weight: 950;
          font-size: 18px;
          overflow-wrap: anywhere;
        }

        .advanced-profile-rename-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 8px;
          margin-top: 12px;
        }

        .advanced-profile-actions {
          margin-top: 10px;
        }

        .advanced-subsection.full {
          grid-column: 1 / -1;
        }

        .advanced-subtitle {
          margin-bottom: 10px;
          font-size: 16px;
        }

        .advanced-visibility-pill {
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: center;
        }

        .advanced-visibility-pill strong {
          font-size: 12px;
          color: var(--accent, #6dff9d);
        }

        .advanced-move-list {
          display: grid;
          gap: 8px;
        }

        .advanced-move-row {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: center;
        }

        .advanced-move-row strong,
        .advanced-move-row span {
          display: block;
        }

        .advanced-move-row span {
          color: var(--text-muted, #c7ddcf);
          font-size: 12px;
          margin-top: 3px;
        }

        .advanced-move-actions .button {
          min-width: 48px !important;
          width: 48px !important;
          padding: 0 !important;
        }

        .advanced-color-card {
          display: grid;
          gap: 7px;
        }

        .advanced-color-card span {
          font-weight: 900;
        }

        .advanced-color-row {
          display: grid;
          grid-template-columns: 52px minmax(0, 1fr);
          gap: 10px;
          align-items: center;
          margin-top: 5px;
        }

        .advanced-color-row input[type="color"] {
          width: 52px;
          height: 42px;
          border: 1px solid rgba(255,255,255,0.14);
          border-radius: 12px;
          background: transparent;
          padding: 0;
        }

        .advanced-color-row code {
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 12px;
          padding: 10px;
          color: var(--text-strong, #fff);
          background: rgba(0,0,0,0.18);
          overflow: hidden;
          text-overflow: ellipsis;
        }

        html[data-dashboard-appearance="light"] .advanced-sheet,
        html[data-dashboard-appearance="light"] .advanced-section-card,
        html[data-dashboard-appearance="light"] .advanced-disclosure,
        html[data-dashboard-appearance="light"] .advanced-profile-card,
        html[data-dashboard-appearance="light"] .advanced-choice-card,
        html[data-dashboard-appearance="light"] .advanced-visibility-pill,
        html[data-dashboard-appearance="light"] .advanced-move-row,
        html[data-dashboard-appearance="light"] .advanced-color-card {
          background: rgba(255,255,255,0.96) !important;
          color: var(--text-strong, #0f172a) !important;
          border-color: rgba(15,23,42,0.14) !important;
          box-shadow: 0 12px 28px rgba(15,23,42,0.08);
        }

        html[data-dashboard-appearance="light"] .advanced-overlay {
          background: rgba(15,23,42,0.30);
        }

        @media (max-width: 720px) {
          .advanced-overlay {
            align-items: flex-end;
            padding: 8px 8px max(8px, env(safe-area-inset-bottom, 0px));
          }

          .advanced-sheet {
            max-height: 92vh;
            border-radius: 22px 22px 16px 16px;
            padding: 12px;
          }

          .advanced-head-actions,
          .advanced-head-actions .button,
          .advanced-profile-actions,
          .advanced-profile-actions .button,
          .advanced-profile-rename-row,
          .advanced-choice-grid,
          .advanced-visibility-grid,
          .advanced-manual-grid {
            display: grid;
            grid-template-columns: 1fr;
            width: 100%;
          }

          .advanced-profile-rename-row .button,
          .advanced-profile-actions .button,
          .advanced-head-actions .button {
            width: 100% !important;
          }

          .advanced-move-row {
            display: grid;
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

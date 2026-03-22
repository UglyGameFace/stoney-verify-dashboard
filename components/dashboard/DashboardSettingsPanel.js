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
      {helper ? (
        <div className="muted settings-helper-copy">{helper}</div>
      ) : null}
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

function SectionVisibilityList({
  title,
  keys,
  visibility,
  onToggle,
}) {
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
              <div className="muted settings-helper-copy">
                Position {index + 1}
              </div>
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

function SettingsAccordion({
  title,
  chip,
  defaultOpen = false,
  children,
}) {
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

  const homeKeys = preferences?.layout?.home || [];
  const membersKeys = preferences?.layout?.members || [];
  const visibility = preferences?.sectionVisibility || {};
  const theme = preferences?.theme || {};

  const sortedProfiles = useMemo(
    () =>
      safeArray(profiles)
        .slice()
        .sort((a, b) => Number(a.slot || 0) - Number(b.slot || 0)),
    [profiles]
  );

  useEffect(() => {
    if (!open) return undefined;

    const prevOverflow = document.body.style.overflow;
    const prevTouchAction = document.body.style.touchAction;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";

    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.touchAction = prevTouchAction;
    };
  }, [open]);

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

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="settings-overlay"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="settings-sheet"
      >
        <div className="settings-sheet-handle" />

        <div className="settings-head">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="settings-chip-row" style={{ marginBottom: 10 }}>
              <span className="section-chip">420 Theme Lab</span>
              <span className="badge claimed">Customization Studio</span>
            </div>

            <div className="settings-title-lg">Dashboard Personalization</div>

            <div className="muted settings-head-copy">
              Make the command center yours — better theme control, cleaner mobile
              flow, stronger one-hand use, and saved layouts for different staff moods.
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
              onClick={resetPreferences}
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

        <div className="settings-desktop-stack">
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

          <div className="settings-section-card">
            <div className="settings-section-heading">
              <div>
                <div className="settings-chip-row">
                  <span className="section-chip">Color Engine</span>
                </div>
                <div className="settings-title-sm">Neon Palette</div>
              </div>
            </div>

            <div className="settings-theme-grid">
              <ToneSwatch
                label="Accent"
                value={theme.accent || "#45d483"}
                onChange={(value) => setThemeValue("accent", value)}
                helper="Main green glow and primary dashboard energy."
              />

              <ToneSwatch
                label="Accent 2"
                value={theme.accent2 || "#3b82f6"}
                onChange={(value) => setThemeValue("accent2", value)}
                helper="Secondary neon balance for haze and highlights."
              />

              <ToneSwatch
                label="Primary Text"
                value={theme.textStrong || "#f8fafc"}
                onChange={(value) => setThemeValue("textStrong", value)}
                helper="High-contrast headline and card text."
              />

              <ToneSwatch
                label="Muted Text"
                value={theme.textMuted || "#b8c0cc"}
                onChange={(value) => setThemeValue("textMuted", value)}
                helper="Subtext, labels, and helper copy."
              />
            </div>

            <div className="settings-preview-stage">
              <div className="settings-preview-card">
                <div className="settings-preview-title">Live Mood Preview</div>
                <div className="settings-preview-sub">
                  This should feel like a smoky neon command room, not a default admin form.
                </div>

                <div className="settings-preview-chip-row">
                  <span className="badge low">Verified</span>
                  <span className="badge claimed">Claimed</span>
                  <span className="badge open">Open</span>
                  <span className="badge danger">High Risk</span>
                </div>
              </div>
            </div>
          </div>

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
        </div>

        <div className="settings-mobile-stack">
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

          <SettingsAccordion title="Neon Palette" chip="Color Engine">
            <div className="settings-theme-grid">
              <ToneSwatch
                label="Accent"
                value={theme.accent || "#45d483"}
                onChange={(value) => setThemeValue("accent", value)}
                helper="Main green glow and primary dashboard energy."
              />
              <ToneSwatch
                label="Accent 2"
                value={theme.accent2 || "#3b82f6"}
                onChange={(value) => setThemeValue("accent2", value)}
                helper="Secondary neon balance for haze and highlights."
              />
              <ToneSwatch
                label="Primary Text"
                value={theme.textStrong || "#f8fafc"}
                onChange={(value) => setThemeValue("textStrong", value)}
                helper="High-contrast headline and card text."
              />
              <ToneSwatch
                label="Muted Text"
                value={theme.textMuted || "#b8c0cc"}
                onChange={(value) => setThemeValue("textMuted", value)}
                helper="Subtext, labels, and helper copy."
              />
            </div>
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
        </div>

        <style jsx>{`
          .settings-overlay {
            position: fixed;
            inset: 0;
            z-index: 130;
            background: rgba(0, 0, 0, 0.62);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            display: flex;
            align-items: flex-end;
            justify-content: center;
            padding: 12px 10px calc(12px + env(safe-area-inset-bottom, 0px));
          }

          .settings-sheet {
            width: 100%;
            max-width: 1080px;
            max-height: 94vh;
            overflow-y: auto;
            border-radius: 28px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            background:
              radial-gradient(circle at top right, rgba(93, 255, 141, 0.08), transparent 28%),
              radial-gradient(circle at bottom left, rgba(178, 109, 255, 0.08), transparent 26%),
              linear-gradient(180deg, rgba(19, 32, 49, 0.98), rgba(9, 17, 26, 0.98));
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.42);
            color: var(--text-strong, #f8fafc);
            padding: 14px;
          }

          .settings-sheet-handle {
            width: 52px;
            height: 5px;
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.18);
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

          .settings-desktop-stack {
            display: grid;
            gap: 14px;
          }

          .settings-mobile-stack {
            display: none;
          }

          .settings-section-card {
            border: 1px solid rgba(255, 255, 255, 0.08);
            background:
              radial-gradient(circle at top right, rgba(93, 255, 141, 0.06), transparent 36%),
              linear-gradient(180deg, rgba(255, 255, 255, 0.035), rgba(255, 255, 255, 0.015)),
              rgba(255, 255, 255, 0.02);
            border-radius: 22px;
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
            background:
              radial-gradient(circle at top right, rgba(178, 109, 255, 0.06), transparent 36%),
              rgba(255, 255, 255, 0.03);
            border-radius: 18px;
            padding: 14px;
          }

          .profile-slot-card.active {
            border-color: rgba(93, 255, 141, 0.22);
            box-shadow: 0 0 22px rgba(93, 255, 141, 0.08);
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

          .settings-preview-stage {
            margin-top: 14px;
          }

          .settings-preview-card {
            border: 1px solid rgba(255, 255, 255, 0.08);
            background:
              radial-gradient(circle at top right, rgba(93, 255, 141, 0.08), transparent 34%),
              radial-gradient(circle at bottom left, rgba(178, 109, 255, 0.08), transparent 30%),
              rgba(255, 255, 255, 0.03);
            border-radius: 20px;
            padding: 16px;
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

          .settings-density-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 12px;
          }

          .density-preview {
            appearance: none;
            -webkit-appearance: none;
            border: 1px solid rgba(255, 255, 255, 0.08);
            background:
              radial-gradient(circle at top right, rgba(99, 213, 255, 0.06), transparent 34%),
              rgba(255, 255, 255, 0.03);
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
            box-shadow: 0 0 18px rgba(93, 255, 141, 0.08);
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
            background:
              radial-gradient(circle at top right, rgba(93, 255, 141, 0.05), transparent 34%),
              rgba(255, 255, 255, 0.025);
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
            box-shadow: 0 0 16px rgba(93, 255, 141, 0.08);
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
            background:
              radial-gradient(circle at top right, rgba(99, 213, 255, 0.04), transparent 34%),
              rgba(255, 255, 255, 0.02);
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
            .settings-desktop-stack {
              display: none;
            }

            .settings-mobile-stack {
              display: grid;
              gap: 12px;
            }

            .settings-sheet {
              max-height: 95vh;
              border-radius: 24px;
              padding: 12px;
            }

            .settings-title-lg {
              font-size: 24px;
            }

            .settings-profile-grid,
            .settings-theme-grid,
            .settings-density-grid,
            .settings-pill-grid {
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

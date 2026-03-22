"use client";

import { useMemo, useState } from "react";

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
        style={{
          marginTop: 12,
          width: "100%",
          height: 52,
          borderRadius: 14,
          border: "1px solid rgba(255,255,255,0.10)",
          background: "transparent",
        }}
      />
      {helper ? (
        <div className="muted" style={{ marginTop: 8, fontSize: 12, lineHeight: 1.45 }}>
          {helper}
        </div>
      ) : null}
    </div>
  );
}

function VisibilityPill({ label, active, onToggle }) {
  return (
    <button
      type="button"
      className={active ? "settings-pill active" : "settings-pill"}
      onClick={onToggle}
    >
      <span>{label}</span>
      <span className={active ? "badge low" : "badge closed"}>
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
          <div style={{ fontWeight: 900, fontSize: 18 }}>{title}</div>
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
          <div style={{ fontWeight: 900, fontSize: 18 }}>
            {area === "home" ? "Home Layout Order" : "Members Layout Order"}
          </div>
        </div>
      </div>

      <div className="space">
        {items.map((item, index) => (
          <div key={`${area}-${item}`} className="settings-move-card">
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 800, color: "var(--text-strong, #f8fafc)" }}>
                {SECTION_LABELS[item] || item}
              </div>
              <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                Position {index + 1}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className="button ghost"
                style={{ width: "auto", minWidth: 58 }}
                disabled={index === 0}
                onClick={() => onMove(area, index, index - 1)}
              >
                ↑
              </button>

              <button
                type="button"
                className="button ghost"
                style={{ width: "auto", minWidth: 58 }}
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
      className={active ? "density-preview active" : "density-preview"}
      onClick={onClick}
    >
      <div className="density-preview-bars">
        <span />
        <span />
        <span />
      </div>
      <div style={{ fontWeight: 800 }}>{label}</div>
      <div className="muted" style={{ fontSize: 12, marginTop: 4, lineHeight: 1.45 }}>
        {helper}
      </div>
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
    <div className={isActive ? "profile-slot-card active" : "profile-slot-card"}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="settings-chip-row" style={{ marginBottom: 8 }}>
            <span className="section-chip">Slot {profile.slot}</span>
            {isActive ? <span className="badge claimed">Active</span> : null}
            {isLastUsed ? <span className="badge low">Last Used</span> : null}
            {profile.isEmpty ? <span className="badge medium">Empty</span> : null}
          </div>

          <div
            style={{
              fontWeight: 900,
              color: "var(--text-strong, #f8fafc)",
              overflowWrap: "anywhere",
              fontSize: 18,
              letterSpacing: "-0.02em",
            }}
          >
            {profile.name}
          </div>

          <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
            {formatUpdatedAt(profile.updatedAt)}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 8,
          marginBottom: 10,
        }}
      >
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

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 130,
        background: "rgba(0,0,0,0.62)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: "16px 12px calc(16px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 1080,
          maxHeight: "92vh",
          overflowY: "auto",
          borderRadius: 28,
          border: "1px solid rgba(255,255,255,0.10)",
          background:
            "radial-gradient(circle at top right, rgba(93,255,141,0.08), transparent 28%), radial-gradient(circle at bottom left, rgba(178,109,255,0.08), transparent 26%), linear-gradient(180deg, rgba(19,32,49,0.98), rgba(9,17,26,0.98))",
          boxShadow: "0 20px 60px rgba(0,0,0,0.42)",
          color: "var(--text-strong, #f8fafc)",
          padding: 16,
        }}
      >
        <div
          style={{
            width: 52,
            height: 5,
            borderRadius: 999,
            background: "rgba(255,255,255,0.18)",
            margin: "0 auto 14px",
          }}
        />

        <div
          className="row"
          style={{
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="settings-chip-row" style={{ marginBottom: 10 }}>
              <span className="section-chip">420 Theme Lab</span>
              <span className="badge claimed">Customization Studio</span>
            </div>

            <div
              style={{
                fontWeight: 900,
                fontSize: 28,
                lineHeight: 1.02,
                letterSpacing: "-0.04em",
              }}
            >
              Dashboard Personalization
            </div>

            <div
              className="muted"
              style={{
                marginTop: 8,
                fontSize: 14,
                lineHeight: 1.55,
                maxWidth: 860,
              }}
            >
              Tune the command center exactly how you want it — neon accents,
              density, visibility, layout order, and saved UI profiles for
              different staff moods or workflows.
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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

        <div className="settings-studio-grid">
          <div className="settings-main-column">
            <div className="settings-section-card">
              <div className="settings-section-heading">
                <div>
                  <div className="settings-chip-row">
                    <span className="section-chip">Saved Looks</span>
                  </div>
                  <div style={{ fontWeight: 900, fontSize: 18 }}>
                    Profile Slots
                  </div>
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
                  <div style={{ fontWeight: 900, fontSize: 18 }}>
                    Neon Palette
                  </div>
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
                  helper="Secondary neon balance for badges, haze, and highlights."
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
                  helper="Subtext, helper copy, labels, and low-priority details."
                />
              </div>

              <div className="settings-preview-stage">
                <div className="settings-preview-card">
                  <div className="settings-preview-title">Live Mood Preview</div>
                  <div className="settings-preview-sub">
                    This preview should feel like a smoky neon command center.
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
                  <div style={{ fontWeight: 900, fontSize: 18 }}>
                    Layout Feel
                  </div>
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
          </div>
        </div>

        <style jsx>{`
          .settings-studio-grid {
            display: grid;
            gap: 14px;
          }

          .settings-main-column {
            display: grid;
            gap: 14px;
          }

          .settings-section-card {
            border: 1px solid rgba(255,255,255,0.08);
            background:
              radial-gradient(circle at top right, rgba(93,255,141,0.06), transparent 36%),
              linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.015)),
              rgba(255,255,255,0.02);
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

          .settings-chip-row {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
          }

          .settings-profile-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
            gap: 12px;
          }

          .profile-slot-card {
            border: 1px solid rgba(255,255,255,0.08);
            background:
              radial-gradient(circle at top right, rgba(178,109,255,0.06), transparent 36%),
              rgba(255,255,255,0.03);
            border-radius: 18px;
            padding: 14px;
          }

          .profile-slot-card.active {
            border-color: rgba(93,255,141,0.22);
            box-shadow: 0 0 22px rgba(93,255,141,0.08);
          }

          .settings-theme-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 12px;
          }

          .settings-lab-card {
            border: 1px solid rgba(255,255,255,0.08);
            background: rgba(255,255,255,0.025);
            border-radius: 18px;
            padding: 14px;
          }

          .settings-preview-stage {
            margin-top: 14px;
          }

          .settings-preview-card {
            border: 1px solid rgba(255,255,255,0.08);
            background:
              radial-gradient(circle at top right, rgba(93,255,141,0.08), transparent 34%),
              radial-gradient(circle at bottom left, rgba(178,109,255,0.08), transparent 30%),
              rgba(255,255,255,0.03);
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
            color: var(--text-muted, rgba(255,255,255,0.72));
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
            border: 1px solid rgba(255,255,255,0.08);
            background: rgba(255,255,255,0.03);
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
            border-color: rgba(93,255,141,0.20);
            box-shadow: 0 0 18px rgba(93,255,141,0.08);
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
              rgba(93,255,141,0.7),
              rgba(99,213,255,0.7)
            );
          }

          .settings-pill-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 10px;
          }

          .settings-pill {
            border: 1px solid rgba(255,255,255,0.08);
            background: rgba(255,255,255,0.025);
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
            border-color: rgba(93,255,141,0.18);
            box-shadow: 0 0 16px rgba(93,255,141,0.08);
            transform: translateY(-1px);
          }

          .settings-move-card {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 12px 14px;
            border-radius: 16px;
            border: 1px solid rgba(255,255,255,0.08);
            background: rgba(255,255,255,0.025);
            flex-wrap: wrap;
          }
        `}</style>
      </div>
    </div>
  );
}

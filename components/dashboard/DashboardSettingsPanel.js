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

function SectionVisibilityList({
  title,
  keys,
  visibility,
  onToggle,
}) {
  return (
    <div className="member-detail-item">
      <span className="ticket-info-label">{title}</span>

      <div
        style={{
          display: "grid",
          gap: 8,
          marginTop: 10,
        }}
      >
        {keys.map((key) => (
          <label
            key={key}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              cursor: "pointer",
              color: "var(--text-strong, #f8fafc)",
            }}
          >
            <span>{SECTION_LABELS[key] || key}</span>
            <input
              type="checkbox"
              checked={Boolean(visibility?.[key])}
              onChange={() => onToggle(key)}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function MoveButtons({ area, items, onMove }) {
  return (
    <div className="member-detail-item">
      <span className="ticket-info-label">
        {area === "home" ? "Home Layout Order" : "Members Layout Order"}
      </span>

      <div
        style={{
          display: "grid",
          gap: 8,
          marginTop: 10,
        }}
      >
        {items.map((item, index) => (
          <div
            key={`${area}-${item}`}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.02)",
            }}
          >
            <span style={{ color: "var(--text-strong, #f8fafc)" }}>
              {SECTION_LABELS[item] || item}
            </span>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="button ghost"
                style={{ width: "auto", minWidth: 52 }}
                disabled={index === 0}
                onClick={() => onMove(area, index, index - 1)}
              >
                ↑
              </button>

              <button
                type="button"
                className="button ghost"
                style={{ width: "auto", minWidth: 52 }}
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
    <div
      style={{
        border: isActive
          ? "1px solid color-mix(in srgb, var(--accent, #45d483) 40%, rgba(255,255,255,0.12))"
          : "1px solid rgba(255,255,255,0.08)",
        background: isActive
          ? "color-mix(in srgb, var(--accent, #45d483) 10%, rgba(255,255,255,0.02))"
          : "rgba(255,255,255,0.02)",
        borderRadius: 16,
        padding: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          marginBottom: 10,
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
              marginBottom: 6,
            }}
          >
            <span className="badge">{`Slot ${profile.slot}`}</span>
            {isActive ? <span className="badge claimed">Active</span> : null}
            {isLastUsed ? <span className="badge low">Last Used</span> : null}
            {profile.isEmpty ? <span className="badge medium">Empty</span> : null}
          </div>

          <div
            style={{
              fontWeight: 800,
              color: "var(--text-strong, #f8fafc)",
              overflowWrap: "anywhere",
            }}
          >
            {profile.name}
          </div>

          <div
            style={{
              marginTop: 4,
              fontSize: 12,
              color: "var(--text-muted, rgba(255,255,255,0.72))",
            }}
          >
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
          style={{ color: "var(--text-strong, #f8fafc)" }}
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

      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
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
          className="button ghost"
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
        background: "rgba(0,0,0,0.58)",
        backdropFilter: "blur(10px)",
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
          maxWidth: 980,
          maxHeight: "90vh",
          overflowY: "auto",
          borderRadius: 24,
          border: "1px solid rgba(255,255,255,0.10)",
          background:
            "linear-gradient(180deg, rgba(19,32,49,0.98), rgba(17,26,41,0.98))",
          boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
          color: "var(--text-strong, #f8fafc)",
          padding: 16,
        }}
      >
        <div
          style={{
            width: 42,
            height: 5,
            borderRadius: 999,
            background: "rgba(255,255,255,0.18)",
            margin: "0 auto 14px",
          }}
        />

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontWeight: 900, fontSize: 20 }}>
              Dashboard Personalization
            </div>
            <div
              style={{
                marginTop: 4,
                color: "var(--text-muted, rgba(255,255,255,0.72))",
                fontSize: 13,
              }}
            >
              Customize colors, density, visibility, layout, and save up to 5 UI
              profiles.
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
              style={{ width: "auto", minWidth: 120 }}
              onClick={resetPreferences}
            >
              Reset Current
            </button>

            <button
              type="button"
              className="button ghost"
              style={{ width: "auto", minWidth: 120 }}
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

        <div
          style={{
            display: "grid",
            gap: 14,
          }}
        >
          <div className="member-detail-item">
            <span className="ticket-info-label">Saved Profiles</span>

            <div
              style={{
                marginTop: 10,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: 10,
              }}
            >
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

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 10,
            }}
          >
            <div className="member-detail-item">
              <span className="ticket-info-label">Accent</span>
              <input
                type="color"
                value={theme.accent || "#45d483"}
                onChange={(e) => setThemeValue("accent", e.target.value)}
                style={{ marginTop: 10, width: "100%", height: 42 }}
              />
            </div>

            <div className="member-detail-item">
              <span className="ticket-info-label">Accent 2</span>
              <input
                type="color"
                value={theme.accent2 || "#3b82f6"}
                onChange={(e) => setThemeValue("accent2", e.target.value)}
                style={{ marginTop: 10, width: "100%", height: 42 }}
              />
            </div>

            <div className="member-detail-item">
              <span className="ticket-info-label">Primary Text</span>
              <input
                type="color"
                value={theme.textStrong || "#f8fafc"}
                onChange={(e) => setThemeValue("textStrong", e.target.value)}
                style={{ marginTop: 10, width: "100%", height: 42 }}
              />
            </div>

            <div className="member-detail-item">
              <span className="ticket-info-label">Muted Text</span>
              <input
                type="color"
                value={theme.textMuted || "#b8c0cc"}
                onChange={(e) => setThemeValue("textMuted", e.target.value)}
                style={{ marginTop: 10, width: "100%", height: 42 }}
              />
            </div>
          </div>

          <div className="member-detail-item">
            <span className="ticket-info-label">Density</span>
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                marginTop: 10,
              }}
            >
              {["compact", "comfortable", "spacious"].map((density) => (
                <button
                  key={density}
                  type="button"
                  className={
                    preferences?.density === density ? "button" : "button ghost"
                  }
                  style={{ width: "auto", minWidth: 120 }}
                  onClick={() => setDensity(density)}
                >
                  {density.charAt(0).toUpperCase() + density.slice(1)}
                </button>
              ))}
            </div>

            <div
              style={{
                marginTop: 10,
                fontSize: 12,
                color: "var(--text-muted, rgba(255,255,255,0.72))",
                lineHeight: 1.5,
              }}
            >
              Compact keeps the same information but expects more expandable
              sections and tighter spacing.
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

          <MoveButtons
            area="home"
            items={homeKeys}
            onMove={moveSection}
          />

          <MoveButtons
            area="members"
            items={membersKeys}
            onMove={moveSection}
          />
        </div>
      </div>
    </div>
  );
}

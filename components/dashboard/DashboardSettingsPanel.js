"use client";

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

export default function DashboardSettingsPanel({
  open,
  onClose,
  preferences,
  setThemeValue,
  setDensity,
  toggleSectionVisibility,
  moveSection,
  resetPreferences,
}) {
  if (!open) return null;

  const homeKeys = preferences?.layout?.home || [];
  const membersKeys = preferences?.layout?.members || [];
  const visibility = preferences?.sectionVisibility || {};
  const theme = preferences?.theme || {};

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
          maxWidth: 900,
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
              Customize colors, density, panel visibility, and layout order.
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="button ghost"
              style={{ width: "auto", minWidth: 120 }}
              onClick={resetPreferences}
            >
              Reset
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

        <div
          style={{
            display: "grid",
            gap: 14,
          }}
        >
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
                value="#b8c0cc"
                onChange={(e) => {
                  const hex = e.target.value;
                  setThemeValue("textMuted", hex);
                }}
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

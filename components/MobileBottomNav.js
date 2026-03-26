"use client";

const LABELS = {
  home: "Home",
  tickets: "Tickets",
  account: "Account",
  help: "Help",
  members: "Members",
  categories: "Categories",
  staff: "Staff",
  settings: "Settings",
};

const ICONS = {
  home: "🏠",
  tickets: "🎟️",
  account: "👤",
  help: "❔",
  members: "👥",
  categories: "🧩",
  staff: "🛡️",
  settings: "⚙️",
};

function toDisplayLabel(tab) {
  const key = String(tab || "").trim().toLowerCase();
  if (LABELS[key]) return LABELS[key];

  const raw = String(tab || "").trim();
  if (!raw) return "Tab";

  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function toDisplayIcon(tab) {
  const key = String(tab || "").trim().toLowerCase();
  return ICONS[key] || "•";
}

export default function MobileBottomNav({
  activeTab,
  onChange,
  tabs = [],
}) {
  const normalizedTabs = Array.isArray(tabs) ? tabs.filter(Boolean) : [];
  const visibleTabs = normalizedTabs.slice(0, 4);

  function handleTab(tab) {
    if (typeof onChange === "function") {
      onChange(tab);
    }
  }

  if (!visibleTabs.length) return null;

  const columns = Math.min(Math.max(visibleTabs.length, 1), 4);

  return (
    <>
      <nav
        className="mobile-bottom-nav"
        aria-label="Mobile navigation"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {visibleTabs.map((tab) => {
          const active = activeTab === tab;
          const label = toDisplayLabel(tab);
          const icon = toDisplayIcon(tab);

          return (
            <button
              key={tab}
              type="button"
              className={`mobile-nav-link ${active ? "active" : ""}`}
              onClick={() => handleTab(tab)}
              aria-pressed={active}
              aria-current={active ? "page" : undefined}
              aria-label={label}
            >
              <span className="mobile-nav-icon" aria-hidden="true">
                {icon}
              </span>
              <span className="mobile-nav-label">{label}</span>
            </button>
          );
        })}
      </nav>

      <style jsx>{`
        .mobile-bottom-nav {
          position: fixed;
          left: 10px;
          right: 10px;
          bottom: calc(10px + env(safe-area-inset-bottom, 0px));
          z-index: 80;
          display: grid;
          gap: 10px;
          padding: 10px;
          border-radius: 26px;
          background:
            radial-gradient(circle at top center, rgba(99, 213, 255, 0.08), transparent 45%),
            linear-gradient(180deg, rgba(9, 14, 24, 0.96), rgba(4, 9, 18, 0.98));
          border: 1px solid rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          box-shadow:
            0 10px 30px rgba(0, 0, 0, 0.32),
            inset 0 1px 0 rgba(255, 255, 255, 0.04);
        }

        .mobile-nav-link {
          appearance: none;
          -webkit-appearance: none;
          border: 1px solid rgba(255, 255, 255, 0.06);
          background: rgba(255, 255, 255, 0.025);
          color: var(--text-muted, rgba(255, 255, 255, 0.76));
          border-radius: 18px;
          min-height: 64px;
          padding: 10px 8px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          text-align: center;
          transition:
            transform 160ms ease,
            background 160ms ease,
            border-color 160ms ease,
            color 160ms ease,
            box-shadow 160ms ease;
        }

        .mobile-nav-link:active {
          transform: translateY(1px) scale(0.988);
        }

        .mobile-nav-link.active {
          color: var(--text-strong, #ffffff);
          background:
            linear-gradient(180deg, rgba(59, 130, 246, 0.16), rgba(69, 212, 131, 0.12));
          border-color: rgba(99, 213, 255, 0.22);
          box-shadow:
            0 0 0 1px rgba(99, 213, 255, 0.08) inset,
            0 8px 18px rgba(59, 130, 246, 0.14);
        }

        .mobile-nav-icon {
          display: block;
          font-size: 18px;
          line-height: 1;
          filter: saturate(1.05);
        }

        .mobile-nav-label {
          display: block;
          font-size: 12px;
          font-weight: 800;
          line-height: 1.05;
          letter-spacing: 0.01em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
        }

        @media (min-width: 1024px) {
          .mobile-bottom-nav {
            display: none;
          }
        }
      `}</style>
    </>
  );
}

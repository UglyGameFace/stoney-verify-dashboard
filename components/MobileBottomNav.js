"use client";

const TAB_META = {
  home: {
    label: "Home",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 10.75 12 4l9 6.75V20a1 1 0 0 1-1 1h-5.5v-6h-5v6H4a1 1 0 0 1-1-1z" />
      </svg>
    ),
  },
  tickets: {
    label: "Tickets",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h13A1.5 1.5 0 0 1 20 8.5V11a2 2 0 0 0 0 4v2.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5V15a2 2 0 0 0 0-4z" />
        <path d="M12 7v10" />
      </svg>
    ),
  },
  account: {
    label: "Account",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" />
        <path d="M5 20a7 7 0 0 1 14 0" />
      </svg>
    ),
  },
};

function getTabMeta(tab) {
  const key = String(tab || "").trim().toLowerCase();
  return TAB_META[key] || { label: key || "Tab", icon: null };
}

export default function MobileBottomNav({
  activeTab,
  onChange,
  tabs = [],
}) {
  const visibleTabs = Array.isArray(tabs) ? tabs.filter(Boolean).slice(0, 3) : [];

  if (!visibleTabs.length) return null;

  return (
    <>
      <nav className="mobile-bottom-nav-wrap" aria-label="Mobile navigation">
        <div className="mobile-bottom-nav">
          {visibleTabs.map((tab) => {
            const meta = getTabMeta(tab);
            const active = activeTab === tab;

            return (
              <button
                key={tab}
                type="button"
                className={`mobile-nav-link ${active ? "active" : ""}`}
                onClick={() => onChange?.(tab)}
                aria-current={active ? "page" : undefined}
                aria-pressed={active}
              >
                <span className="mobile-nav-icon">{meta.icon}</span>
                <span className="mobile-nav-label">{meta.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <style jsx>{`
        .mobile-bottom-nav-wrap {
          position: fixed;
          left: 0;
          right: 0;
          bottom: calc(12px + env(safe-area-inset-bottom, 0px));
          z-index: 90;
          display: flex;
          justify-content: center;
          pointer-events: none;
        }

        .mobile-bottom-nav {
          pointer-events: auto;
          width: min(340px, calc(100vw - 24px));
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
          padding: 8px;
          border-radius: 20px;
          background:
            linear-gradient(180deg, rgba(8, 12, 22, 0.94), rgba(5, 9, 17, 0.98));
          border: 1px solid rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          box-shadow:
            0 14px 36px rgba(0, 0, 0, 0.38),
            inset 0 1px 0 rgba(255, 255, 255, 0.04);
        }

        .mobile-nav-link {
          appearance: none;
          -webkit-appearance: none;
          border: 1px solid rgba(255, 255, 255, 0.06);
          background: rgba(255, 255, 255, 0.02);
          color: rgba(255, 255, 255, 0.72);
          border-radius: 15px;
          min-height: 58px;
          padding: 8px 6px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 5px;
          transition:
            transform 140ms ease,
            background 160ms ease,
            border-color 160ms ease,
            color 160ms ease,
            box-shadow 160ms ease;
        }

        .mobile-nav-link:active {
          transform: scale(0.985);
        }

        .mobile-nav-link.active {
          color: #ffffff;
          border-color: rgba(99, 213, 255, 0.22);
          background:
            linear-gradient(180deg, rgba(59, 130, 246, 0.14), rgba(69, 212, 131, 0.1));
          box-shadow:
            0 0 0 1px rgba(99, 213, 255, 0.05) inset,
            0 8px 18px rgba(59, 130, 246, 0.14);
        }

        .mobile-nav-icon {
          width: 18px;
          height: 18px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .mobile-nav-icon :global(svg) {
          width: 18px;
          height: 18px;
          display: block;
          fill: none;
          stroke: currentColor;
          stroke-width: 1.9;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .mobile-nav-label {
          font-size: 12px;
          font-weight: 800;
          line-height: 1;
          letter-spacing: 0.01em;
        }

        @media (min-width: 1024px) {
          .mobile-bottom-nav-wrap {
            display: none;
          }
        }
      `}</style>
    </>
  );
}

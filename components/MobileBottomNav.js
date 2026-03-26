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
  const visibleTabs = Array.isArray(tabs)
    ? tabs.filter(Boolean).slice(0, 3)
    : [];

  if (!visibleTabs.length) return null;

  return (
    <>
      <nav className="sv-mobile-nav-wrap" aria-label="Mobile navigation">
        <div className="sv-mobile-nav-shell">
          {visibleTabs.map((tab) => {
            const meta = getTabMeta(tab);
            const active = activeTab === tab;

            return (
              <button
                key={tab}
                type="button"
                className={`sv-mobile-nav-item ${active ? "active" : ""}`}
                onClick={() => onChange?.(tab)}
                aria-current={active ? "page" : undefined}
              >
                <span className="sv-mobile-nav-icon">{meta.icon}</span>
                <span className="sv-mobile-nav-text">{meta.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <style jsx>{`
        .sv-mobile-nav-wrap {
          position: fixed;
          left: 50%;
          transform: translateX(-50%);
          bottom: calc(10px + env(safe-area-inset-bottom, 0px));
          z-index: 9999;
          width: auto;
          max-width: calc(100vw - 18px);
          pointer-events: none;
        }

        .sv-mobile-nav-shell {
          pointer-events: auto;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: auto;
          padding: 7px;
          border-radius: 18px;
          background: rgba(7, 12, 22, 0.9);
          border: 1px solid rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          box-shadow:
            0 10px 28px rgba(0, 0, 0, 0.34),
            inset 0 1px 0 rgba(255, 255, 255, 0.04);
          box-sizing: border-box;
        }

        .sv-mobile-nav-item {
          all: unset;
          box-sizing: border-box;
          width: 82px;
          min-width: 82px;
          height: 68px;
          border-radius: 15px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          cursor: pointer;
          user-select: none;
          -webkit-tap-highlight-color: transparent;
          color: rgba(255, 255, 255, 0.78);
          background: rgba(255, 255, 255, 0.025);
          border: 1px solid rgba(255, 255, 255, 0.06);
          transition:
            transform 140ms ease,
            background 160ms ease,
            border-color 160ms ease,
            color 160ms ease,
            box-shadow 160ms ease;
          text-align: center;
          flex: 0 0 auto;
        }

        .sv-mobile-nav-item:active {
          transform: scale(0.985);
        }

        .sv-mobile-nav-item.active {
          color: #ffffff;
          border-color: rgba(99, 213, 255, 0.24);
          background: linear-gradient(
            180deg,
            rgba(59, 130, 246, 0.16),
            rgba(69, 212, 131, 0.11)
          );
          box-shadow:
            0 0 0 1px rgba(99, 213, 255, 0.05) inset,
            0 6px 16px rgba(59, 130, 246, 0.12);
        }

        .sv-mobile-nav-icon {
          width: 18px;
          height: 18px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 18px;
          line-height: 0;
        }

        .sv-mobile-nav-icon :global(svg) {
          width: 18px;
          height: 18px;
          display: block;
          fill: none;
          stroke: currentColor;
          stroke-width: 1.9;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .sv-mobile-nav-text {
          display: block;
          font-size: 11px;
          font-weight: 800;
          line-height: 1;
          letter-spacing: 0.01em;
          white-space: nowrap;
        }

        @media (max-width: 380px) {
          .sv-mobile-nav-shell {
            gap: 6px;
            padding: 6px;
          }

          .sv-mobile-nav-item {
            width: 76px;
            min-width: 76px;
            height: 64px;
          }
        }

        @media (min-width: 1024px) {
          .sv-mobile-nav-wrap {
            display: none;
          }
        }
      `}</style>
    </>
  );
}

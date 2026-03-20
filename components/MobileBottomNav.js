"use client";

const labels = {
  home: "Home",
  tickets: "Tickets",
  members: "Members",
  categories: "Categories",
};

const icons = {
  home: "🏠",
  tickets: "🎟️",
  members: "👥",
  categories: "🧩",
};

export default function MobileBottomNav({ activeTab, onChange, tabs = [] }) {
  return (
    <>
      <div className="mobile-bottom-nav">
        {tabs.map((tab) => {
          const active = activeTab === tab;

          return (
            <button
              key={tab}
              type="button"
              className={`mobile-nav-link ${active ? "active" : ""}`}
              onClick={() => onChange(tab)}
              aria-pressed={active}
              aria-label={labels[tab] || tab}
            >
              <span className="mobile-nav-icon">{icons[tab] || "•"}</span>
              <span className="mobile-nav-label">{labels[tab] || tab}</span>
            </button>
          );
        })}
      </div>

      <style jsx>{`
        .mobile-bottom-nav {
          position: fixed;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 80;
          display: grid;
          grid-template-columns: repeat(${Math.max(tabs.length || 1, 1)}, minmax(0, 1fr));
          gap: 8px;
          padding: 10px 12px calc(10px + env(safe-area-inset-bottom, 0px));
          background: rgba(10, 14, 22, 0.92);
          backdrop-filter: blur(18px);
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 -10px 30px rgba(0, 0, 0, 0.28);
        }

        .mobile-nav-link {
          appearance: none;
          border: 1px solid rgba(255, 255, 255, 0.06);
          background: rgba(255, 255, 255, 0.03);
          color: var(--text-muted, rgba(255, 255, 255, 0.72));
          border-radius: 16px;
          min-height: 58px;
          padding: 8px 6px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 5px;
          text-align: center;
          transition:
            transform 160ms ease,
            background 160ms ease,
            border-color 160ms ease,
            color 160ms ease,
            box-shadow 160ms ease;
        }

        .mobile-nav-link:active {
          transform: translateY(1px) scale(0.99);
        }

        .mobile-nav-link.active {
          color: var(--text-strong, #ffffff);
          background: linear-gradient(
            180deg,
            rgba(59, 130, 246, 0.18),
            rgba(69, 212, 131, 0.12)
          );
          border-color: rgba(59, 130, 246, 0.3);
          box-shadow: 0 8px 20px rgba(37, 99, 235, 0.18);
        }

        .mobile-nav-icon {
          display: block;
          font-size: 16px;
          line-height: 1;
        }

        .mobile-nav-label {
          display: block;
          font-size: 12px;
          font-weight: 800;
          line-height: 1.05;
          letter-spacing: 0.01em;
          overflow-wrap: anywhere;
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

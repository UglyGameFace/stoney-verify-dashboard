"use client";

import { useState } from "react";

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

export default function MobileBottomNav({
  activeTab,
  onChange,
  tabs = [],
  extraActions = [],
  title = "Quick Menu",
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  const primaryTabs = tabs.slice(0, 2);
  const secondaryTabs = tabs.slice(2);

  function handleTab(tab) {
    onChange(tab);
    setMenuOpen(false);
  }

  return (
    <>
      <div className="mobile-bottom-nav">
        {primaryTabs.map((tab) => {
          const active = activeTab === tab;

          return (
            <button
              key={tab}
              type="button"
              className={`mobile-nav-link ${active ? "active" : ""}`}
              onClick={() => handleTab(tab)}
              aria-pressed={active}
              aria-label={labels[tab] || tab}
            >
              <span className="mobile-nav-icon">{icons[tab] || "•"}</span>
              <span className="mobile-nav-label">{labels[tab] || tab}</span>
            </button>
          );
        })}

        <button
          type="button"
          className={`mobile-nav-link mobile-nav-menu ${menuOpen ? "active" : ""}`}
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-expanded={menuOpen}
          aria-label="Open quick menu"
        >
          <span className="mobile-nav-icon">☰</span>
          <span className="mobile-nav-label">Menu</span>
        </button>

        {secondaryTabs.map((tab) => {
          const active = activeTab === tab;

          return (
            <button
              key={tab}
              type="button"
              className={`mobile-nav-link ${active ? "active" : ""}`}
              onClick={() => handleTab(tab)}
              aria-pressed={active}
              aria-label={labels[tab] || tab}
            >
              <span className="mobile-nav-icon">{icons[tab] || "•"}</span>
              <span className="mobile-nav-label">{labels[tab] || tab}</span>
            </button>
          );
        })}
      </div>

      {menuOpen ? (
        <div className="mobile-command-overlay" onClick={() => setMenuOpen(false)}>
          <div
            className="mobile-command-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mobile-command-handle" />

            <div className="mobile-command-title">{title}</div>

            <div className="mobile-command-grid">
              {tabs.map((tab) => {
                const active = activeTab === tab;

                return (
                  <button
                    key={tab}
                    type="button"
                    className={`mobile-command-item ${active ? "active" : ""}`}
                    onClick={() => handleTab(tab)}
                  >
                    <span className="mobile-command-icon">{icons[tab] || "•"}</span>
                    <span className="mobile-command-label">{labels[tab] || tab}</span>
                  </button>
                );
              })}

              {extraActions.map((action) => (
                <button
                  key={action.key}
                  type="button"
                  className="mobile-command-item special"
                  onClick={() => {
                    action.onClick?.();
                    setMenuOpen(false);
                  }}
                >
                  <span className="mobile-command-icon">{action.icon || "✦"}</span>
                  <span className="mobile-command-label">{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <style jsx>{`
        .mobile-bottom-nav {
          position: fixed;
          left: 8px;
          right: 8px;
          bottom: calc(8px + env(safe-area-inset-bottom, 0px));
          z-index: 80;
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 8px;
          padding: 8px;
          border-radius: 24px;
          background:
            linear-gradient(180deg, rgba(10, 14, 22, 0.95), rgba(5, 10, 16, 0.96));
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 -10px 30px rgba(0, 0, 0, 0.28);
        }

        .mobile-nav-link {
          appearance: none;
          -webkit-appearance: none;
          border: 1px solid rgba(255, 255, 255, 0.06);
          background: rgba(255, 255, 255, 0.03);
          color: var(--text-muted, rgba(255, 255, 255, 0.72));
          border-radius: 18px;
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

        .mobile-nav-menu {
          background:
            radial-gradient(circle at top, rgba(178, 109, 255, 0.18), transparent 70%),
            rgba(255, 255, 255, 0.04);
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

        .mobile-command-overlay {
          position: fixed;
          inset: 0;
          z-index: 90;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          display: flex;
          align-items: flex-end;
          justify-content: center;
          padding: 10px 8px calc(92px + env(safe-area-inset-bottom, 0px));
        }

        .mobile-command-sheet {
          width: 100%;
          max-width: 720px;
          border-radius: 26px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background:
            radial-gradient(circle at top right, rgba(93,255,141,0.08), transparent 28%),
            radial-gradient(circle at bottom left, rgba(178,109,255,0.08), transparent 26%),
            linear-gradient(180deg, rgba(16,28,40,0.98), rgba(7,14,24,0.98));
          box-shadow: 0 18px 40px rgba(0, 0, 0, 0.36);
          padding: 14px;
        }

        .mobile-command-handle {
          width: 50px;
          height: 5px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.18);
          margin: 0 auto 12px;
        }

        .mobile-command-title {
          font-size: 20px;
          font-weight: 900;
          letter-spacing: -0.03em;
          color: var(--text-strong, #fff);
          margin-bottom: 12px;
        }

        .mobile-command-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .mobile-command-item {
          appearance: none;
          -webkit-appearance: none;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.03);
          color: var(--text-strong, #fff);
          border-radius: 18px;
          min-height: 64px;
          padding: 12px;
          display: flex;
          align-items: center;
          gap: 10px;
          text-align: left;
        }

        .mobile-command-item.active,
        .mobile-command-item.special {
          border-color: rgba(93, 255, 141, 0.18);
          box-shadow: 0 0 16px rgba(93, 255, 141, 0.08);
        }

        .mobile-command-icon {
          font-size: 18px;
          line-height: 1;
        }

        .mobile-command-label {
          font-size: 14px;
          font-weight: 800;
          line-height: 1.15;
        }

        @media (min-width: 1024px) {
          .mobile-bottom-nav,
          .mobile-command-overlay {
            display: none;
          }
        }
      `}</style>
    </>
  );
}

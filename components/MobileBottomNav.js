"use client";

import { useEffect, useMemo, useState } from "react";

const DESKTOP_LAYOUT_MIN_WIDTH = 1024;

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
        <path d="M12 12a3.25 3.25 0 1 0-3.25-3.25A3.25 3.25 0 0 0 12 12Z" />
        <path d="M6.75 18.5a5.25 5.25 0 0 1 10.5 0" />
      </svg>
    ),
  },
  members: {
    label: "Members",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M16 19a4 4 0 0 0-8 0" />
        <path d="M12 13a3.25 3.25 0 1 0-3.25-3.25A3.25 3.25 0 0 0 12 13Z" />
        <path d="M18.5 8.75a2.75 2.75 0 1 0-2.75-2.75" />
        <path d="M20.25 18a3.25 3.25 0 0 0-3.25-3.25" />
        <path d="M5.5 8.75A2.75 2.75 0 1 1 8.25 6" />
        <path d="M3.75 18A3.25 3.25 0 0 1 7 14.75" />
      </svg>
    ),
  },
  categories: {
    label: "Categories",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 6.5A1.5 1.5 0 0 1 5.5 5H11l2 2h5.5A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5z" />
      </svg>
    ),
  },
  actions: {
    label: "Actions",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3v6" />
        <path d="M12 15v6" />
        <path d="M3 12h6" />
        <path d="M15 12h6" />
        <path d="m5.64 5.64 4.24 4.24" />
        <path d="m14.12 14.12 4.24 4.24" />
        <path d="m18.36 5.64-4.24 4.24" />
        <path d="m9.88 14.12-4.24 4.24" />
      </svg>
    ),
  },
};

function normalizeText(value) {
  return String(value || "").trim();
}

function getTabMeta(tab) {
  const key = normalizeText(tab).toLowerCase();
  if (TAB_META[key]) return TAB_META[key];

  const pretty = key ? key.charAt(0).toUpperCase() + key.slice(1) : "Tab";
  return { label: pretty, icon: null };
}

function getActionLabel(action) {
  return normalizeText(action?.label) || "Action";
}

export default function MobileBottomNav({
  activeTab,
  onChange,
  tabs = [],
  title = "",
  extraActions = [],
  actionButtonLabel = "Actions",
}) {
  const [actionsOpen, setActionsOpen] = useState(false);

  const visibleActions = useMemo(
    () =>
      Array.isArray(extraActions)
        ? extraActions.filter((action) => typeof action?.onClick === "function")
        : [],
    [extraActions]
  );

  const visibleTabs = useMemo(() => {
    const rawTabs = Array.isArray(tabs) ? tabs.filter(Boolean) : [];
    const maxTabs = visibleActions.length ? 4 : 5;
    return rawTabs.slice(0, maxTabs);
  }, [tabs, visibleActions.length]);

  const totalNavItems = visibleTabs.length + (visibleActions.length ? 1 : 0);

  useEffect(() => {
    setActionsOpen(false);
  }, [activeTab]);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape") {
        setActionsOpen(false);
      }
    }

    if (actionsOpen) {
      window.addEventListener("keydown", onKeyDown);
    }

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [actionsOpen]);

  useEffect(() => {
    function onResize() {
      if (window.innerWidth >= DESKTOP_LAYOUT_MIN_WIDTH) {
        setActionsOpen(false);
      }
    }

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (!visibleTabs.length && !visibleActions.length) return null;

  return (
    <>
      {actionsOpen ? (
        <div
          className="sv-mobile-actions-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={title || "Staff actions"}
          onClick={() => setActionsOpen(false)}
        >
          <div
            className="sv-mobile-actions-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sv-mobile-actions-handle" />

            <div className="sv-mobile-actions-header">
              <div>
                <div className="sv-mobile-actions-title">
                  {title || "Staff Actions"}
                </div>
                <div className="sv-mobile-actions-subtitle">
                  Fast jumps and moderation shortcuts
                </div>
              </div>

              <button
                type="button"
                className="sv-mobile-actions-close"
                onClick={() => setActionsOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="sv-mobile-actions-grid">
              {visibleActions.map((action) => (
                <button
                  key={action.key || getActionLabel(action)}
                  type="button"
                  className="sv-mobile-actions-item"
                  onClick={() => {
                    try {
                      action.onClick?.();
                    } finally {
                      setActionsOpen(false);
                    }
                  }}
                  disabled={Boolean(action.disabled)}
                  title={getActionLabel(action)}
                >
                  {action.icon ? (
                    <span className="sv-mobile-actions-emoji" aria-hidden="true">
                      {action.icon}
                    </span>
                  ) : null}

                  <span className="sv-mobile-actions-label">
                    {getActionLabel(action)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

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
                title={meta.label}
              >
                <span className="sv-mobile-nav-icon">{meta.icon}</span>
                <span className="sv-mobile-nav-text">{meta.label}</span>
              </button>
            );
          })}

          {visibleActions.length ? (
            <button
              type="button"
              className={`sv-mobile-nav-item ${actionsOpen ? "active" : ""}`}
              onClick={() => setActionsOpen((prev) => !prev)}
              aria-expanded={actionsOpen}
              title={actionButtonLabel}
            >
              <span className="sv-mobile-nav-icon">
                {TAB_META.actions.icon}
              </span>
              <span className="sv-mobile-nav-text">{actionButtonLabel}</span>
            </button>
          ) : null}
        </div>
      </nav>

      <style jsx>{`
        .sv-mobile-actions-overlay {
          position: fixed;
          inset: 0;
          z-index: 10000;
          background: rgba(2, 6, 23, 0.64);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          display: flex;
          align-items: flex-end;
          justify-content: center;
          padding:
            10px
            10px
            calc(10px + env(safe-area-inset-bottom, 0px) + 72px);
        }

        .sv-mobile-actions-sheet {
          width: min(calc(100vw - 12px), 430px);
          max-height: min(72vh, 520px);
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior: contain;
          border-radius: 20px;
          background:
            radial-gradient(circle at top right, rgba(93, 255, 141, 0.08), transparent 30%),
            radial-gradient(circle at bottom left, rgba(99, 213, 255, 0.08), transparent 28%),
            rgba(7, 12, 22, 0.97);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow:
            0 24px 80px rgba(0, 0, 0, 0.42),
            inset 0 1px 0 rgba(255, 255, 255, 0.04);
          padding: 12px 12px calc(12px + env(safe-area-inset-bottom, 0px));
        }

        .sv-mobile-actions-handle {
          width: 52px;
          height: 5px;
          border-radius: 999px;
          margin: 0 auto 14px;
          background: rgba(255, 255, 255, 0.16);
        }

        .sv-mobile-actions-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 14px;
        }

        .sv-mobile-actions-title {
          font-size: 18px;
          font-weight: 900;
          color: rgba(255, 255, 255, 0.96);
          letter-spacing: -0.02em;
        }

        .sv-mobile-actions-subtitle {
          margin-top: 4px;
          font-size: 12px;
          line-height: 1.4;
          color: rgba(255, 255, 255, 0.68);
        }

        .sv-mobile-actions-close {
          all: unset;
          box-sizing: border-box;
          min-height: 38px;
          padding: 0 13px;
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.03);
          color: rgba(255, 255, 255, 0.9);
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          user-select: none;
        }

        .sv-mobile-actions-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .sv-mobile-actions-item {
          all: unset;
          box-sizing: border-box;
          min-height: 56px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px;
          cursor: pointer;
          user-select: none;
          -webkit-tap-highlight-color: transparent;
          text-align: center;
          color: rgba(255, 255, 255, 0.9);
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          transition:
            transform 140ms ease,
            background 160ms ease,
            border-color 160ms ease,
            color 160ms ease,
            opacity 160ms ease;
        }

        .sv-mobile-actions-item:active {
          transform: scale(0.985);
        }

        .sv-mobile-actions-item:disabled {
          opacity: 0.55;
          cursor: default;
        }

        .sv-mobile-actions-emoji {
          font-size: 16px;
          line-height: 1;
          flex: 0 0 auto;
        }

        .sv-mobile-actions-label {
          min-width: 0;
          font-size: 12px;
          font-weight: 800;
          line-height: 1.15;
          overflow-wrap: anywhere;
        }

        .sv-mobile-nav-wrap {
          position: fixed;
          left: 50%;
          transform: translateX(-50%);
          bottom: calc(4px + env(safe-area-inset-bottom, 0px));
          z-index: 9999;
          width: min(calc(100vw - 14px), 430px);
          pointer-events: none;
        }

        .sv-mobile-nav-shell {
          pointer-events: auto;
          box-sizing: border-box;
          width: 100%;
          border-radius: 16px;
          background:
            radial-gradient(circle at top right, rgba(93, 255, 141, 0.05), transparent 34%),
            radial-gradient(circle at bottom left, rgba(99, 213, 255, 0.05), transparent 28%),
            rgba(7, 12, 22, 0.92);
          border: 1px solid rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          box-shadow:
            0 10px 28px rgba(0, 0, 0, 0.34),
            inset 0 1px 0 rgba(255, 255, 255, 0.04);
          display: grid;
          grid-template-columns: repeat(${totalNavItems || 1}, minmax(0, 1fr));
          align-items: stretch;
          gap: 5px;
          padding: 5px;
        }

        .sv-mobile-nav-item {
          all: unset;
          box-sizing: border-box;
          min-width: 0;
          height: 54px;
          border-radius: 13px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
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
          width: 16px;
          height: 16px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 16px;
          line-height: 0;
        }

        .sv-mobile-nav-icon :global(svg) {
          width: 16px;
          height: 16px;
          display: block;
          fill: none;
          stroke: currentColor;
          stroke-width: 1.9;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .sv-mobile-nav-text {
          display: block;
          min-width: 0;
          font-size: 10px;
          font-weight: 800;
          line-height: 1;
          letter-spacing: 0.01em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
        }

        @media (max-width: 380px) {
          .sv-mobile-nav-wrap {
            width: min(calc(100vw - 10px), 420px);
          }

          .sv-mobile-nav-shell {
            gap: 4px;
            padding: 4px;
          }

          .sv-mobile-nav-item {
            height: 52px;
            border-radius: 12px;
          }

          .sv-mobile-nav-text,
          .sv-mobile-actions-label {
            font-size: 9.5px;
          }

          .sv-mobile-actions-grid {
            gap: 8px;
          }
        }

        @media (min-width: ${DESKTOP_LAYOUT_MIN_WIDTH}px) {
          .sv-mobile-nav-wrap,
          .sv-mobile-actions-overlay {
            display: none;
          }
        }
      `}</style>
    </>
  );
}

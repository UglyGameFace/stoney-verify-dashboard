import { env } from "@/lib/env";

const links = [
  { href: "/#overview", label: "Overview" },
  { href: "/#tickets", label: "Tickets" },
  { href: "/#members", label: "Members" },
  { href: "/#categories", label: "Categories" },
];

export default function Sidebar() {
  return (
    <>
      <aside className="sv-sidebar">
        <div className="sv-sidebar-inner">
          <div className="sv-brand">
            <div className="sv-brand-badge">🌿</div>

            <div className="sv-brand-copy">
              <div className="sv-brand-title">
                {env.appName || "Stoney Verify"}
              </div>
              <div className="sv-brand-subtitle">Green-room command center</div>
            </div>
          </div>

          <nav className="sv-sidebar-nav" aria-label="Dashboard sections">
            {links.map((item, index) => (
              <a
                key={item.href}
                href={item.href}
                className={`sv-sidebar-link ${index === 0 ? "active" : ""}`}
              >
                <span className="sv-sidebar-link-label">{item.label}</span>
              </a>
            ))}
          </nav>

          <div className="sv-sidebar-stack">
            <div className="sv-sidebar-card">
              <div className="sv-sidebar-card-label">Server Session</div>
              <div className="sv-sidebar-card-value">
                {env.guildId || "Missing guild id"}
              </div>
            </div>

            <div className="sv-sidebar-card">
              <div className="sv-sidebar-card-label">Theme</div>
              <div className="sv-sidebar-card-value">
                Stoney premium / green haze
              </div>
            </div>
          </div>
        </div>
      </aside>

      <style jsx>{`
        .sv-sidebar {
          position: sticky;
          top: 0;
          height: 100vh;
          padding: 18px 16px;
          border-right: 1px solid rgba(255, 255, 255, 0.06);
          background:
            radial-gradient(
              circle at top,
              rgba(93, 255, 141, 0.1),
              transparent 28%
            ),
            radial-gradient(
              circle at bottom,
              rgba(99, 213, 255, 0.08),
              transparent 24%
            ),
            rgba(7, 13, 20, 0.84);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          overflow: hidden;
        }

        .sv-sidebar-inner {
          height: 100%;
          display: flex;
          flex-direction: column;
          min-height: 0;
        }

        .sv-brand {
          display: flex;
          gap: 12px;
          align-items: center;
          margin-bottom: 20px;
          padding: 2px 0;
        }

        .sv-brand-badge {
          width: 46px;
          height: 46px;
          min-width: 46px;
          border-radius: 15px;
          display: grid;
          place-items: center;
          background: linear-gradient(
            135deg,
            rgba(93, 255, 141, 0.96),
            rgba(99, 213, 255, 0.96)
          );
          color: #04110b;
          font-size: 20px;
          font-weight: 900;
          box-shadow:
            0 10px 24px rgba(93, 255, 141, 0.22),
            0 0 18px rgba(99, 213, 255, 0.16);
          flex-shrink: 0;
        }

        .sv-brand-copy {
          min-width: 0;
        }

        .sv-brand-title {
          font-weight: 900;
          font-size: 15px;
          line-height: 1.08;
          color: var(--text-strong, #ffffff);
          letter-spacing: -0.02em;
          overflow-wrap: anywhere;
        }

        .sv-brand-subtitle {
          margin-top: 4px;
          font-size: 12px;
          line-height: 1.35;
          color: var(--muted, #b3cbbb);
        }

        .sv-sidebar-nav {
          display: grid;
          gap: 8px;
        }

        .sv-sidebar-link {
          min-height: 48px;
          padding: 13px 14px;
          border-radius: 16px;
          border: 1px solid transparent;
          background: rgba(255, 255, 255, 0.02);
          color: var(--muted, #b3cbbb);
          transition:
            background 160ms ease,
            border-color 160ms ease,
            color 160ms ease,
            transform 160ms ease,
            box-shadow 160ms ease;
        }

        .sv-sidebar-link:hover {
          color: #ffffff;
          border-color: rgba(93, 255, 141, 0.12);
          background: linear-gradient(
            135deg,
            rgba(93, 255, 141, 0.08),
            rgba(99, 213, 255, 0.06)
          );
          box-shadow: 0 0 16px rgba(93, 255, 141, 0.08);
          transform: translateY(-1px);
        }

        .sv-sidebar-link.active {
          color: #ffffff;
          border-color: rgba(93, 255, 141, 0.16);
          background: linear-gradient(
            135deg,
            rgba(93, 255, 141, 0.14),
            rgba(99, 213, 255, 0.1)
          );
          box-shadow:
            0 0 0 1px rgba(93, 255, 141, 0.05) inset,
            0 0 18px rgba(93, 255, 141, 0.12);
        }

        .sv-sidebar-link-label {
          display: block;
          font-size: 14px;
          font-weight: 700;
          line-height: 1.1;
          overflow-wrap: anywhere;
        }

        .sv-sidebar-stack {
          margin-top: auto;
          display: grid;
          gap: 12px;
          padding-top: 18px;
        }

        .sv-sidebar-card {
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background:
            radial-gradient(
              circle at top right,
              rgba(93, 255, 141, 0.08),
              transparent 38%
            ),
            linear-gradient(
              180deg,
              rgba(255, 255, 255, 0.04),
              rgba(255, 255, 255, 0.02)
            ),
            linear-gradient(
              180deg,
              rgba(15, 28, 40, 0.95),
              rgba(9, 17, 28, 0.95)
            );
          padding: 12px 13px;
          box-shadow:
            0 0 0 1px rgba(255, 255, 255, 0.02) inset,
            0 12px 28px rgba(0, 0, 0, 0.16);
        }

        .sv-sidebar-card-label {
          color: var(--muted, #b3cbbb);
          font-size: 12px;
          line-height: 1.2;
          margin-bottom: 8px;
        }

        .sv-sidebar-card-value {
          font-weight: 800;
          font-size: 14px;
          line-height: 1.3;
          color: var(--text-strong, #ffffff);
          overflow-wrap: anywhere;
        }
      `}</style>
    </>
  );
}

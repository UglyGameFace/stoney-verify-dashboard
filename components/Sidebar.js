import { env } from "@/lib/env";

const links = [
  { href: "/#overview", label: "Overview" },
  { href: "/#tickets", label: "Tickets" },
  { href: "/#members", label: "Members" },
  { href: "/#categories", label: "Categories" },
];

export default function Sidebar() {
  return (
    <aside className="sidebar stoner-sidebar">
      <div
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        <div className="brand">
          <div className="brand-badge">🌿</div>

          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontWeight: 900,
                fontSize: 15,
                lineHeight: 1.08,
                color: "var(--text-strong, #ffffff)",
                letterSpacing: "-0.02em",
                overflowWrap: "anywhere",
              }}
            >
              {env.appName || "Stoney Verify Dashboard v3.8"}
            </div>

            <div
              className="muted"
              style={{
                marginTop: 4,
                fontSize: 12,
                lineHeight: 1.35,
                overflowWrap: "anywhere",
              }}
            >
              Green-room command center
            </div>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Dashboard sections">
          {links.map((item, index) => (
            <a
              key={item.href}
              href={item.href}
              className={`sidebar-link ${index === 0 ? "active" : ""}`}
            >
              <span
                style={{
                  display: "block",
                  fontSize: 14,
                  fontWeight: 700,
                  lineHeight: 1.1,
                  overflowWrap: "anywhere",
                }}
              >
                {item.label}
              </span>
            </a>
          ))}
        </nav>

        <div
          style={{
            marginTop: "auto",
            display: "grid",
            gap: 12,
            paddingTop: 18,
          }}
        >
          <div className="card tight stoner-sidebar-card">
            <div
              className="muted"
              style={{
                fontSize: 12,
                lineHeight: 1.2,
                marginBottom: 8,
              }}
            >
              Server Session
            </div>

            <div
              style={{
                fontWeight: 800,
                fontSize: 14,
                lineHeight: 1.3,
                color: "var(--text-strong, #ffffff)",
                overflowWrap: "anywhere",
              }}
            >
              {env.guildId || "Missing guild id"}
            </div>
          </div>

          <div className="card tight stoner-sidebar-card">
            <div
              className="muted"
              style={{
                fontSize: 12,
                lineHeight: 1.2,
                marginBottom: 8,
              }}
            >
              Theme
            </div>

            <div
              style={{
                fontWeight: 800,
                fontSize: 14,
                lineHeight: 1.3,
                color: "var(--text-strong, #ffffff)",
                overflowWrap: "anywhere",
              }}
            >
              Stoney premium / green haze
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

import { env } from "@/lib/env"

const links = [
  { href: "/#overview", label: "Overview" },
  { href: "/#tickets", label: "Tickets" },
  { href: "/#members", label: "Members" },
  { href: "/#categories", label: "Categories" }
]

export default function Sidebar() {
  return (
    <aside className="sidebar stoner-sidebar">
      <div className="brand">
        <div className="brand-badge">🌿</div>

        <div>
          <div style={{ fontWeight: 800 }}>{env.appName || "Stoney Verify"}</div>
          <div className="muted" style={{ fontSize: 13 }}>
            Green-room command center
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {links.map((item, index) => (
          <a
            key={item.href}
            href={item.href}
            className={`sidebar-link ${index === 0 ? "active" : ""}`}
          >
            {item.label}
          </a>
        ))}
      </nav>

      <div className="card tight stoner-sidebar-card" style={{ marginTop: 18 }}>
        <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
          Server Session
        </div>

        <div style={{ fontWeight: 700, overflowWrap: "anywhere" }}>
          {env.guildId || "Missing guild id"}
        </div>
      </div>

      <div className="card tight stoner-sidebar-card" style={{ marginTop: 12 }}>
        <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
          Theme
        </div>

        <div style={{ fontWeight: 700 }}>
          Stoney premium / green haze
        </div>
      </div>
    </aside>
  )
}

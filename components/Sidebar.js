import { env } from "@/lib/env"

const links = [
  { href: "/#overview", label: "Overview" },
  { href: "/#tickets", label: "Tickets" },
  { href: "/#members", label: "Members" },
  { href: "/#roles", label: "Roles" },
  { href: "/#categories", label: "Categories" },
  { href: "/#timeline", label: "Timeline" }
]

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-badge">SV</div>
        <div>
          <div style={{ fontWeight: 800 }}>{env.appName}</div>
          <div className="muted" style={{ fontSize: 13 }}>Premium control center</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {links.map((item, index) => (
          <a key={item.href} href={item.href} className={`sidebar-link ${index === 0 ? "active" : ""}`}>
            {item.label}
          </a>
        ))}
      </nav>

      <div className="card tight" style={{ marginTop: 18 }}>
        <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>Guild ID</div>
        <div style={{ fontWeight: 700 }}>{process.env.GUILD_ID || "Missing GUILD_ID"}</div>
      </div>
    </aside>
  )
}

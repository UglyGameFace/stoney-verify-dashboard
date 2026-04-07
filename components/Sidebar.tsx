"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { env } from "@/lib/env";

type SidebarLink = {
  href: string;
  label: string;
  icon: string;
  match:
    | "exact"
    | "home-section"
    | "startsWith";
};

const links: SidebarLink[] = [
  { href: "/", label: "Dashboard", icon: "🏠", match: "exact" },
  { href: "/#overview", label: "Overview", icon: "📊", match: "home-section" },
  { href: "/#tickets", label: "Tickets", icon: "🎫", match: "home-section" },
  { href: "/#members", label: "Members", icon: "👥", match: "home-section" },
  { href: "/#categories", label: "Categories", icon: "🧩", match: "home-section" },
  {
    href: "/ticket-categories",
    label: "Category Manager",
    icon: "🛠️",
    match: "startsWith",
  },
];

function normalizeString(value: unknown): string {
  return String(value || "").trim();
}

function isLinkActive(pathname: string, link: SidebarLink): boolean {
  if (link.match === "exact") {
    return pathname === link.href;
  }

  if (link.match === "startsWith") {
    return pathname === link.href || pathname.startsWith(`${link.href}/`);
  }

  if (link.match === "home-section") {
    return pathname === "/";
  }

  return false;
}

export default function Sidebar() {
  const pathname = usePathname();
  const guildId = normalizeString(env.guildId) || "Missing guild id";
  const appName =
    normalizeString(env.appName) || "Stoney Verify Dashboard v3.8";

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
              {appName}
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

        <nav className="sidebar-nav" aria-label="Dashboard navigation">
          {links.map((item) => {
            const active = isLinkActive(pathname, item);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-link ${active ? "active" : ""}`}
              >
                <span className="sidebar-link-icon" aria-hidden="true">
                  {item.icon}
                </span>

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
              </Link>
            );
          })}
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
              {guildId}
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

      <style jsx>{`
        .sidebar-link {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .sidebar-link-icon {
          width: 18px;
          min-width: 18px;
          display: inline-flex;
          justify-content: center;
          align-items: center;
          font-size: 14px;
          line-height: 1;
        }
      `}</style>
    </aside>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { env } from "@/lib/env";

type SidebarLink = {
  href: string;
  label: string;
  helper?: string;
  icon: string;
  match: "exact" | "home-section" | "startsWith" | "ticket-detail";
};

type LinkGroup = {
  title: string;
  links: SidebarLink[];
};

type ServerRow = {
  id: string;
  name: string;
  selected?: boolean;
  bot_installed?: boolean;
};

type ServersPayload = {
  selectedGuildId?: string;
  servers?: ServerRow[];
};

const groups: LinkGroup[] = [
  {
    title: "Command Center",
    links: [
      { href: "/", label: "Dashboard", helper: "Overview + live queues", icon: "🏠", match: "exact" },
      { href: "/#tickets", label: "Tickets", helper: "Open, claim, close", icon: "🎫", match: "ticket-detail" },
      { href: "/#members", label: "Members", helper: "Search + history", icon: "👥", match: "home-section" },
    ],
  },
  {
    title: "Setup Flow",
    links: [
      { href: "/servers", label: "Servers", helper: "Pick active server", icon: "🛰️", match: "startsWith" },
      { href: "/ticket-categories", label: "Categories", helper: "Ticket routing", icon: "🧩", match: "startsWith" },
      { href: "/ticket-forms", label: "Forms", helper: "Questions + intake", icon: "📝", match: "startsWith" },
    ],
  },
];

function normalizeString(value: unknown): string {
  return String(value || "").trim();
}

function isTicketDetailPath(pathname: string): boolean {
  return pathname === "/tickets" || pathname.startsWith("/tickets/");
}

function isLinkActive(pathname: string, link: SidebarLink): boolean {
  if (link.match === "exact") return pathname === link.href;
  if (link.match === "startsWith") return pathname === link.href || pathname.startsWith(`${link.href}/`);
  if (link.match === "home-section") return pathname === "/";
  if (link.match === "ticket-detail") return pathname === "/" || isTicketDetailPath(pathname);
  return false;
}

function isSetupPath(pathname: string): boolean {
  return pathname === "/servers" || pathname.startsWith("/ticket-categories") || pathname.startsWith("/ticket-forms");
}

export default function Sidebar() {
  const pathname = usePathname();
  const [selectedServerName, setSelectedServerName] = useState("");
  const [installedCount, setInstalledCount] = useState<number | null>(null);
  const appName = normalizeString(env.appName) || "Dank Shield Dashboard";

  useEffect(() => {
    let active = true;

    async function loadSelectedServer() {
      try {
        const res = await fetch("/api/servers", {
          method: "GET",
          cache: "no-store",
          headers: { "Cache-Control": "no-store" },
        });
        const json = (await res.json().catch(() => null)) as ServersPayload | null;
        if (!active || !res.ok || !json) return;
        const rows = Array.isArray(json.servers) ? json.servers : [];
        const selectedId = normalizeString(json.selectedGuildId);
        const selected = rows.find((row) => row.selected || row.id === selectedId) || null;
        setSelectedServerName(normalizeString(selected?.name));
        setInstalledCount(rows.filter((row) => row.bot_installed).length);
      } catch {
        if (!active) return;
      }
    }

    void loadSelectedServer();
    return () => {
      active = false;
    };
  }, []);

  const setupStep = useMemo(() => {
    if (pathname === "/servers") return "Step 1: Server";
    if (pathname.startsWith("/ticket-categories")) return "Step 2: Categories";
    if (pathname.startsWith("/ticket-forms")) return "Step 3: Forms";
    return "Ready";
  }, [pathname]);

  return (
    <aside className="sidebar stoner-sidebar">
      <div className="sidebar-shell-inner">
        <div className="brand sidebar-brand">
          <div className="brand-badge">🌿</div>
          <div style={{ minWidth: 0 }}>
            <div className="sidebar-brand-title">{appName}</div>
            <div className="muted sidebar-brand-subtitle">Multi-server ticket command center</div>
          </div>
        </div>

        <div className="sidebar-context-card">
          <div className="sidebar-context-label">Selected Server</div>
          <div className="sidebar-context-name">{selectedServerName || "Choose a server"}</div>
          <div className="sidebar-context-meta">
            {installedCount === null ? "Checking bot access…" : `${installedCount} installed server${installedCount === 1 ? "" : "s"} available`}
          </div>
          <Link href="/servers" className="button ghost sidebar-mini-button">
            Change Server
          </Link>
        </div>

        <nav className="sidebar-nav" aria-label="Dashboard navigation">
          {groups.map((group) => (
            <div key={group.title} className="sidebar-group">
              <div className="sidebar-group-title">{group.title}</div>
              <div className="sidebar-group-links">
                {group.links.map((item) => {
                  const active = isLinkActive(pathname, item);
                  return (
                    <Link key={`${group.title}:${item.href}`} href={item.href} className={`sidebar-link ${active ? "active" : ""}`}>
                      <span className="sidebar-link-icon" aria-hidden="true">{item.icon}</span>
                      <span className="sidebar-link-copy">
                        <span className="sidebar-link-label">{item.label}</span>
                        {item.helper ? <span className="sidebar-link-helper">{item.helper}</span> : null}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {isSetupPath(pathname) ? (
          <div className="sidebar-flow-card">
            <div className="sidebar-flow-title">Setup Progress</div>
            <div className="sidebar-flow-current">{setupStep}</div>
            <div className="sidebar-flow-copy">Use Servers → Categories → Forms, then post your ticket panel in Discord.</div>
          </div>
        ) : null}

        <div className="sidebar-bottom">
          <Link href="/auth-status" className="button ghost sidebar-bottom-button">Auth Status</Link>
          <Link href="/api/auth/logout" className="button ghost sidebar-bottom-button">Reset Login</Link>
        </div>
      </div>

      <style jsx>{`
        .sidebar-shell-inner {
          height: 100%;
          display: flex;
          flex-direction: column;
          min-height: 0;
          gap: 14px;
        }
        .sidebar-brand {
          margin-bottom: 2px;
        }
        .sidebar-brand-title {
          font-weight: 950;
          font-size: 16px;
          line-height: 1.08;
          color: var(--text-strong, #ffffff);
          letter-spacing: -0.03em;
          overflow-wrap: anywhere;
        }
        .sidebar-brand-subtitle {
          margin-top: 4px;
          font-size: 12px;
          line-height: 1.35;
          overflow-wrap: anywhere;
        }
        .sidebar-context-card,
        .sidebar-flow-card {
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 18px;
          padding: 12px;
          background:
            radial-gradient(circle at top right, rgba(109,255,157,0.10), transparent 38%),
            rgba(255,255,255,0.055);
        }
        .sidebar-context-label,
        .sidebar-flow-title,
        .sidebar-group-title {
          color: var(--muted, #c7ddcf);
          font-size: 11px;
          font-weight: 950;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .sidebar-context-name,
        .sidebar-flow-current {
          margin-top: 6px;
          color: var(--text-strong, #fff);
          font-size: 15px;
          font-weight: 950;
          overflow-wrap: anywhere;
        }
        .sidebar-context-meta,
        .sidebar-flow-copy {
          margin-top: 4px;
          color: var(--muted, #c7ddcf);
          font-size: 12px;
          line-height: 1.35;
        }
        .sidebar-mini-button {
          margin-top: 10px;
          width: 100%;
          min-height: 42px;
          font-size: 13px;
        }
        .sidebar-nav {
          display: grid;
          gap: 16px;
          align-content: start;
        }
        .sidebar-group {
          display: grid;
          gap: 8px;
        }
        .sidebar-group-links {
          display: grid;
          gap: 8px;
        }
        .sidebar-link {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .sidebar-link-icon {
          width: 22px;
          min-width: 22px;
          display: inline-flex;
          justify-content: center;
          align-items: center;
          font-size: 15px;
          line-height: 1;
        }
        .sidebar-link-copy {
          display: grid;
          gap: 3px;
          min-width: 0;
        }
        .sidebar-link-label {
          display: block;
          font-size: 14px;
          font-weight: 900;
          line-height: 1.1;
          overflow-wrap: anywhere;
        }
        .sidebar-link-helper {
          display: block;
          color: var(--muted, #c7ddcf);
          font-size: 11px;
          line-height: 1.15;
          overflow-wrap: anywhere;
        }
        .sidebar-bottom {
          margin-top: auto;
          display: grid;
          gap: 10px;
          padding-top: 4px;
        }
        .sidebar-bottom-button {
          min-height: 44px;
          font-size: 13px;
        }
        @media (max-width: 1024px) {
          .sidebar-shell-inner {
            height: auto;
          }
          .sidebar-nav {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .sidebar-bottom {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 720px) {
          .sidebar-nav,
          .sidebar-bottom {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </aside>
  );
}

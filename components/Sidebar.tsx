"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { env } from "@/lib/env";
import QuickAppearancePanel from "@/components/dashboard/QuickAppearancePanel";

type SidebarLink = {
  href: string;
  label: string;
  helper?: string;
  icon: string;
  match: "exact" | "home-section" | "startsWith" | "ticket-detail";
  requiresServer?: boolean;
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
  installedCount?: number;
  botCheckError?: string | null;
};

function normalizeString(value: unknown): string {
  return String(value || "").trim();
}

function dashboardHref(guildId: string): string {
  return `/dashboard/${encodeURIComponent(normalizeString(guildId))}`;
}

function scopedLinks(selectedGuildId: string): LinkGroup[] {
  const base = selectedGuildId ? dashboardHref(selectedGuildId) : "";
  return [
    {
      title: "Command Center",
      links: [
        { href: base || "/", label: "Dashboard", helper: "Live control room", icon: "🏠", match: "exact" },
        { href: base ? `${base}#tickets` : "/#tickets", label: "Tickets", helper: "Open, claim, close", icon: "🎫", match: "ticket-detail", requiresServer: true },
        { href: base ? `${base}#members` : "/#members", label: "Members", helper: "Search + history", icon: "👥", match: "home-section", requiresServer: true },
      ],
    },
    {
      title: "Setup Flow",
      links: [
        { href: "/servers", label: "Servers", helper: "Select or invite bot", icon: "🛰️", match: "startsWith" },
        { href: base ? `${base}/categories` : "/ticket-categories", label: "Categories", helper: "Ticket routing", icon: "🧩", match: "startsWith", requiresServer: true },
        { href: base ? `${base}/forms` : "/ticket-forms", label: "Forms", helper: "Questions + intake", icon: "📝", match: "startsWith", requiresServer: true },
      ],
    },
  ];
}

function isTicketDetailPath(pathname: string): boolean {
  return pathname === "/tickets" || pathname.startsWith("/tickets/") || pathname.includes("#tickets");
}

function isLinkActive(pathname: string, link: SidebarLink): boolean {
  if (link.match === "exact") return pathname === link.href || (link.href.startsWith("/dashboard/") && pathname === link.href);
  if (link.match === "startsWith") return pathname === link.href || pathname.startsWith(`${link.href}/`);
  if (link.match === "home-section") return pathname === "/" || pathname.startsWith("/dashboard/");
  if (link.match === "ticket-detail") return pathname === "/" || pathname.startsWith("/dashboard/") || isTicketDetailPath(pathname);
  return false;
}

function isSetupPath(pathname: string): boolean {
  return pathname === "/servers" || pathname.startsWith("/ticket-categories") || pathname.startsWith("/ticket-forms") || pathname.includes("/categories") || pathname.includes("/forms");
}

export default function Sidebar() {
  const pathname = usePathname();
  const [selectedGuildId, setSelectedGuildId] = useState("");
  const [selectedServerName, setSelectedServerName] = useState("");
  const [installedCount, setInstalledCount] = useState<number | null>(null);
  const [hasSelectedServer, setHasSelectedServer] = useState(false);
  const [botCheckError, setBotCheckError] = useState("");
  const appName = normalizeString(env.appName) || "Dank Shield Dashboard";

  useEffect(() => {
    let active = true;

    async function loadSelectedServer() {
      try {
        const res = await fetch("/api/servers", {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
          headers: { "Cache-Control": "no-store" },
        });
        const json = (await res.json().catch(() => null)) as ServersPayload | null;
        if (!active || !res.ok || !json) return;
        const rows = Array.isArray(json.servers) ? json.servers : [];
        const selectedId = normalizeString(json.selectedGuildId);
        const selected = rows.find((row) => row.selected || row.id === selectedId) || null;
        setSelectedGuildId(selectedId);
        setSelectedServerName(normalizeString(selected?.name));
        setHasSelectedServer(Boolean(selectedId || selected));
        setInstalledCount(Number(json.installedCount ?? rows.filter((row) => row.bot_installed).length));
        setBotCheckError(normalizeString(json.botCheckError));
      } catch {
        if (!active) return;
      }
    }

    void loadSelectedServer();
    return () => {
      active = false;
    };
  }, []);

  const groups = useMemo(() => scopedLinks(selectedGuildId), [selectedGuildId]);

  const setupStep = useMemo(() => {
    if (pathname === "/servers") return "Step 1: Server";
    if (pathname.startsWith("/ticket-categories") || pathname.includes("/categories")) return "Step 2: Categories";
    if (pathname.startsWith("/ticket-forms") || pathname.includes("/forms")) return "Step 3: Forms";
    return hasSelectedServer ? "Ready" : "Server required";
  }, [pathname, hasSelectedServer]);

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
          <div className="sidebar-context-name">{selectedServerName || "None selected"}</div>
          <div className="sidebar-context-meta">
            {installedCount === null ? "Checking bot access…" : `${installedCount} ready server${installedCount === 1 ? "" : "s"} available`}
          </div>
          {botCheckError ? <div className="sidebar-context-warning">Bot check warning. Open Servers and refresh.</div> : null}
          <Link href="/servers" className="button ghost sidebar-mini-button">
            {hasSelectedServer ? "Change Server" : "Choose Server"}
          </Link>
        </div>

        <QuickAppearancePanel />

        <nav className="sidebar-nav" aria-label="Dashboard navigation">
          {groups.map((group) => {
            const links = group.links.filter((item) => !item.requiresServer || hasSelectedServer);
            if (!links.length) return null;
            return (
              <div key={group.title} className="sidebar-group">
                <div className="sidebar-group-title">{group.title}</div>
                <div className="sidebar-group-links">
                  {links.map((item) => {
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
            );
          })}
        </nav>

        {isSetupPath(pathname) ? (
          <div className="sidebar-flow-card">
            <div className="sidebar-flow-title">Setup Progress</div>
            <div className="sidebar-flow-current">{setupStep}</div>
            <div className="sidebar-flow-copy">Servers unlock dashboard data. Categories and forms unlock after a server is selected.</div>
          </div>
        ) : null}

        <div className="sidebar-bottom">
          <Link href="/auth-status" className="button ghost sidebar-bottom-button">Account</Link>
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
        .sidebar-flow-copy,
        .sidebar-context-warning {
          margin-top: 4px;
          color: var(--muted, #c7ddcf);
          font-size: 12px;
          line-height: 1.35;
        }
        .sidebar-context-warning {
          color: #fde68a;
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
          gap: 7px;
        }
        .sidebar-link {
          display: flex;
          align-items: center;
          gap: 10px;
          min-height: 48px;
          border-radius: 16px;
          padding: 9px 10px;
          color: var(--muted, #c7ddcf);
          text-decoration: none;
          border: 1px solid transparent;
          background: rgba(255,255,255,0.035);
          transition: 140ms ease;
        }
        .sidebar-link:hover,
        .sidebar-link.active {
          color: var(--text-strong, #fff);
          border-color: rgba(84,255,148,0.35);
          background: linear-gradient(135deg, rgba(0,77,38,0.78), rgba(0,36,58,0.72));
          box-shadow: 0 10px 24px rgba(0,255,135,0.10);
        }
        .sidebar-link-icon {
          width: 28px;
          height: 28px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          background: rgba(0,0,0,0.18);
          flex: 0 0 28px;
        }
        .sidebar-link-copy {
          min-width: 0;
          display: grid;
          gap: 1px;
        }
        .sidebar-link-label {
          font-weight: 900;
          font-size: 13px;
        }
        .sidebar-link-helper {
          font-size: 11px;
          color: var(--muted, #c7ddcf);
          line-height: 1.25;
        }
        .sidebar-bottom {
          margin-top: auto;
          display: grid;
          gap: 8px;
        }
        .sidebar-bottom-button {
          width: 100%;
          min-height: 42px;
          font-size: 13px;
        }
      `}</style>
    </aside>
  );
}

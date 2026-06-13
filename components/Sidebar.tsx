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

function routeGuildId(pathname: string): string {
  const match = normalizeString(pathname).match(/^\/dashboard\/([^/?#]+)/);
  if (!match?.[1]) return "";
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
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
        { href: base ? `${base}/channel-builder` : "/servers", label: "Channel Builder", helper: "Emoji + channel styles", icon: "🎨", match: "startsWith", requiresServer: true },
        { href: base ? `${base}/categories` : "/servers", label: "Categories", helper: "Ticket routing", icon: "🧩", match: "startsWith", requiresServer: true },
        { href: base ? `${base}/forms` : "/servers", label: "Forms", helper: "Questions + intake", icon: "📝", match: "startsWith", requiresServer: true },
      ],
    },
  ];
}

function isTicketDetailPath(pathname: string): boolean {
  return pathname === "/tickets" || pathname.startsWith("/tickets/");
}

function isLinkActive(pathname: string, link: SidebarLink): boolean {
  if (link.match === "exact") return pathname === link.href || (link.href.startsWith("/dashboard/") && pathname === link.href);
  if (link.match === "startsWith") return pathname === link.href || pathname.startsWith(`${link.href}/`);
  if (link.match === "home-section") return false;
  if (link.match === "ticket-detail") return isTicketDetailPath(pathname);
  return false;
}

function isSetupPath(pathname: string): boolean {
  return pathname === "/servers" || pathname.startsWith("/ticket-categories") || pathname.startsWith("/ticket-forms") || pathname.includes("/channel-builder") || pathname.includes("/categories") || pathname.includes("/forms");
}

export default function Sidebar() {
  const pathname = usePathname() || "/";
  const pathGuildId = routeGuildId(pathname);
  const [selectedGuildId, setSelectedGuildId] = useState(pathGuildId);
  const [selectedServerName, setSelectedServerName] = useState("");
  const [installedCount, setInstalledCount] = useState<number | null>(null);
  const [hasSelectedServer, setHasSelectedServer] = useState(Boolean(pathGuildId));
  const [botCheckError, setBotCheckError] = useState("");
  const appName = normalizeString(env.appName) || "Dank Shield Dashboard";

  useEffect(() => {
    const nextPathGuildId = routeGuildId(pathname);
    if (nextPathGuildId) {
      setSelectedGuildId(nextPathGuildId);
      setHasSelectedServer(true);
    }

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
        const selectedId = normalizeString(json.selectedGuildId) || nextPathGuildId;
        const selected = rows.find((row) => row.selected || row.id === selectedId) || null;
        setSelectedGuildId(selectedId);
        setSelectedServerName(normalizeString(selected?.name));
        setHasSelectedServer(Boolean(selectedId || selected));
        setInstalledCount(Number(json.installedCount ?? rows.filter((row) => row.bot_installed).length));
        setBotCheckError(normalizeString(json.botCheckError));
      } catch {
        if (!active) return;
        setSelectedGuildId(nextPathGuildId);
        setHasSelectedServer(Boolean(nextPathGuildId));
      }
    }

    void loadSelectedServer();
    return () => {
      active = false;
    };
  }, [pathname]);

  const groups = useMemo(() => scopedLinks(selectedGuildId), [selectedGuildId]);

  const setupStep = useMemo(() => {
    if (pathname === "/servers") return "Step 1: Server";
    if (pathname.includes("/channel-builder")) return "Step 2: Channel Builder";
    if (pathname.startsWith("/ticket-categories") || pathname.includes("/categories")) return "Step 3: Categories";
    if (pathname.startsWith("/ticket-forms") || pathname.includes("/forms")) return "Step 4: Forms";
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
          <div className="sidebar-context-name">{selectedServerName || (hasSelectedServer ? "Selected server" : "None selected")}</div>
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
            <div className="sidebar-flow-copy">Servers unlock dashboard data. Channel Builder, categories, and forms unlock after a server is selected.</div>
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
          margin-top: 5px;
          color: var(--text-strong, #ffffff);
          font-size: 14px;
          font-weight: 950;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .sidebar-context-meta,
        .sidebar-flow-copy,
        .sidebar-context-warning {
          margin-top: 5px;
          color: var(--muted, #c7ddcf);
          font-size: 12px;
          line-height: 1.35;
        }
        .sidebar-context-warning {
          color: #fed7aa;
        }
        .sidebar-mini-button,
        .sidebar-bottom-button {
          margin-top: 10px;
          width: 100%;
          min-height: 38px;
        }
        .sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 14px;
          min-height: 0;
          overflow-y: auto;
          padding-right: 2px;
        }
        .sidebar-group-title {
          margin-bottom: 7px;
        }
        .sidebar-group-links {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }
        .sidebar-link {
          display: flex;
          align-items: center;
          gap: 10px;
          min-height: 46px;
          border-radius: 16px;
          padding: 9px 10px;
          border: 1px solid rgba(255,255,255,0.10);
          color: var(--text, #edf8ef);
          text-decoration: none;
          background: rgba(255,255,255,0.045);
          transition: 160ms ease;
        }
        .sidebar-link:hover,
        .sidebar-link.active {
          border-color: rgba(109,255,157,0.42);
          background: rgba(109,255,157,0.12);
          transform: translateY(-1px);
        }
        .sidebar-link-icon {
          width: 30px;
          height: 30px;
          display: grid;
          place-items: center;
          border-radius: 12px;
          background: rgba(0,0,0,0.18);
          flex: 0 0 auto;
        }
        .sidebar-link-copy {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .sidebar-link-label {
          font-size: 13px;
          font-weight: 950;
          color: var(--text-strong, #ffffff);
          line-height: 1.1;
        }
        .sidebar-link-helper {
          color: var(--muted, #c7ddcf);
          font-size: 11px;
          line-height: 1.2;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .sidebar-bottom {
          margin-top: auto;
          display: grid;
          gap: 8px;
        }
      `}</style>
    </aside>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type ServerRow = {
  id?: string | null;
  selected?: boolean | null;
};

type ServersPayload = {
  selectedGuildId?: string | null;
  servers?: ServerRow[] | null;
};

type NavItem = {
  key: string;
  label: string;
  href: string;
  icon: string;
  requiresServer: boolean;
  match: (path: string) => boolean;
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

function buildNavItems(selectedGuildId: string): NavItem[] {
  const scopedBase = selectedGuildId ? dashboardHref(selectedGuildId) : "";
  return [
    {
      key: "home",
      label: "Home",
      href: scopedBase || "/",
      icon: "⌂",
      requiresServer: false,
      match: (path: string) => path === "/" || (Boolean(scopedBase) && path === scopedBase),
    },
    {
      key: "servers",
      label: "Servers",
      href: "/servers",
      icon: "◈",
      requiresServer: false,
      match: (path: string) => path === "/servers",
    },
    {
      key: "categories",
      label: "Categories",
      href: scopedBase ? `${scopedBase}/categories` : "/ticket-categories",
      icon: "▣",
      requiresServer: true,
      match: (path: string) => path.startsWith("/ticket-categories") || /^\/dashboard\/[^/]+\/categories/.test(path),
    },
    {
      key: "forms",
      label: "Forms",
      href: scopedBase ? `${scopedBase}/forms` : "/ticket-forms",
      icon: "✎",
      requiresServer: true,
      match: (path: string) => path.startsWith("/ticket-forms") || /^\/dashboard\/[^/]+\/forms/.test(path),
    },
    {
      key: "account",
      label: "Account",
      href: "/auth-status",
      icon: "♙",
      requiresServer: false,
      match: (path: string) => path.startsWith("/auth-status"),
    },
  ];
}

function isDashboardPath(pathname: string): boolean {
  if (!pathname) return false;
  if (pathname.startsWith("/api")) return false;
  if (pathname.startsWith("/auth/")) return false;
  return true;
}

function hasAuthRequiredState(): boolean {
  if (typeof document === "undefined") return false;
  return Boolean(document.querySelector('[data-auth-state="required"]'));
}

export default function GlobalDashboardNav() {
  const pathname = usePathname() || "/";
  const routeSelectedGuildId = routeGuildId(pathname);
  const [localNavPresent, setLocalNavPresent] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [selectedGuildId, setSelectedGuildId] = useState(routeSelectedGuildId);
  const [hasSelectedServer, setHasSelectedServer] = useState(Boolean(routeSelectedGuildId));

  useEffect(() => {
    setMounted(true);
    const check = () => {
      setLocalNavPresent(Boolean(document.querySelector(".sv-mobile-nav-wrap")));
      setAuthRequired(hasAuthRequiredState());
    };

    check();
    const timer = window.setTimeout(check, 250);
    window.addEventListener("resize", check);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", check);
    };
  }, [pathname]);

  useEffect(() => {
    const pathGuildId = routeGuildId(pathname);
    if (pathGuildId) {
      setSelectedGuildId(pathGuildId);
      setHasSelectedServer(true);
    }

    let active = true;

    async function loadServerContext() {
      try {
        const res = await fetch("/api/servers", {
          method: "GET",
          cache: "no-store",
          headers: { "Cache-Control": "no-store" },
        });
        const json = (await res.json().catch(() => null)) as ServersPayload | null;
        if (!active || !res.ok || !json) return;
        const rows = Array.isArray(json.servers) ? json.servers : [];
        const selectedRow = rows.find((row) => Boolean(row?.selected));
        const selectedId = normalizeString(json.selectedGuildId) || normalizeString(selectedRow?.id) || pathGuildId;
        setSelectedGuildId(selectedId);
        setHasSelectedServer(Boolean(selectedId));
      } catch {
        if (!active) return;
        setSelectedGuildId(pathGuildId);
        setHasSelectedServer(Boolean(pathGuildId));
      }
    }

    void loadServerContext();
    return () => {
      active = false;
    };
  }, [pathname]);

  const navItems = useMemo(
    () => buildNavItems(selectedGuildId).filter((item) => !item.requiresServer || hasSelectedServer),
    [hasSelectedServer, selectedGuildId]
  );

  const shouldShow = useMemo(
    () => mounted && isDashboardPath(pathname) && !localNavPresent && !authRequired,
    [mounted, pathname, localNavPresent, authRequired]
  );

  if (!shouldShow) return null;

  return (
    <nav className="global-bottom-nav-wrap" aria-label="Dashboard navigation">
      <div className="global-bottom-nav-shell" style={{ gridTemplateColumns: `repeat(${navItems.length || 1}, minmax(0, 1fr))` }}>
        {navItems.map((item) => {
          const active = item.match(pathname);
          return (
            <Link key={item.key} href={item.href} className={`global-bottom-nav-item ${active ? "active" : ""}`} aria-current={active ? "page" : undefined}>
              <span className="global-bottom-nav-icon" aria-hidden="true">{item.icon}</span>
              <span className="global-bottom-nav-label">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

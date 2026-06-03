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

const BASE_NAV_ITEMS = [
  { key: "home", label: "Home", href: "/", icon: "⌂", requiresServer: false, match: (path: string) => path === "/" },
  { key: "servers", label: "Servers", href: "/servers", icon: "◈", requiresServer: false, match: (path: string) => path === "/servers" },
  { key: "categories", label: "Categories", href: "/ticket-categories", icon: "▣", requiresServer: true, match: (path: string) => path.startsWith("/ticket-categories") },
  { key: "forms", label: "Forms", href: "/ticket-forms", icon: "✎", requiresServer: true, match: (path: string) => path.startsWith("/ticket-forms") },
  { key: "account", label: "Account", href: "/auth-status", icon: "♙", requiresServer: false, match: (path: string) => path.startsWith("/auth-status") },
];

function normalizeString(value: unknown): string {
  return String(value || "").trim();
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
  const [localNavPresent, setLocalNavPresent] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [hasSelectedServer, setHasSelectedServer] = useState(false);

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
        const selectedId = normalizeString(json.selectedGuildId);
        const rows = Array.isArray(json.servers) ? json.servers : [];
        setHasSelectedServer(Boolean(selectedId || rows.some((row) => Boolean(row?.selected))));
      } catch {
        if (!active) return;
        setHasSelectedServer(false);
      }
    }

    void loadServerContext();
    return () => {
      active = false;
    };
  }, []);

  const navItems = useMemo(
    () => BASE_NAV_ITEMS.filter((item) => !item.requiresServer || hasSelectedServer),
    [hasSelectedServer]
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

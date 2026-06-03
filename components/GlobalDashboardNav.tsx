"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const NAV_ITEMS = [
  { key: "home", label: "Home", href: "/", icon: "⌂", match: (path: string) => path === "/" },
  { key: "servers", label: "Servers", href: "/servers", icon: "◈", match: (path: string) => path === "/servers" },
  { key: "categories", label: "Categories", href: "/ticket-categories", icon: "▣", match: (path: string) => path.startsWith("/ticket-categories") },
  { key: "forms", label: "Forms", href: "/ticket-forms", icon: "✎", match: (path: string) => path.startsWith("/ticket-forms") },
  { key: "account", label: "Account", href: "/auth-status", icon: "♙", match: (path: string) => path.startsWith("/auth-status") },
];

function isDashboardPath(pathname: string): boolean {
  if (!pathname) return false;
  if (pathname.startsWith("/api")) return false;
  if (pathname.startsWith("/auth/")) return false;
  return true;
}

export default function GlobalDashboardNav() {
  const pathname = usePathname() || "/";
  const [localNavPresent, setLocalNavPresent] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const check = () => {
      setLocalNavPresent(Boolean(document.querySelector(".sv-mobile-nav-wrap")));
    };

    check();
    const timer = window.setTimeout(check, 250);
    window.addEventListener("resize", check);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", check);
    };
  }, [pathname]);

  const shouldShow = useMemo(() => mounted && isDashboardPath(pathname) && !localNavPresent, [mounted, pathname, localNavPresent]);

  if (!shouldShow) return null;

  return (
    <nav className="global-bottom-nav-wrap" aria-label="Dashboard navigation">
      <div className="global-bottom-nav-shell">
        {NAV_ITEMS.map((item) => {
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

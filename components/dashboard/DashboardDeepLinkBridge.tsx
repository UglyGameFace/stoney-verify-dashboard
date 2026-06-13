"use client";

import { useEffect } from "react";

const TAB_ALIASES: Record<string, string> = {
  ticket: "tickets",
  tickets: "tickets",
  queue: "tickets",
  "test-ticket": "tickets",
  "test-ticket-flow": "tickets",
  account: "account",
  profile: "account",
  home: "home",
  setup: "home",
};

function normalize(value: string | null | undefined): string {
  return String(value || "").trim().toLowerCase().replace(/^#/, "");
}

function readRequestedTab(): string {
  if (typeof window === "undefined") return "";

  const params = new URLSearchParams(window.location.search || "");
  const queryTab = normalize(params.get("tab") || params.get("view") || params.get("section"));
  const hashTab = normalize(window.location.hash || "");

  return TAB_ALIASES[queryTab] || TAB_ALIASES[hashTab] || "";
}

function buttonLooksLikeTab(button: HTMLButtonElement, tab: string): boolean {
  const text = normalize(button.textContent || "");
  const aria = normalize(button.getAttribute("aria-label"));
  const value = normalize(button.getAttribute("value"));
  return text === tab || aria === tab || value === tab;
}

function activateTab(tab: string): boolean {
  if (typeof document === "undefined") return false;
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>("button"));
  const target = buttons.find((button) => buttonLooksLikeTab(button, tab));
  if (!target) return false;
  target.click();
  try {
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  } catch {
    // noop
  }
  return true;
}

export default function DashboardDeepLinkBridge() {
  useEffect(() => {
    let retries = 0;
    let timer: number | undefined;

    const run = () => {
      const tab = readRequestedTab();
      if (!tab) return;
      if (activateTab(tab)) return;
      if (retries >= 20) return;
      retries += 1;
      timer = window.setTimeout(run, 150);
    };

    run();
    window.addEventListener("hashchange", run);
    window.addEventListener("popstate", run);

    return () => {
      window.removeEventListener("hashchange", run);
      window.removeEventListener("popstate", run);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  return null;
}

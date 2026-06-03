"use client";

import { useEffect, useState } from "react";
import QuickAppearancePanel from "@/components/dashboard/QuickAppearancePanel";

function hasAuthRequiredState(): boolean {
  if (typeof document === "undefined") return false;
  return Boolean(document.querySelector('[data-auth-state="required"]'));
}

export default function QuickAppearanceDock() {
  const [open, setOpen] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);

  useEffect(() => {
    const check = () => setAuthRequired(hasAuthRequiredState());
    check();
    const timer = window.setTimeout(check, 250);
    window.addEventListener("resize", check);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", check);
    };
  }, []);

  useEffect(() => {
    if (authRequired) setOpen(false);
  }, [authRequired]);

  if (authRequired) return null;

  return (
    <div className={`quick-appearance-dock ${open ? "open" : ""}`}>
      {open ? (
        <div className="quick-appearance-dock-panel">
          <div className="quick-appearance-dock-head">
            <div>
              <div className="muted quick-appearance-eyebrow">Readable UI</div>
              <strong>Appearance</strong>
            </div>
            <button type="button" className="quick-appearance-close" onClick={() => setOpen(false)} aria-label="Close appearance controls">
              ×
            </button>
          </div>
          <QuickAppearancePanel />
        </div>
      ) : null}

      <button
        type="button"
        className="quick-appearance-floating-button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label="Open appearance controls"
      >
        <span aria-hidden="true">◐</span>
        <strong>Appearance</strong>
      </button>
    </div>
  );
}

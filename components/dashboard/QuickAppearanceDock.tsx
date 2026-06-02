"use client";

import { useState } from "react";
import QuickAppearancePanel from "@/components/dashboard/QuickAppearancePanel";

export default function QuickAppearanceDock() {
  const [open, setOpen] = useState(false);

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

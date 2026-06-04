"use client";

import { useMemo, useState } from "react";

type HealthCheck = {
  key?: string;
  label?: string;
  description?: string;
  ok?: boolean;
  severity?: "required" | "recommended" | "optional" | string;
  action_label?: string;
  action_href?: string;
  detail?: string;
};

type SetupHealth = {
  ok?: boolean;
  selectedGuildId?: string | null;
  score?: number;
  total?: number;
  passed?: number;
  required_total?: number;
  required_passed?: number;
  ready_for_launch?: boolean;
  next_fix?: HealthCheck | null;
  checks?: HealthCheck[];
  summary?: Record<string, unknown>;
  error?: string;
};

function safeArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function normalizeString(value: unknown): string {
  return String(value || "").trim();
}

function severityLabel(value: unknown) {
  const clean = normalizeString(value).toLowerCase();
  if (clean === "required") return "Required";
  if (clean === "recommended") return "Recommended";
  if (clean === "optional") return "Optional";
  return "Check";
}

function severityClass(value: unknown) {
  const clean = normalizeString(value).toLowerCase();
  if (clean === "required") return "required";
  if (clean === "recommended") return "recommended";
  if (clean === "optional") return "optional";
  return "neutral";
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export default function SetupDoctorPanel({ initialHealth = null }: { initialHealth?: SetupHealth | null }) {
  const [health, setHealth] = useState<SetupHealth | null>(initialHealth);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const checks = useMemo(() => safeArray<HealthCheck>(health?.checks), [health]);
  const nextFix = health?.next_fix || checks.find((check) => !check.ok && check.severity === "required") || checks.find((check) => !check.ok) || null;
  const ready = Boolean(health?.ready_for_launch);
  const score = Number(health?.score || 0);
  const passed = Number(health?.passed || 0);
  const total = Number(health?.total || checks.length || 0);

  async function refreshDoctor() {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/setup/health", { method: "GET", cache: "no-store", headers: { "Cache-Control": "no-store" } });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.error) throw new Error(json?.error || "Failed to refresh setup doctor.");
      setHealth(json);
      setMessage("Setup doctor refreshed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh setup doctor.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy(command: string) {
    const ok = await copyText(command);
    setMessage(ok ? `Copied ${command}` : `Copy failed. Manually run ${command}`);
  }

  return (
    <section className="card setup-doctor-card">
      <div className="setup-doctor-head">
        <div>
          <div className="muted setup-doctor-eyebrow">Setup Doctor</div>
          <h2>{ready ? "Launch checks passed" : "What to fix next"}</h2>
          <p className="muted">
            This reads the real selected server state and turns it into a step-by-step launch checklist. No guessing, no mystery red flags.
          </p>
        </div>
        <button type="button" className="button ghost" onClick={() => void refreshDoctor()} disabled={loading}>
          {loading ? "Checking..." : "Run Doctor"}
        </button>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}
      {message ? <div className="info-banner">{message}</div> : null}

      <div className="doctor-score-grid">
        <div><span>Setup Score</span><strong>{score}%</strong></div>
        <div><span>Checks Passing</span><strong>{passed}/{total}</strong></div>
        <div><span>Status</span><strong>{ready ? "Ready" : "Needs work"}</strong></div>
      </div>

      {nextFix ? (
        <div className="doctor-next-fix">
          <div>
            <div className="muted setup-doctor-eyebrow">Next Fix</div>
            <strong>{normalizeString(nextFix.label) || "Review setup"}</strong>
            <p>{normalizeString(nextFix.description) || normalizeString(nextFix.detail) || "Open the matching setup page and review this item."}</p>
          </div>
          <a className="button primary" href={normalizeString(nextFix.action_href) || "/servers"}>{normalizeString(nextFix.action_label) || "Fix Now"}</a>
        </div>
      ) : null}

      <div className="doctor-command-box">
        <div>
          <div className="muted setup-doctor-eyebrow">Discord Panel Commands</div>
          <strong>Publish and verify the public ticket panel</strong>
          <p className="muted">Run these inside the Discord channel where members should open tickets. The doctor check verifies the panel after it is posted.</p>
        </div>
        <div className="doctor-command-actions">
          <button type="button" className="button ghost" onClick={() => void handleCopy("/ticket-panel post")}>Copy /ticket-panel post</button>
          <button type="button" className="button ghost" onClick={() => void handleCopy("/ticket-panel doctor")}>Copy /ticket-panel doctor</button>
        </div>
      </div>

      <div className="doctor-check-list">
        {checks.map((check) => {
          const ok = Boolean(check.ok);
          const href = normalizeString(check.action_href) || "#";
          return (
            <a key={normalizeString(check.key) || normalizeString(check.label)} href={href} className={`doctor-check-row ${ok ? "ok" : "todo"}`}>
              <span className="doctor-dot">{ok ? "✓" : "!"}</span>
              <span className="doctor-check-main">
                <strong>{normalizeString(check.label) || "Setup check"}</strong>
                <em>{normalizeString(check.description) || normalizeString(check.detail) || "Review this setup item."}</em>
                {check.detail ? <small>{normalizeString(check.detail)}</small> : null}
              </span>
              <span className={`doctor-severity ${severityClass(check.severity)}`}>{severityLabel(check.severity)}</span>
            </a>
          );
        })}
      </div>

      <style jsx>{`
        .setup-doctor-card { display: grid; gap: 14px; }
        .setup-doctor-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; flex-wrap: wrap; }
        .setup-doctor-head h2 { margin: 0; }
        .setup-doctor-head p { max-width: 780px; line-height: 1.55; margin: 8px 0 0; }
        .setup-doctor-eyebrow { font-size: 12px; letter-spacing: .08em; text-transform: uppercase; font-weight: 950; margin-bottom: 8px; }
        .doctor-score-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
        .doctor-score-grid > div, .doctor-next-fix, .doctor-command-box { border: 1px solid rgba(255,255,255,.12); border-radius: 18px; background: rgba(255,255,255,.045); padding: 14px; }
        .doctor-score-grid span { color: var(--muted,#9fb0c3); display: block; margin-bottom: 5px; }
        .doctor-score-grid strong { color: var(--text-strong,#fff); font-size: 24px; }
        .doctor-next-fix, .doctor-command-box { display: flex; justify-content: space-between; gap: 12px; align-items: center; flex-wrap: wrap; }
        .doctor-next-fix strong, .doctor-command-box strong { display: block; color: var(--text-strong,#fff); font-size: 18px; }
        .doctor-next-fix p, .doctor-command-box p { margin: 6px 0 0; line-height: 1.5; max-width: 760px; }
        .doctor-command-actions { display: flex; gap: 10px; flex-wrap: wrap; }
        .doctor-command-actions .button { width: auto; min-width: 190px; }
        .doctor-check-list { display: grid; gap: 8px; }
        .doctor-check-row { text-decoration: none; color: inherit; display: grid; grid-template-columns: 34px minmax(0,1fr) auto; gap: 10px; align-items: center; border: 1px solid rgba(255,255,255,.1); border-radius: 16px; padding: 12px; background: rgba(255,255,255,.035); }
        .doctor-check-row.ok { border-color: rgba(93,255,141,.16); }
        .doctor-check-row.todo { border-color: rgba(255,211,107,.2); }
        .doctor-dot { width: 30px; height: 30px; border-radius: 999px; display: grid; place-items: center; background: rgba(255,255,255,.08); font-weight: 950; }
        .doctor-check-row.ok .doctor-dot { background: rgba(93,255,141,.16); }
        .doctor-check-row.todo .doctor-dot { background: rgba(255,211,107,.16); }
        .doctor-check-main { min-width: 0; display: grid; gap: 4px; }
        .doctor-check-main strong { color: var(--text-strong,#fff); overflow-wrap: anywhere; }
        .doctor-check-main em, .doctor-check-main small { color: var(--muted,#9fb0c3); font-style: normal; line-height: 1.4; overflow-wrap: anywhere; }
        .doctor-severity { border-radius: 999px; padding: 7px 10px; font-size: 12px; font-weight: 900; border: 1px solid rgba(255,255,255,.12); color: var(--text-strong,#fff); }
        .doctor-severity.required { background: rgba(255,111,142,.14); }
        .doctor-severity.recommended { background: rgba(255,211,107,.13); }
        .doctor-severity.optional { background: rgba(99,213,255,.12); }
        @media (max-width: 720px) { .doctor-score-grid { grid-template-columns: 1fr; } .setup-doctor-head, .doctor-next-fix, .doctor-command-box, .doctor-command-actions { display: grid; grid-template-columns: 1fr; } .setup-doctor-head .button, .doctor-next-fix .button, .doctor-command-actions .button { width: 100%!important; } .doctor-check-row { grid-template-columns: 30px minmax(0,1fr); } .doctor-severity { grid-column: 2; width: fit-content; } }
      `}</style>
    </section>
  );
}

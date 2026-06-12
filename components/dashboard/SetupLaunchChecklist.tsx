import Link from "next/link";
import { headers } from "next/headers";
import SetupDoctorPanel from "@/components/dashboard/SetupDoctorPanel";

type DashboardData = Record<string, unknown> | null | undefined;

type SetupCheck = {
  key?: string | null;
  label?: string | null;
  description?: string | null;
  ok?: boolean | null;
  severity?: string | null;
  action_label?: string | null;
  action_href?: string | null;
  detail?: string | null;
};

type SetupHealth = {
  ok?: boolean | null;
  score?: number | null;
  total?: number | null;
  passed?: number | null;
  required_total?: number | null;
  required_passed?: number | null;
  ready_for_launch?: boolean | null;
  needsServerSelection?: boolean | null;
  selectedGuildId?: string | null;
  next_fix?: SetupCheck | null;
  checks?: SetupCheck[] | null;
  summary?: Record<string, unknown> | null;
  error?: string | null;
};

type SetupLaunchChecklistProps = {
  data?: DashboardData;
  selectedGuildId?: string | null;
};

function safeArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function normalizeString(value: unknown): string {
  return String(value || "").trim();
}

function normalizeSeverity(check: SetupCheck | null | undefined): string {
  return normalizeString(check?.severity).toLowerCase();
}

function isOptionalCheck(check: SetupCheck | null | undefined): boolean {
  return normalizeSeverity(check) === "optional";
}

function countRows(data: DashboardData, key: string): number {
  if (!data || typeof data !== "object") return 0;
  return safeArray((data as Record<string, unknown>)[key]).length;
}

function getSelectedGuild(data: DashboardData, selectedGuildId?: string | null): string {
  if (selectedGuildId) return normalizeString(selectedGuildId);
  if (!data || typeof data !== "object") return "";
  return normalizeString((data as Record<string, unknown>).selectedGuildId);
}

function StepBadge({ done }: { done: boolean }) {
  return <span className={`launch-step-badge ${done ? "done" : "todo"}`}>{done ? "✓" : "•"}</span>;
}

function resolveAppOrigin(): string {
  const headerStore = headers();
  const envOrigin =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

  if (envOrigin) return String(envOrigin).replace(/\/+$/, "");

  const host = normalizeString(headerStore.get("x-forwarded-host")) || normalizeString(headerStore.get("host"));
  const proto = normalizeString(headerStore.get("x-forwarded-proto")) || (host.includes("localhost") ? "http" : "https");
  return host ? `${proto}://${host}` : "http://127.0.0.1:3000";
}

async function loadSetupHealth(): Promise<SetupHealth | null> {
  try {
    const headerStore = headers();
    const origin = resolveAppOrigin();
    const cookieHeader = normalizeString(headerStore.get("cookie"));
    const authHeader = normalizeString(headerStore.get("authorization"));

    const response = await fetch(`${origin}/api/setup/health`, {
      method: "GET",
      cache: "no-store",
      headers: {
        accept: "application/json",
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
        ...(authHeader ? { authorization: authHeader } : {}),
        "x-dashboard-internal": "1",
      },
      next: { revalidate: 0 },
    });
    const json = (await response.json().catch(() => null)) as SetupHealth | null;
    return json && typeof json === "object" ? json : null;
  } catch {
    return null;
  }
}

function fallbackChecks(data: DashboardData, selectedGuildId?: string | null): SetupCheck[] {
  const guildId = getSelectedGuild(data, selectedGuildId);
  const categoryCount = countRows(data, "categories");
  const ticketCount = countRows(data, "tickets");

  if (!guildId) {
    return [
      {
        key: "server_selected",
        label: "Choose Server",
        description: "Pick the Discord server this dashboard should manage.",
        ok: false,
        severity: "required",
        action_label: "Choose Server",
        action_href: "/servers",
        detail: "No selected server",
      },
    ];
  }

  return [
    {
      key: "server_selected",
      label: "Server Selected",
      description: "Dashboard context is active for one Discord server.",
      ok: true,
      severity: "required",
      action_label: "Change Server",
      action_href: "/servers",
      detail: guildId,
    },
    {
      key: "categories_created",
      label: "Ticket Categories",
      description: categoryCount ? `${categoryCount} category${categoryCount === 1 ? "" : "ies"} found.` : "Add support, verification, appeals, and service categories.",
      ok: categoryCount > 0,
      severity: "required",
      action_label: categoryCount ? "Tune Categories" : "Create Categories",
      action_href: "/ticket-categories",
      detail: `${categoryCount} categories`,
    },
    {
      key: "forms_configured",
      label: "Forms / Direct Flow",
      description: "Use smart defaults, custom questions, or intentionally open tickets directly.",
      ok: categoryCount > 0,
      severity: "recommended",
      action_label: "Configure Forms",
      action_href: "/ticket-forms",
      detail: categoryCount ? "Direct flow or smart defaults available" : "Create categories first",
    },
    {
      key: "test_ticket",
      label: "Test Ticket Flow",
      description: "Open a test ticket, confirm category routing, then close/reopen/delete from the dashboard.",
      ok: ticketCount > 0,
      severity: "required",
      action_label: "Test Ticket Flow",
      action_href: "/#tickets",
      detail: `${ticketCount} tickets`,
    },
  ];
}

function compactChecks(checks: SetupCheck[], hasSelectedGuild: boolean): SetupCheck[] {
  if (!hasSelectedGuild) return checks.filter((check) => normalizeString(check.key) === "server_selected").slice(0, 1);

  const preferred = [
    "server_selected",
    "categories_created",
    "categories_named",
    "default_category",
    "forms_configured",
    "test_ticket",
    "command_queue_clear",
  ];
  const byKey = new Map(checks.map((check) => [normalizeString(check.key), check]));
  const ordered = preferred.map((key) => byKey.get(key)).filter(Boolean) as SetupCheck[];
  if (ordered.length >= 4) return ordered.slice(0, 6);
  return checks.slice(0, 6);
}

function getHiddenIncompleteChecks(checks: SetupCheck[], visibleChecks: SetupCheck[]): SetupCheck[] {
  const visibleKeys = new Set(visibleChecks.map((check) => normalizeString(check.key) || normalizeString(check.label)));
  return checks.filter((check) => {
    const key = normalizeString(check.key) || normalizeString(check.label);
    return !Boolean(check.ok) && !isOptionalCheck(check) && !visibleKeys.has(key);
  });
}

function describeHiddenCheck(check: SetupCheck): string {
  const label = normalizeString(check.label) || "Setup check";
  const severity = normalizeString(check.severity) || "check";
  const detail = normalizeString(check.detail);
  return `${label} (${severity})${detail ? ` — ${detail}` : ""}`;
}

function getPanelReadiness(checks: SetupCheck[]): boolean {
  const categoryCheck = checks.find((check) => normalizeString(check.key) === "categories_created");
  const defaultCategoryCheck = checks.find((check) => normalizeString(check.key) === "default_category");
  return Boolean(categoryCheck?.ok || defaultCategoryCheck?.ok);
}

function getSetupStage(hasSelectedGuild: boolean, nextFix: SetupCheck | null): string {
  if (!hasSelectedGuild) return "Step 1 of 3";
  const href = normalizeString(nextFix?.action_href);
  if (href.startsWith("/ticket-categories") || href.includes("/categories")) return "Step 2 of 3";
  if (href.startsWith("/ticket-forms") || href.includes("/forms")) return "Step 3 of 3";
  return "Setup Health";
}

function getDoctorSummary(ready: boolean, score: number, passed: number, total: number, optionalLeft: number): string {
  if (ready && optionalLeft > 0) return `Full doctor report • ${passed}/${total} total • ${optionalLeft} optional left`;
  if (ready) return `Full doctor report • all ${total} checks passed`;
  return `Open full doctor report • ${score}% • ${passed}/${total}`;
}

export default async function SetupLaunchChecklist({ data, selectedGuildId }: SetupLaunchChecklistProps) {
  const health = await loadSetupHealth();
  const guildId = normalizeString(selectedGuildId || health?.selectedGuildId || getSelectedGuild(data, selectedGuildId));
  const hasSelectedGuild = Boolean(guildId);
  const checks = safeArray<SetupCheck>(health?.checks).length ? safeArray<SetupCheck>(health?.checks) : fallbackChecks(data, selectedGuildId);
  const visibleChecks = compactChecks(checks, hasSelectedGuild);
  const hiddenIncompleteChecks = getHiddenIncompleteChecks(checks, visibleChecks);
  const passed = Number(health?.passed ?? checks.filter((check) => Boolean(check.ok)).length);
  const total = Number(health?.total ?? checks.length);
  const score = Number(health?.score ?? (total ? Math.round((passed / total) * 100) : 0));
  const requiredChecks = checks.filter((check) => normalizeSeverity(check) === "required");
  const requiredTotal = Number(health?.required_total ?? requiredChecks.length);
  const requiredPassed = Number(health?.required_passed ?? requiredChecks.filter((check) => Boolean(check.ok)).length);
  const launchScore = requiredTotal ? Math.round((requiredPassed / requiredTotal) * 100) : score;
  const optionalIncompleteCount = checks.filter((check) => !Boolean(check.ok) && isOptionalCheck(check)).length;
  const ready = Boolean(health?.ready_for_launch);
  const nextFix = health?.next_fix || checks.find((check) => !check.ok && normalizeSeverity(check) === "required") || checks.find((check) => !check.ok && !isOptionalCheck(check)) || null;
  const nextFixHref = normalizeString(nextFix?.action_href) || (hasSelectedGuild ? "/ticket-categories" : "/servers");
  const nextFixLabel = normalizeString(nextFix?.action_label) || (hasSelectedGuild ? "Fix Next" : "Choose Server");
  const canShowPanelCommands = hasSelectedGuild && getPanelReadiness(checks);
  const showNextFix = Boolean(nextFix && (!ready || !isOptionalCheck(nextFix)));
  const checksSummary = hiddenIncompleteChecks.length
    ? `View launch checks (${visibleChecks.length} shown, ${hiddenIncompleteChecks.length} hidden left)`
    : hasSelectedGuild
      ? "View launch checks"
      : "Why this is required";

  return (
    <div className="setup-launch-stack">
      <section className={`card launch-card ${hasSelectedGuild ? "server-selected" : "server-required"}`} aria-label="Dank Shield setup checklist">
        <div className="launch-head">
          <div>
            <div className="muted launch-eyebrow">{getSetupStage(hasSelectedGuild, nextFix)}</div>
            <h2 className="launch-title">
              {hasSelectedGuild ? (ready ? "Ready to launch" : "Finish setup without guessing") : "Choose a server to continue"}
            </h2>
            <p className="muted launch-copy">
              {hasSelectedGuild
                ? "Dank Shield checks required launch blockers first. Forms are optional; basic ticket panels work once ticket categories are ready."
                : "Staff tools stay locked until one Discord server is selected. That prevents tickets, forms, activity, and member data from mixing across servers."}
            </p>
          </div>
        </div>

        <div className="setup-health-summary">
          <div>
            <span>Launch Score</span>
            <strong>{launchScore}%</strong>
          </div>
          <div>
            <span>Required Checks</span>
            <strong>{requiredPassed}/{requiredTotal || total}</strong>
          </div>
          <div>
            <span>Launch Status</span>
            <strong>{hasSelectedGuild ? (ready ? "Ready" : "Needs work") : "Server required"}</strong>
          </div>
        </div>

        {showNextFix ? (
          <div className="setup-next-fix">
            <div>
              <div className="muted launch-eyebrow">Next Fix</div>
              <strong>{normalizeString(nextFix?.label) || (hasSelectedGuild ? "Review setup" : "Choose Server")}</strong>
              <p>{normalizeString(nextFix?.description) || normalizeString(nextFix?.detail) || "Open the setup tools and review this server."}</p>
            </div>
            <Link href={nextFixHref} className="button primary">
              {nextFixLabel}
            </Link>
          </div>
        ) : null}

        <details className="setup-check-details">
          <summary>{checksSummary}</summary>
          <div className="launch-grid">
            {visibleChecks.map((check, index) => {
              const done = Boolean(check.ok);
              const label = normalizeString(check.label) || `Check ${index + 1}`;
              const href = normalizeString(check.action_href) || "/";
              return (
                <Link key={normalizeString(check.key) || label} href={href} className={`launch-step ${done ? "done" : "todo"}`}>
                  <div className="launch-step-top">
                    <StepBadge done={done} />
                    <span className="launch-step-number">{normalizeString(check.severity) || "check"}</span>
                  </div>
                  <strong>{label}</strong>
                  <span className="launch-step-helper">{normalizeString(check.description) || normalizeString(check.detail) || "Review this setup item."}</span>
                  {check.detail ? <span className="launch-step-helper detail">{normalizeString(check.detail)}</span> : null}
                  <span className="launch-step-cta">{normalizeString(check.action_label) || "Open"} →</span>
                </Link>
              );
            })}
          </div>
          {hiddenIncompleteChecks.length ? (
            <div className="info-banner" style={{ margin: "0 12px 12px", lineHeight: 1.45 }}>
              <strong>{hiddenIncompleteChecks.length} more non-optional check{hiddenIncompleteChecks.length === 1 ? "" : "s"} not shown above.</strong>
              <div>{hiddenIncompleteChecks.map(describeHiddenCheck).join(" • ")}</div>
              <div>Open the full doctor report below to see all {total} checks.</div>
            </div>
          ) : null}
        </details>

        {canShowPanelCommands ? (
          <details id="panel-command" className="panel-command-details">
            <summary>Discord panel commands</summary>
            <div className="panel-command-box">
              <div>
                <div className="muted launch-eyebrow">Discord Panel</div>
                <h3 className="panel-command-title">Publish the member-facing ticket panel</h3>
                <p className="muted launch-copy">
                  Run these inside the Discord channel where members should open tickets. Forms are optional; add them later when you want custom intake questions.
                </p>
              </div>
              <div className="command-stack">
                <code>/ticket-panel post</code>
                <code>/ticket-panel doctor</code>
              </div>
            </div>
          </details>
        ) : null}
      </section>

      {hasSelectedGuild ? (
        <details className="setup-doctor-collapse">
          <summary>{getDoctorSummary(ready, score, passed, total, optionalIncompleteCount)}</summary>
          <SetupDoctorPanel initialHealth={health as any} compact />
        </details>
      ) : null}
    </div>
  );
}

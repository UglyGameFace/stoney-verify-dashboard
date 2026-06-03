import Link from "next/link";
import { headers } from "next/headers";

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

const SETUP_NAV_LINKS = [
  { key: "servers", label: "Servers", href: "/servers" },
  { key: "categories", label: "Categories", href: "/ticket-categories" },
  { key: "forms", label: "Forms", href: "/ticket-forms" },
];

function safeArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function normalizeString(value: unknown): string {
  return String(value || "").trim();
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
  return [
    {
      key: "server_selected",
      label: "Choose Server",
      description: guildId ? "Dashboard context is active." : "Pick the Discord server you want to manage.",
      ok: Boolean(guildId),
      severity: "required",
      action_label: guildId ? "Change" : "Choose",
      action_href: "/servers",
      detail: guildId || "No selected server",
    },
    {
      key: "categories_created",
      label: "Create Categories",
      description: categoryCount ? `${categoryCount} category${categoryCount === 1 ? "" : "ies"} found.` : "Add support, verification, appeals, and service categories.",
      ok: categoryCount > 0,
      severity: "required",
      action_label: categoryCount ? "Tune" : "Create",
      action_href: "/ticket-categories",
      detail: `${categoryCount} categories`,
    },
    {
      key: "forms_configured",
      label: "Configure Forms",
      description: "Use smart defaults or add custom questions per category.",
      ok: categoryCount > 0,
      severity: "recommended",
      action_label: "Configure",
      action_href: "/ticket-forms",
      detail: categoryCount ? "Smart defaults available" : "Create categories first",
    },
    {
      key: "panel_activity",
      label: "Post Discord Panel",
      description: "Run the panel command inside the server channel where members should open tickets.",
      ok: false,
      severity: "recommended",
      action_label: "Copy steps",
      action_href: "#panel-command",
      detail: "No live health result yet",
    },
    {
      key: "test_ticket",
      label: "Test Ticket Flow",
      description: "Open a test ticket, confirm category routing, then close/reopen/delete from the dashboard.",
      ok: ticketCount > 0,
      severity: "required",
      action_label: "Test",
      action_href: "/#tickets",
      detail: `${ticketCount} tickets`,
    },
  ];
}

function compactChecks(checks: SetupCheck[]): SetupCheck[] {
  const preferred = [
    "server_selected",
    "categories_created",
    "forms_configured",
    "panel_activity",
    "test_ticket",
    "command_queue_clear",
  ];
  const byKey = new Map(checks.map((check) => [normalizeString(check.key), check]));
  const ordered = preferred.map((key) => byKey.get(key)).filter(Boolean) as SetupCheck[];
  if (ordered.length >= 5) return ordered.slice(0, 6);
  return checks.slice(0, 6);
}

function resolveActiveSetupHref(nextFix: SetupCheck | null, checks: SetupCheck[]): string {
  const nextHref = normalizeString(nextFix?.action_href);
  if (nextHref.startsWith("/servers")) return "/servers";
  if (nextHref.startsWith("/ticket-categories")) return "/ticket-categories";
  if (nextHref.startsWith("/ticket-forms")) return "/ticket-forms";

  const firstUnfinished = checks.find((check) => !check.ok);
  const fallbackHref = normalizeString(firstUnfinished?.action_href);
  if (fallbackHref.startsWith("/servers")) return "/servers";
  if (fallbackHref.startsWith("/ticket-categories")) return "/ticket-categories";
  if (fallbackHref.startsWith("/ticket-forms")) return "/ticket-forms";

  return "/servers";
}

export default async function SetupLaunchChecklist({ data, selectedGuildId }: SetupLaunchChecklistProps) {
  const health = await loadSetupHealth();
  const checks = safeArray<SetupCheck>(health?.checks).length ? safeArray<SetupCheck>(health?.checks) : fallbackChecks(data, selectedGuildId);
  const visibleChecks = compactChecks(checks);
  const passed = Number(health?.passed ?? checks.filter((check) => Boolean(check.ok)).length);
  const total = Number(health?.total ?? checks.length);
  const score = Number(health?.score ?? (total ? Math.round((passed / total) * 100) : 0));
  const ready = Boolean(health?.ready_for_launch);
  const nextFix = health?.next_fix || checks.find((check) => !check.ok && check.severity === "required") || checks.find((check) => !check.ok) || null;
  const activeSetupHref = resolveActiveSetupHref(nextFix, checks);

  return (
    <section className="card launch-card" aria-label="Dank Shield setup checklist">
      <div className="launch-head">
        <div>
          <div className="muted launch-eyebrow">Live Setup Health</div>
          <h2 className="launch-title">{ready ? "Ready to launch" : "Finish setup without guessing"}</h2>
          <p className="muted launch-copy">
            Dank Shield checks the selected server, categories, forms, ticket flow, command queue, and activity data so staff know what to fix next.
          </p>
        </div>
        <div className="launch-actions" aria-label="Setup shortcuts">
          {SETUP_NAV_LINKS.map((item) => {
            const active = activeSetupHref === item.href;
            return (
              <Link key={item.key} href={item.href} className={active ? "button primary" : "button ghost"} aria-current={active ? "step" : undefined}>
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="setup-health-summary">
        <div>
          <span>Setup Score</span>
          <strong>{score}%</strong>
        </div>
        <div>
          <span>Checks Passing</span>
          <strong>{passed}/{total}</strong>
        </div>
        <div>
          <span>Launch Status</span>
          <strong>{ready ? "Ready" : "Needs work"}</strong>
        </div>
      </div>

      {nextFix ? (
        <div className="setup-next-fix">
          <div>
            <div className="muted launch-eyebrow">Next Fix</div>
            <strong>{normalizeString(nextFix.label) || "Review setup"}</strong>
            <p>{normalizeString(nextFix.description) || normalizeString(nextFix.detail) || "Open the setup tools and review this server."}</p>
          </div>
          <Link href={normalizeString(nextFix.action_href) || "/servers"} className="button primary">
            {normalizeString(nextFix.action_label) || "Fix Now"}
          </Link>
        </div>
      ) : null}

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

      <div id="panel-command" className="panel-command-box">
        <div>
          <div className="muted launch-eyebrow">Discord Panel</div>
          <h3 className="panel-command-title">Publish the member-facing ticket panel</h3>
          <p className="muted launch-copy">
            Go to the Discord channel where members should open tickets, then run the panel command. Use the doctor command after posting to verify setup health.
          </p>
        </div>
        <div className="command-stack">
          <code>/ticket-panel post</code>
          <code>/ticket-panel doctor</code>
        </div>
      </div>
    </section>
  );
}

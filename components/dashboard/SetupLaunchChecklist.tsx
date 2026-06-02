import Link from "next/link";

type DashboardData = Record<string, unknown> | null | undefined;

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

export default function SetupLaunchChecklist({ data, selectedGuildId }: SetupLaunchChecklistProps) {
  const guildId = getSelectedGuild(data, selectedGuildId);
  const categoryCount = countRows(data, "categories");
  const hasServer = Boolean(guildId);
  const hasCategories = categoryCount > 0;

  const steps = [
    {
      label: "Choose Server",
      helper: hasServer ? "Dashboard context is active." : "Pick the Discord server you want to manage.",
      href: "/servers",
      cta: hasServer ? "Change" : "Choose",
      done: hasServer,
    },
    {
      label: "Create Categories",
      helper: hasCategories ? `${categoryCount} category${categoryCount === 1 ? "" : "ies"} found.` : "Add support, verification, appeals, and service categories.",
      href: "/ticket-categories",
      cta: hasCategories ? "Tune" : "Create",
      done: hasCategories,
    },
    {
      label: "Configure Forms",
      helper: "Use smart defaults or add custom questions per category.",
      href: "/ticket-forms",
      cta: "Configure",
      done: hasCategories,
    },
    {
      label: "Post Discord Panel",
      helper: "Run the panel command inside the server channel where members should open tickets.",
      href: "#panel-command",
      cta: "Copy steps",
      done: false,
    },
    {
      label: "Test Ticket Flow",
      helper: "Open a test ticket, confirm category routing, then close/reopen/delete from the dashboard.",
      href: "/#tickets",
      cta: "Test",
      done: false,
    },
  ];

  return (
    <section className="card launch-card" aria-label="Dank Shield setup checklist">
      <div className="launch-head">
        <div>
          <div className="muted launch-eyebrow">Launch Checklist</div>
          <h2 className="launch-title">Finish setup without guessing</h2>
          <p className="muted launch-copy">
            Dank Shield keeps setup simple: pick a server, define ticket routes, configure forms, then publish the panel in Discord.
          </p>
        </div>
        <div className="launch-actions">
          <Link href="/servers" className="button ghost">Servers</Link>
          <Link href="/ticket-categories" className="button ghost">Categories</Link>
          <Link href="/ticket-forms" className="button primary">Forms</Link>
        </div>
      </div>

      <div className="launch-grid">
        {steps.map((step, index) => (
          <Link key={step.label} href={step.href} className={`launch-step ${step.done ? "done" : "todo"}`}>
            <div className="launch-step-top">
              <StepBadge done={step.done} />
              <span className="launch-step-number">Step {index + 1}</span>
            </div>
            <strong>{step.label}</strong>
            <span className="launch-step-helper">{step.helper}</span>
            <span className="launch-step-cta">{step.cta} →</span>
          </Link>
        ))}
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

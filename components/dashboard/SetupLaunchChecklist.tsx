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

      <style jsx>{`
        .launch-card {
          margin-bottom: 18px;
          display: grid;
          gap: 16px;
        }
        .launch-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
          flex-wrap: wrap;
        }
        .launch-eyebrow {
          font-size: 12px;
          font-weight: 950;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-bottom: 8px;
        }
        .launch-title {
          margin: 0;
          color: var(--text-strong, #ffffff);
        }
        .launch-copy {
          margin: 8px 0 0;
          max-width: 760px;
          line-height: 1.55;
        }
        .launch-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        .launch-actions :global(.button) {
          width: auto;
          min-width: 130px;
        }
        .launch-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 10px;
        }
        .launch-step {
          min-height: 150px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 13px;
          border-radius: 18px;
          text-decoration: none;
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: rgba(255, 255, 255, 0.055);
          color: var(--text, #f5fff9);
        }
        .launch-step.done {
          border-color: rgba(109, 255, 157, 0.34);
          background: rgba(109, 255, 157, 0.10);
        }
        .launch-step.todo:hover,
        .launch-step.done:hover {
          border-color: rgba(120, 221, 255, 0.40);
          transform: translateY(-1px);
        }
        .launch-step-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .launch-step-badge {
          width: 28px;
          height: 28px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          font-weight: 950;
          border: 1px solid rgba(255, 255, 255, 0.16);
        }
        .launch-step-badge.done {
          background: rgba(109, 255, 157, 0.22);
          color: #ffffff;
        }
        .launch-step-badge.todo {
          background: rgba(255, 255, 255, 0.08);
          color: var(--muted, #c7ddcf);
        }
        .launch-step-number {
          color: var(--muted, #c7ddcf);
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .launch-step strong {
          color: var(--text-strong, #fff);
          font-size: 15px;
          line-height: 1.15;
        }
        .launch-step-helper {
          color: var(--muted, #c7ddcf);
          font-size: 12px;
          line-height: 1.35;
          flex: 1;
        }
        .launch-step-cta {
          color: var(--accent, #6dff9d);
          font-size: 12px;
          font-weight: 950;
        }
        .panel-command-box {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(220px, 320px);
          gap: 14px;
          align-items: center;
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 18px;
          padding: 14px;
          background:
            radial-gradient(circle at top right, rgba(120,221,255,0.12), transparent 34%),
            rgba(255,255,255,0.055);
        }
        .panel-command-title {
          margin: 0;
          color: var(--text-strong, #fff);
        }
        .command-stack {
          display: grid;
          gap: 8px;
        }
        .command-stack code {
          display: block;
          border-radius: 14px;
          padding: 12px 14px;
          border: 1px solid rgba(109, 255, 157, 0.24);
          background: rgba(0, 0, 0, 0.24);
          color: #eafff0;
          font-weight: 900;
          overflow-x: auto;
          white-space: nowrap;
        }
        @media (max-width: 1180px) {
          .launch-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 720px) {
          .launch-actions,
          .launch-actions :global(.button) {
            width: 100%;
          }
          .launch-grid,
          .panel-command-box {
            grid-template-columns: 1fr;
          }
          .launch-step {
            min-height: 132px;
          }
        }
      `}</style>
    </section>
  );
}

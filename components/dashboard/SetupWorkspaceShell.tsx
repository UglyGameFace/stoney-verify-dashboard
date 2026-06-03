import type { ReactNode } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";

type SetupStepKey = "servers" | "categories" | "forms";

type SetupWorkspaceShellProps = {
  activeStep: SetupStepKey;
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  actions?: ReactNode;
};

const SETUP_STEPS: Array<{
  key: SetupStepKey;
  href: string;
  label: string;
  helper: string;
  step: string;
}> = [
  { key: "servers", href: "/servers", label: "Servers", helper: "Pick context", step: "1" },
  { key: "categories", href: "/ticket-categories", label: "Categories", helper: "Route tickets", step: "2" },
  { key: "forms", href: "/ticket-forms", label: "Forms", helper: "Collect details", step: "3" },
];

export default function SetupWorkspaceShell({ activeStep, eyebrow, title, description, children, actions }: SetupWorkspaceShellProps) {
  return (
    <div className="shell setup-workspace-shell">
      <Sidebar />
      <main className="content setup-workspace-content">
        <div className="content-inner setup-workspace-inner">
          <section className="card setup-workspace-hero" aria-label="Setup workspace header">
            <div className="setup-workspace-hero-main">
              <div>
                <div className="muted setup-workspace-eyebrow">{eyebrow}</div>
                <h1>{title}</h1>
                <p className="muted">{description}</p>
              </div>
              {actions ? <div className="setup-workspace-actions">{actions}</div> : null}
            </div>

            <nav className="setup-step-nav" aria-label="Setup steps">
              {SETUP_STEPS.map((item) => {
                const active = item.key === activeStep;
                return (
                  <Link key={item.key} href={item.href} className={`setup-step-link ${active ? "active" : ""}`} aria-current={active ? "page" : undefined}>
                    <span className="setup-step-number">{item.step}</span>
                    <span className="setup-step-copy">
                      <strong>{item.label}</strong>
                      <small>{item.helper}</small>
                    </span>
                  </Link>
                );
              })}
            </nav>
          </section>

          <div className="setup-workspace-body">{children}</div>
        </div>
      </main>
    </div>
  );
}

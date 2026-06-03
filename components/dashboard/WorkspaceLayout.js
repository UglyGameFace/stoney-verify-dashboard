"use client";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

export function uniqueVisibleKeys(layout, fallback, visibility = {}) {
  const source = safeArray(layout).length ? layout : fallback;
  const seen = new Set();
  const out = [];

  for (const key of source) {
    if (!key || seen.has(key)) continue;
    seen.add(key);
    if (visibility?.[key] !== false) out.push(key);
  }

  return out;
}

export function WorkspaceGrid({
  className = "",
  itemClassName = "",
  layout = [],
  fallback = [],
  visibility = {},
  sections = {},
  prefix = "workspace",
  getItemClassName,
}) {
  const keys = uniqueVisibleKeys(layout, fallback, visibility);

  return (
    <div className={className}>
      {keys.map((key, index) => (
        <div
          key={`${prefix}-${key}`}
          className={typeof getItemClassName === "function" ? getItemClassName(key, index) : itemClassName}
        >
          {sections?.[key] || null}
        </div>
      ))}
    </div>
  );
}

export function WorkspaceShell({
  eyebrow = "Workspace",
  title,
  subtitle,
  tone = "default",
  actions,
  children,
}) {
  return (
    <section className={`workspace-shell card tone-${tone}`}>
      <div className="workspace-shell-head">
        <div className="workspace-shell-copy">
          <div className="workspace-shell-chip-row">
            <span className="workspace-shell-chip">{eyebrow}</span>
            <span className={`workspace-shell-chip tone-${tone}`}>{tone}</span>
          </div>
          {title ? <h2 className="workspace-shell-title">{title}</h2> : null}
          {subtitle ? <p className="muted workspace-shell-subtitle">{subtitle}</p> : null}
        </div>
        {actions ? <div className="workspace-shell-actions">{actions}</div> : null}
      </div>
      <div className="workspace-shell-divider" />
      <div className="workspace-shell-body">{children}</div>

      <style jsx>{`
        .workspace-shell {
          padding: var(--app-card-padding, 16px);
          border-radius: var(--app-radius, 20px);
          overflow: hidden;
        }

        .workspace-shell-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 14px;
          flex-wrap: wrap;
          margin-bottom: 12px;
        }

        .workspace-shell-copy {
          min-width: 0;
          flex: 1;
        }

        .workspace-shell-chip-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 10px;
        }

        .workspace-shell-chip {
          min-height: 28px;
          display: inline-flex;
          align-items: center;
          padding: 5px 10px;
          border-radius: 999px;
          border: 1px solid var(--panel-border, rgba(255,255,255,0.16));
          background: rgba(255,255,255,0.055);
          color: var(--text-strong, #fff);
          font-size: 11px;
          font-weight: 950;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .workspace-shell-chip.tone-home { background: color-mix(in srgb, var(--accent, #6dff9d) 12%, transparent); }
        .workspace-shell-chip.tone-tickets { background: color-mix(in srgb, var(--accent, #6dff9d) 12%, transparent); }
        .workspace-shell-chip.tone-members { background: color-mix(in srgb, var(--accent-2, #78ddff) 12%, transparent); }
        .workspace-shell-chip.tone-activity { background: color-mix(in srgb, var(--tone-warn, #ffd36b) 13%, transparent); }
        .workspace-shell-chip.tone-categories { background: color-mix(in srgb, var(--accent-2, #78ddff) 10%, transparent); }

        .workspace-shell-title {
          margin: 0;
          color: var(--text-strong, #fff);
          font-size: clamp(24px, 4vw, 36px);
          line-height: 1;
          letter-spacing: -0.045em;
          font-weight: 950;
        }

        .workspace-shell-subtitle {
          margin: 8px 0 0;
          max-width: 860px;
          line-height: 1.5;
        }

        .workspace-shell-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .workspace-shell-divider {
          height: 1px;
          background: var(--panel-border, rgba(255,255,255,0.14));
          opacity: 0.78;
          margin-bottom: 14px;
        }

        .workspace-shell-body {
          min-width: 0;
        }

        @media (max-width: 720px) {
          .workspace-shell-head,
          .workspace-shell-actions {
            display: grid;
            grid-template-columns: 1fr;
            width: 100%;
          }

          .workspace-shell-actions :global(.button) {
            width: 100% !important;
          }
        }
      `}</style>
    </section>
  );
}

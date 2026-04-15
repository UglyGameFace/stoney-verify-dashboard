"use client";

import { useMemo, useState, type ReactNode } from "react";

type TimelineItemRow = {
  id?: string | number | null;
  type?: string | null;
  title?: string | null;
  source?: string | null;
  actor_name?: string | null;
  actor_id?: string | null;
  description?: string | null;
  created_at?: string | null;
  raw?: Record<string, unknown> | null;
};

type TicketTimelinePanelProps = {
  items?: TimelineItemRow[];
  title?: string;
  subtitle?: string;
};

type FilterMode =
  | "all"
  | "verification"
  | "staff"
  | "member"
  | "notes"
  | "system";

function safeText(value: unknown, fallback = "—"): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function formatDateTime(value: unknown): string {
  if (!value) return "—";
  try {
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString();
  } catch {
    return "—";
  }
}

function safeItems(value: unknown): TimelineItemRow[] {
  return Array.isArray(value) ? (value as TimelineItemRow[]) : [];
}

function getTimelineTone(
  item: TimelineItemRow
): "neutral" | "good" | "warn" | "danger" | "info" {
  const source = normalizeText(item?.source);
  const type = normalizeText(item?.type);
  const title = normalizeText(item?.title);
  const blob = `${source} ${type} ${title}`;

  if (
    blob.includes("approved") ||
    blob.includes("verified") ||
    blob.includes("claim") ||
    blob.includes("assigned") ||
    blob.includes("transferred")
  ) {
    return "good";
  }

  if (
    blob.includes("denied") ||
    blob.includes("deleted") ||
    blob.includes("flag") ||
    blob.includes("review")
  ) {
    return "danger";
  }

  if (
    blob.includes("closed") ||
    blob.includes("note") ||
    blob.includes("warn") ||
    blob.includes("resubmit") ||
    blob.includes("reopen")
  ) {
    return "warn";
  }

  if (
    blob.includes("vc") ||
    blob.includes("token") ||
    blob.includes("ticket") ||
    blob.includes("message")
  ) {
    return "info";
  }

  return "neutral";
}

function getTimelineIcon(item: TimelineItemRow): string {
  const source = normalizeText(item?.source);
  const type = normalizeText(item?.type);
  const title = normalizeText(item?.title);
  const blob = `${source} ${type} ${title}`;

  if (blob.includes("note")) return "📝";
  if (blob.includes("flag")) return "🚩";
  if (blob.includes("warn")) return "⚠️";
  if (blob.includes("approved") || blob.includes("verified")) return "✅";
  if (blob.includes("denied")) return "⛔";
  if (blob.includes("vc")) return "🎙️";
  if (blob.includes("token")) return "🎟️";
  if (blob.includes("claim") || blob.includes("assigned")) return "👤";
  if (blob.includes("transfer")) return "🔁";
  if (blob.includes("reopen")) return "🔓";
  if (blob.includes("closed")) return "🔒";
  if (blob.includes("deleted")) return "🗑️";
  if (blob.includes("ticket")) return "🎫";
  return "🧩";
}

function getFilterBucket(item: TimelineItemRow): FilterMode {
  const source = normalizeText(item?.source);
  const type = normalizeText(item?.type);
  const title = normalizeText(item?.title);
  const blob = `${source} ${type} ${title}`;

  if (
    blob.includes("verification") ||
    blob.includes("token") ||
    blob.includes("vc") ||
    blob.includes("flag") ||
    blob.includes("approved") ||
    blob.includes("denied")
  ) {
    return "verification";
  }

  if (blob.includes("note")) {
    return "notes";
  }

  if (
    blob.includes("member") ||
    blob.includes("join") ||
    blob.includes("leave") ||
    blob.includes("vouch") ||
    blob.includes("approved_by")
  ) {
    return "member";
  }

  if (
    blob.includes("staff") ||
    blob.includes("claim") ||
    blob.includes("assigned") ||
    blob.includes("transfer") ||
    blob.includes("close") ||
    blob.includes("reopen") ||
    blob.includes("delete")
  ) {
    return "staff";
  }

  return "system";
}

function TimelineBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "good" | "warn" | "danger" | "info";
}) {
  return <span className={`timeline-badge ${tone}`}>{children}</span>;
}

export default function TicketTimelinePanel({
  items = [],
  title = "Timeline",
  subtitle = "A stitched view of ticket, verification, note, and member activity.",
}: TicketTimelinePanelProps) {
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");

  const cleanedItems = useMemo(() => safeItems(items), [items]);

  const stats = useMemo(() => {
    const latest = [...cleanedItems].sort((a, b) => {
      const aTime = new Date(String(a?.created_at || "")).getTime() || 0;
      const bTime = new Date(String(b?.created_at || "")).getTime() || 0;
      return bTime - aTime;
    })[0];

    const actorCount = new Set(
      cleanedItems
        .map((item) => safeText(item?.actor_name, ""))
        .filter(Boolean)
    ).size;

    return {
      total: cleanedItems.length,
      latestAt: latest?.created_at || null,
      actors: actorCount,
      verification: cleanedItems.filter(
        (item) => getFilterBucket(item) === "verification"
      ).length,
      notes: cleanedItems.filter((item) => getFilterBucket(item) === "notes")
        .length,
    };
  }, [cleanedItems]);

  const filteredItems = useMemo(() => {
    const query = normalizeText(search);

    return cleanedItems.filter((item) => {
      const bucket = getFilterBucket(item);

      if (filterMode !== "all" && bucket !== filterMode) {
        return false;
      }

      if (!query) return true;

      const haystack = [
        item?.title,
        item?.source,
        item?.type,
        item?.actor_name,
        item?.actor_id,
        item?.description,
      ]
        .map((value) => safeText(value, ""))
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [cleanedItems, filterMode, search]);

  return (
    <div className="card timeline-panel-card">
      <div
        className="row"
        style={{
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <h2 style={{ marginTop: 0, marginBottom: 6 }}>{title}</h2>
          <div className="muted" style={{ overflowWrap: "anywhere" }}>
            {subtitle}
          </div>
        </div>

        <div className="timeline-summary-pills">
          <TimelineBadge tone="info">{stats.total} total</TimelineBadge>
          <TimelineBadge tone="warn">{stats.notes} notes</TimelineBadge>
          <TimelineBadge tone="danger">
            {stats.verification} verification
          </TimelineBadge>
          <TimelineBadge>{stats.actors} actors</TimelineBadge>
        </div>
      </div>

      <div className="timeline-toolbar">
        <input
          className="input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search timeline..."
        />

        <select
          className="input"
          value={filterMode}
          onChange={(e) => setFilterMode(e.target.value as FilterMode)}
        >
          <option value="all">All Activity</option>
          <option value="verification">Verification</option>
          <option value="staff">Staff Actions</option>
          <option value="member">Member Events</option>
          <option value="notes">Notes</option>
          <option value="system">System / Other</option>
        </select>
      </div>

      <div className="timeline-stats-grid">
        <div className="timeline-stat-card">
          <div className="timeline-stat-label">Visible Items</div>
          <div className="timeline-stat-value">{filteredItems.length}</div>
        </div>

        <div className="timeline-stat-card">
          <div className="timeline-stat-label">Latest Activity</div>
          <div className="timeline-stat-value">
            {formatDateTime(stats.latestAt)}
          </div>
        </div>

        <div className="timeline-stat-card">
          <div className="timeline-stat-label">Distinct Actors</div>
          <div className="timeline-stat-value">{stats.actors}</div>
        </div>
      </div>

      <div className="timeline-list">
        {!filteredItems.length ? (
          <div className="empty-state">
            {cleanedItems.length
              ? "No timeline items match the current filter."
              : "No timeline activity yet."}
          </div>
        ) : null}

        {filteredItems.map((item, index) => {
          const tone = getTimelineTone(item);
          const bucket = getFilterBucket(item);

          return (
            <div
              key={String(item?.id || `${item?.created_at || "timeline"}-${index}`)}
              className={`timeline-item-card ${tone}`}
            >
              <div className="timeline-item-dot-wrap">
                <div className={`timeline-item-dot ${tone}`}>
                  {getTimelineIcon(item)}
                </div>
              </div>

              <div className="timeline-item-main">
                <div
                  className="row"
                  style={{
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="timeline-item-title">
                      {safeText(item?.title, "Activity")}
                    </div>

                    <div className="timeline-item-meta">
                      <span>{safeText(item?.source, "system")}</span>
                      <span>•</span>
                      <span>{bucket}</span>
                      {item?.actor_name ? (
                        <>
                          <span>•</span>
                          <span>{item.actor_name}</span>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div className="muted" style={{ fontSize: 12 }}>
                    {formatDateTime(item?.created_at)}
                  </div>
                </div>

                {item?.description ? (
                  <div className="timeline-item-description">
                    {item.description}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <style jsx>{`
        .timeline-panel-card {
          background:
            radial-gradient(circle at top right, rgba(99,213,255,0.06), transparent 28%),
            radial-gradient(circle at bottom left, rgba(93,255,141,0.05), transparent 24%),
            linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015)),
            linear-gradient(180deg, rgba(14, 25, 35, 0.98), rgba(7, 13, 21, 0.98));
        }

        .timeline-summary-pills {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
        }

        .timeline-badge {
          display: inline-flex;
          align-items: center;
          min-height: 30px;
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          color: #f8fafc;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
        }

        .timeline-badge.good {
          border-color: rgba(93,255,141,0.24);
          background: rgba(93,255,141,0.08);
        }

        .timeline-badge.warn {
          border-color: rgba(251,191,36,0.22);
          background: rgba(251,191,36,0.08);
        }

        .timeline-badge.danger {
          border-color: rgba(248,113,113,0.22);
          background: rgba(248,113,113,0.08);
        }

        .timeline-badge.info {
          border-color: rgba(99,213,255,0.22);
          background: rgba(99,213,255,0.08);
        }

        .timeline-toolbar {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 220px;
          gap: 10px;
          margin-bottom: 14px;
        }

        .timeline-stats-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 14px;
        }

        .timeline-stat-card {
          display: grid;
          gap: 4px;
          padding: 12px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.06);
          background:
            radial-gradient(circle at top right, rgba(255,255,255,0.04), transparent 42%),
            rgba(255,255,255,0.02);
        }

        .timeline-stat-label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--muted, #9fb0c3);
        }

        .timeline-stat-value {
          color: var(--text, #dbe4ee);
          overflow-wrap: anywhere;
        }

        .timeline-list {
          display: grid;
          gap: 12px;
        }

        .timeline-item-card {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          padding: 14px;
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,0.06);
          background:
            radial-gradient(circle at top right, rgba(255,255,255,0.04), transparent 42%),
            rgba(255,255,255,0.02);
        }

        .timeline-item-card.good {
          border-color: rgba(93,255,141,0.16);
        }

        .timeline-item-card.warn {
          border-color: rgba(251,191,36,0.16);
        }

        .timeline-item-card.danger {
          border-color: rgba(248,113,113,0.16);
        }

        .timeline-item-card.info {
          border-color: rgba(99,213,255,0.16);
        }

        .timeline-item-dot-wrap {
          flex-shrink: 0;
          padding-top: 2px;
        }

        .timeline-item-dot {
          width: 34px;
          height: 34px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          font-size: 15px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
        }

        .timeline-item-dot.good {
          border-color: rgba(93,255,141,0.24);
          background: rgba(93,255,141,0.08);
        }

        .timeline-item-dot.warn {
          border-color: rgba(251,191,36,0.22);
          background: rgba(251,191,36,0.08);
        }

        .timeline-item-dot.danger {
          border-color: rgba(248,113,113,0.22);
          background: rgba(248,113,113,0.08);
        }

        .timeline-item-dot.info {
          border-color: rgba(99,213,255,0.22);
          background: rgba(99,213,255,0.08);
        }

        .timeline-item-main {
          min-width: 0;
          flex: 1;
        }

        .timeline-item-title {
          font-weight: 800;
          overflow-wrap: anywhere;
        }

        .timeline-item-meta {
          margin-top: 4px;
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          color: var(--muted, #9fb0c3);
          font-size: 12px;
          line-height: 1.4;
        }

        .timeline-item-description {
          margin-top: 10px;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
          line-height: 1.5;
          color: var(--text, #dbe4ee);
        }

        @media (max-width: 860px) {
          .timeline-toolbar,
          .timeline-stats-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

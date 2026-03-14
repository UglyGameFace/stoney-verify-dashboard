import { timeAgo } from "@/lib/format";

function getInitials(name) {
  const text = String(name || "").trim();
  if (!text) return "•";

  const parts = text.split(/\s+/).filter(Boolean).slice(0, 2);
  if (!parts.length) return "•";

  return parts.map((p) => p[0]?.toUpperCase() || "").join("");
}

function getEventAccent(event) {
  const type = String(event?.event_type || "").toLowerCase();
  const title = String(event?.title || "").toLowerCase();

  if (type.includes("fail") || title.includes("fail") || title.includes("denied")) {
    return "#ff6b6b";
  }

  if (
    type.includes("delete") ||
    title.includes("delete") ||
    title.includes("closed") ||
    title.includes("ban") ||
    title.includes("kick")
  ) {
    return "#ff9f43";
  }

  if (
    type.includes("create") ||
    title.includes("created") ||
    title.includes("approved") ||
    title.includes("verified") ||
    title.includes("reopen")
  ) {
    return "#45d483";
  }

  return "#7c8aa5";
}

function sourceLabel(event) {
  const source = String(event?.source || "").toLowerCase();

  if (source === "audit_logs") return "Bot Log";
  if (source === "audit_events") return "System Event";

  return "Timeline";
}

function safeText(value, fallback = "—") {
  const text = String(value || "").trim();
  return text || fallback;
}

export default function AuditTimeline({ events = [] }) {
  const safeEvents = Array.isArray(events) ? events : [];

  return (
    <div className="card" id="timeline">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 14,
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: 0 }}>Audit Timeline</h2>
        <div className="muted" style={{ fontSize: 13 }}>
          {safeEvents.length} event{safeEvents.length === 1 ? "" : "s"}
        </div>
      </div>

      {!safeEvents.length ? (
        <div
          className="muted"
          style={{
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 16,
            padding: 16,
            background: "rgba(255,255,255,0.02)",
          }}
        >
          No audit activity yet.
        </div>
      ) : (
        <div className="timeline" style={{ display: "grid", gap: 12 }}>
          {safeEvents.map((event) => {
            const accent = getEventAccent(event);
            const actorName = safeText(event?.actor_name, null);
            const actorAvatar = event?.actor_avatar_url || null;

            return (
              <div
                key={event.id}
                className="timeline-item"
                style={{
                  display: "grid",
                  gridTemplateColumns: "48px 1fr",
                  gap: 12,
                  alignItems: "start",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderLeft: `4px solid ${accent}`,
                  borderRadius: 16,
                  padding: 14,
                  background: "rgba(255,255,255,0.02)",
                }}
              >
                <div>
                  {actorAvatar ? (
                    <img
                      src={actorAvatar}
                      alt={actorName || "Actor"}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: "999px",
                        objectFit: "cover",
                        display: "block",
                        border: "1px solid rgba(255,255,255,0.08)",
                      }}
                    />
                  ) : (
                    <div
                      aria-hidden="true"
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: "999px",
                        display: "grid",
                        placeItems: "center",
                        fontWeight: 800,
                        fontSize: 13,
                        color: "#fff",
                        background: "rgba(255,255,255,0.08)",
                        border: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      {getInitials(actorName)}
                    </div>
                  )}
                </div>

                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 6,
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 800,
                        lineHeight: 1.2,
                      }}
                    >
                      {safeText(event?.title, "Audit Event")}
                    </div>

                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "4px 8px",
                        borderRadius: 999,
                        background: "rgba(255,255,255,0.08)",
                        color: "#cfd8e3",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {sourceLabel(event)}
                    </span>
                  </div>

                  {actorName ? (
                    <div
                      className="muted"
                      style={{
                        fontSize: 13,
                        marginBottom: 6,
                      }}
                    >
                      By {actorName}
                    </div>
                  ) : null}

                  <div
                    className="muted"
                    style={{
                      marginTop: 4,
                      lineHeight: 1.5,
                      wordBreak: "break-word",
                    }}
                  >
                    {safeText(event?.description, "No description provided.")}
                  </div>

                  <div
                    className="muted"
                    style={{
                      marginTop: 8,
                      fontSize: 12,
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <span>{timeAgo(event?.created_at)}</span>

                    {event?.event_type ? (
                      <>
                        <span>•</span>
                        <span>{safeText(event.event_type)}</span>
                      </>
                    ) : null}

                    {event?.related_id ? (
                      <>
                        <span>•</span>
                        <span>ID: {safeText(event.related_id)}</span>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

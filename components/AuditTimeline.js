"use client";

import { useEffect, useMemo, useState } from "react";
import { timeAgo } from "@/lib/format";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeText(value, fallback = "—") {
  const text = String(value || "").trim();
  return text || fallback;
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function getInitials(name) {
  const text = String(name || "").trim();
  if (!text) return "•";

  const parts = text.split(/\s+/).filter(Boolean).slice(0, 2);
  if (!parts.length) return "•";

  return parts.map((p) => p[0]?.toUpperCase() || "").join("");
}

function getEventAccent(event) {
  const type = normalizeText(event?.event_type);
  const family = normalizeText(event?.event_family);
  const title = normalizeText(event?.title);
  const source = normalizeText(event?.source);

  if (
    type.includes("fail") ||
    type.includes("denied") ||
    type.includes("error") ||
    title.includes("fail") ||
    title.includes("denied") ||
    title.includes("error")
  ) {
    return "#ff6b6b";
  }

  if (
    type.includes("ban") ||
    type.includes("kick") ||
    type.includes("delete") ||
    type.includes("closed") ||
    type.includes("timeout") ||
    type.includes("warn") ||
    family === "moderation"
  ) {
    return "#ff9f43";
  }

  if (
    type.includes("approve") ||
    type.includes("verified") ||
    type.includes("reopen") ||
    type.includes("claim") ||
    type.includes("assign") ||
    type.includes("create") ||
    title.includes("approved") ||
    title.includes("verified") ||
    title.includes("created") ||
    family === "ticket"
  ) {
    return "#45d483";
  }

  if (family === "member" || family === "voice") {
    return "#4dabf7";
  }

  if (source === "dashboard") {
    return "#b197fc";
  }

  return "#7c8aa5";
}

function sourceLabel(event) {
  const source = normalizeText(event?.source);

  if (source === "discord") return "Discord";
  if (source === "dashboard") return "Dashboard";
  if (source === "system") return "System";
  if (source === "ticket_message") return "Ticket";
  if (source === "bot") return "Bot";

  return safeText(event?.source, "Timeline");
}

function familyLabel(event) {
  const family = normalizeText(event?.event_family);
  if (!family) return "";

  return family
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function formatDateTime(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "—";
  }
}

function eventSearchBlob(event) {
  return [
    event?.title,
    event?.description,
    event?.event_type,
    event?.event_family,
    event?.source,
    event?.actor_name,
    event?.actor_id,
    event?.target_name,
    event?.target_user_id,
    event?.channel_name,
    event?.channel_id,
    event?.ticket_id,
    event?.related_id,
    event?.reason,
    event?.search_text,
    JSON.stringify(event?.meta || {}),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function matchesFilter(event, filters) {
  const q = normalizeText(filters.query);
  const family = normalizeText(filters.family);
  const source = normalizeText(filters.source);
  const type = normalizeText(filters.type);
  const actor = normalizeText(filters.actor);
  const target = normalizeText(filters.target);

  if (family && normalizeText(event?.event_family) !== family) return false;
  if (source && normalizeText(event?.source) !== source) return false;
  if (type && normalizeText(event?.event_type) !== type) return false;

  if (actor) {
    const actorBlob = [
      event?.actor_name,
      event?.actor_id,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (!actorBlob.includes(actor)) return false;
  }

  if (target) {
    const targetBlob = [
      event?.target_name,
      event?.target_user_id,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (!targetBlob.includes(target)) return false;
  }

  if (q) {
    if (!eventSearchBlob(event).includes(q)) return false;
  }

  return true;
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean).map((v) => String(v).trim()))].sort(
    (a, b) => a.localeCompare(b)
  );
}

function TimelineDetailRow({ label, value }) {
  if (!value) return null;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "110px 1fr",
        gap: 10,
        alignItems: "start",
      }}
    >
      <div
        className="muted"
        style={{
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 13,
          lineHeight: 1.5,
          wordBreak: "break-word",
          color: "var(--text-strong)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function TimelineCard({ event, expanded, onToggle }) {
  const accent = getEventAccent(event);
  const actorName = safeText(event?.actor_name, "");
  const actorAvatar = event?.actor_avatar_url || null;
  const targetName = safeText(event?.target_name, "");
  const meta = event?.meta && typeof event.meta === "object" ? event.meta : {};

  return (
    <div
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
            {safeText(event?.title, "Activity Event")}
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

          {event?.event_family ? (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "4px 8px",
                borderRadius: 999,
                background: "rgba(69,212,131,0.12)",
                color: "#d6ffe4",
                whiteSpace: "nowrap",
              }}
            >
              {familyLabel(event)}
            </span>
          ) : null}
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
            {event?.actor_id ? ` • ${event.actor_id}` : ""}
          </div>
        ) : null}

        {targetName ? (
          <div
            className="muted"
            style={{
              fontSize: 13,
              marginBottom: 6,
            }}
          >
            Target: {targetName}
            {event?.target_user_id ? ` • ${event.target_user_id}` : ""}
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

          {event?.channel_name ? (
            <>
              <span>•</span>
              <span>#{event.channel_name}</span>
            </>
          ) : null}

          {event?.ticket_id ? (
            <>
              <span>•</span>
              <span>Ticket: {event.ticket_id}</span>
            </>
          ) : null}
        </div>

        <div
          style={{
            marginTop: 12,
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            className="button ghost"
            style={{ width: "auto", minWidth: 110 }}
            onClick={onToggle}
          >
            {expanded ? "Hide Details" : "Open Details"}
          </button>
        </div>

        {expanded ? (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 14,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              display: "grid",
              gap: 10,
            }}
          >
            <TimelineDetailRow
              label="Created"
              value={formatDateTime(event?.created_at)}
            />
            <TimelineDetailRow
              label="Type"
              value={safeText(event?.event_type, "")}
            />
            <TimelineDetailRow
              label="Family"
              value={familyLabel(event)}
            />
            <TimelineDetailRow
              label="Source"
              value={safeText(event?.source, "")}
            />
            <TimelineDetailRow
              label="Actor"
              value={
                actorName || event?.actor_id
                  ? `${actorName || "Unknown"}${event?.actor_id ? ` (${event.actor_id})` : ""}`
                  : ""
              }
            />
            <TimelineDetailRow
              label="Target"
              value={
                targetName || event?.target_user_id
                  ? `${targetName || "Unknown"}${event?.target_user_id ? ` (${event.target_user_id})` : ""}`
                  : ""
              }
            />
            <TimelineDetailRow
              label="Channel"
              value={
                event?.channel_name || event?.channel_id
                  ? `${event.channel_name || "Unknown"}${event?.channel_id ? ` (${event.channel_id})` : ""}`
                  : ""
              }
            />
            <TimelineDetailRow
              label="Ticket"
              value={event?.ticket_id || ""}
            />
            <TimelineDetailRow
              label="Reason"
              value={event?.reason || ""}
            />
            <TimelineDetailRow
              label="Related"
              value={event?.related_id || ""}
            />

            {Object.keys(meta).length ? (
              <div
                style={{
                  marginTop: 2,
                  paddingTop: 10,
                  borderTop: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div
                  className="muted"
                  style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}
                >
                  Metadata
                </div>
                <pre
                  style={{
                    margin: 0,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    fontSize: 12,
                    lineHeight: 1.45,
                    color: "var(--text-muted)",
                  }}
                >
                  {JSON.stringify(meta, null, 2)}
                </pre>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function AuditTimeline({ events = [] }) {
  const safeEvents = Array.isArray(events) ? events : [];

  const [query, setQuery] = useState("");
  const [family, setFamily] = useState("");
  const [source, setSource] = useState("");
  const [type, setType] = useState("");
  const [actor, setActor] = useState("");
  const [target, setTarget] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  const familyOptions = useMemo(
    () => uniqueSorted(safeEvents.map((e) => e?.event_family)),
    [safeEvents]
  );

  const sourceOptions = useMemo(
    () => uniqueSorted(safeEvents.map((e) => e?.source)),
    [safeEvents]
  );

  const typeOptions = useMemo(
    () => uniqueSorted(safeEvents.map((e) => e?.event_type)),
    [safeEvents]
  );

  const filteredEvents = useMemo(() => {
    return safeEvents.filter((event) =>
      matchesFilter(event, {
        query,
        family,
        source,
        type,
        actor,
        target,
      })
    );
  }, [safeEvents, query, family, source, type, actor, target]);

  useEffect(() => {
    if (expandedId && !filteredEvents.some((e) => e?.id === expandedId)) {
      setExpandedId(null);
    }
  }, [filteredEvents, expandedId]);

  function clearFilters() {
    setQuery("");
    setFamily("");
    setSource("");
    setType("");
    setActor("");
    setTarget("");
  }

  return (
    <div className="card" id="timeline">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 14,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2 style={{ marginTop: 0, marginBottom: 0 }}>Activity Feed</h2>
          <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
            Search Discord actions, dashboard actions, tickets, moderation, and member changes
          </div>
        </div>

        <div className="muted" style={{ fontSize: 13 }}>
          {filteredEvents.length} shown • {safeEvents.length} loaded
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <input
          className="input"
          placeholder="Search anything..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <input
          className="input"
          placeholder="Actor name or ID"
          value={actor}
          onChange={(e) => setActor(e.target.value)}
        />

        <input
          className="input"
          placeholder="Target name or ID"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        />

        <select
          className="input"
          value={family}
          onChange={(e) => setFamily(e.target.value)}
        >
          <option value="">All families</option>
          {familyOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <select
          className="input"
          value={source}
          onChange={(e) => setSource(e.target.value)}
        >
          <option value="">All sources</option>
          {sourceOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <select
          className="input"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="">All event types</option>
          {typeOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        <button
          type="button"
          className="button ghost"
          style={{ width: "auto", minWidth: 120 }}
          onClick={clearFilters}
        >
          Clear Filters
        </button>
      </div>

      {!filteredEvents.length ? (
        <div
          className="muted"
          style={{
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 16,
            padding: 16,
            background: "rgba(255,255,255,0.02)",
          }}
        >
          No activity matched the current filters.
        </div>
      ) : (
        <div className="timeline" style={{ display: "grid", gap: 12 }}>
          {filteredEvents.map((event) => (
            <TimelineCard
              key={event.id}
              event={event}
              expanded={expandedId === event.id}
              onToggle={() =>
                setExpandedId((prev) => (prev === event.id ? null : event.id))
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

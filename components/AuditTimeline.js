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

function prettyLabel(value) {
  return String(value || "")
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function decimalStringMod(value, mod) {
  let remainder = 0;

  for (let i = 0; i < value.length; i += 1) {
    const digit = value.charCodeAt(i) - 48;
    if (digit < 0 || digit > 9) return 0;
    remainder = (remainder * 10 + digit) % mod;
  }

  return remainder;
}

function getDiscordDefaultAvatarUrl(userId) {
  const raw = String(userId || "").trim();
  if (!raw || !/^\d+$/.test(raw)) return "";

  try {
    const bucketSize = 4194304; // 2^22
    const cycleSize = bucketSize * 6; // 25165824
    const reduced = decimalStringMod(raw, cycleSize);
    const index = Math.floor(reduced / bucketSize);

    return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
  } catch {
    return "";
  }
}

function familyMeta(value) {
  const family = normalizeText(value);

  if (!family) {
    return {
      label: "",
      description: "",
      tone: "neutral",
    };
  }

  if (family === "moderation") {
    return {
      label: "Moderation",
      description: "Bans, kicks, warns, timeouts, and role actions.",
      tone: "warn",
    };
  }

  if (family === "ticket" || family === "tickets") {
    return {
      label: "Tickets",
      description: "Ticket creation, claims, closes, reopen, reconcile, and queue actions.",
      tone: "ok",
    };
  }

  if (family === "member" || family === "members") {
    return {
      label: "Members",
      description: "Joins, leaves, profile changes, and member state updates.",
      tone: "info",
    };
  }

  if (family === "voice") {
    return {
      label: "Voice",
      description: "Voice moves, disconnects, mute/deafen actions, and VC workflow events.",
      tone: "info",
    };
  }

  if (family === "verification") {
    return {
      label: "Verification",
      description: "Verification approvals, denials, queue actions, and role sync events.",
      tone: "ok",
    };
  }

  if (family === "system") {
    return {
      label: "System",
      description: "Background jobs, sync passes, auto-repair, cleanup, and maintenance.",
      tone: "neutral",
    };
  }

  if (family === "audit_events") {
    return {
      label: "Audit Events",
      description: "Legacy or normalized audit entries recorded by the dashboard/bot.",
      tone: "neutral",
    };
  }

  return {
    label: prettyLabel(value),
    description: "Grouped by event family so you can narrow the type of activity.",
    tone: "neutral",
  };
}

function sourceMeta(value) {
  const source = normalizeText(value);

  if (!source) {
    return {
      label: "",
      description: "",
      tone: "neutral",
    };
  }

  if (source === "discord") {
    return {
      label: "Discord",
      description: "Events that came from Discord-side actions or mirrored Discord changes.",
      tone: "info",
    };
  }

  if (source === "dashboard") {
    return {
      label: "Dashboard",
      description: "Actions triggered directly from your web dashboard.",
      tone: "accent",
    };
  }

  if (source === "system") {
    return {
      label: "System",
      description: "Internal maintenance, reconciliation, startup sync, and automated repair.",
      tone: "neutral",
    };
  }

  if (source === "ticket_message") {
    return {
      label: "Ticket Message",
      description: "Activity that came from ticket-thread message context.",
      tone: "ok",
    };
  }

  if (source === "bot") {
    return {
      label: "Bot",
      description: "Actions performed by bot logic, command handlers, or automations.",
      tone: "accent",
    };
  }

  if (source === "audit_events") {
    return {
      label: "Audit Events",
      description: "Legacy audit-style source records.",
      tone: "neutral",
    };
  }

  return {
    label: prettyLabel(value),
    description: "Used to show where the event was recorded from.",
    tone: "neutral",
  };
}

function getToneColors(tone) {
  if (tone === "warn") {
    return {
      bg: "rgba(255, 159, 67, 0.12)",
      border: "rgba(255, 159, 67, 0.22)",
      text: "#ffd7ab",
    };
  }

  if (tone === "ok") {
    return {
      bg: "rgba(69, 212, 131, 0.12)",
      border: "rgba(69, 212, 131, 0.22)",
      text: "#d6ffe4",
    };
  }

  if (tone === "info") {
    return {
      bg: "rgba(77, 171, 247, 0.12)",
      border: "rgba(77, 171, 247, 0.22)",
      text: "#d7efff",
    };
  }

  if (tone === "accent") {
    return {
      bg: "rgba(177, 151, 252, 0.14)",
      border: "rgba(177, 151, 252, 0.22)",
      text: "#ece3ff",
    };
  }

  return {
    bg: "rgba(255,255,255,0.06)",
    border: "rgba(255,255,255,0.10)",
    text: "#d8e1ec",
  };
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
    family === "ticket" ||
    family === "verification"
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
  return sourceMeta(event?.source).label || safeText(event?.source, "Timeline");
}

function familyLabel(event) {
  return familyMeta(event?.event_family).label || "";
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
    const actorBlob = [event?.actor_name, event?.actor_id]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (!actorBlob.includes(actor)) return false;
  }

  if (target) {
    const targetBlob = [event?.target_name, event?.target_user_id]
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

function ActiveFilterChip({ label, onClear }) {
  return (
    <button
      type="button"
      onClick={onClear}
      style={{
        border: "1px solid rgba(255,255,255,0.1)",
        background: "rgba(255,255,255,0.05)",
        color: "var(--text-strong)",
        borderRadius: 999,
        padding: "8px 12px",
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {label} ✕
    </button>
  );
}

function FilterExplainCard({ title, description, tone = "neutral" }) {
  const colors = getToneColors(tone);

  return (
    <div
      style={{
        border: `1px solid ${colors.border}`,
        background: colors.bg,
        color: colors.text,
        borderRadius: 14,
        padding: 12,
      }}
    >
      <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 12, lineHeight: 1.5 }}>{description}</div>
    </div>
  );
}

function TimelineAvatar({ event, actorName }) {
  const explicitAvatar = String(event?.actor_avatar_url || "").trim();
  const fallbackDiscordAvatar = getDiscordDefaultAvatarUrl(event?.actor_id);
  const [src, setSrc] = useState(explicitAvatar || fallbackDiscordAvatar || "");

  useEffect(() => {
    setSrc(explicitAvatar || fallbackDiscordAvatar || "");
  }, [explicitAvatar, fallbackDiscordAvatar]);

  if (src) {
    return (
      <img
        src={src}
        alt={actorName || "Actor"}
        onError={() => {
          if (src !== fallbackDiscordAvatar && fallbackDiscordAvatar) {
            setSrc(fallbackDiscordAvatar);
            return;
          }
          setSrc("");
        }}
        style={{
          width: 40,
          height: 40,
          minWidth: 40,
          minHeight: 40,
          maxWidth: 40,
          maxHeight: 40,
          aspectRatio: "1 / 1",
          borderRadius: "999px",
          objectFit: "cover",
          objectPosition: "center",
          display: "block",
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.04)",
          flexShrink: 0,
        }}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      style={{
        width: 40,
        height: 40,
        minWidth: 40,
        minHeight: 40,
        maxWidth: 40,
        maxHeight: 40,
        borderRadius: "999px",
        display: "grid",
        placeItems: "center",
        fontWeight: 800,
        fontSize: 13,
        color: "#fff",
        background:
          "radial-gradient(circle at top right, rgba(93,255,141,0.18), transparent 45%), linear-gradient(180deg, rgba(46,77,102,0.98), rgba(20,35,50,0.98))",
        border: "1px solid rgba(255,255,255,0.08)",
        flexShrink: 0,
      }}
    >
      {getInitials(actorName)}
    </div>
  );
}

function TimelineCard({ event, expanded, onToggle }) {
  const accent = getEventAccent(event);
  const actorName = safeText(event?.actor_name, "");
  const targetName = safeText(event?.target_name, "");
  const meta = event?.meta && typeof event.meta === "object" ? event.meta : {};
  const familyTone = familyMeta(event?.event_family).tone;
  const sourceTone = sourceMeta(event?.source).tone;
  const familyColors = getToneColors(familyTone);
  const sourceColors = getToneColors(sourceTone);

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
        background:
          "radial-gradient(circle at top right, rgba(255,255,255,0.04), transparent 42%), rgba(255,255,255,0.02)",
      }}
    >
      <div>
        <TimelineAvatar event={event} actorName={actorName} />
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
              color: "var(--text-strong)",
              overflowWrap: "anywhere",
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
              background: sourceColors.bg,
              border: `1px solid ${sourceColors.border}`,
              color: sourceColors.text,
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
                background: familyColors.bg,
                border: `1px solid ${familyColors.border}`,
                color: familyColors.text,
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
              overflowWrap: "anywhere",
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
              overflowWrap: "anywhere",
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
              value={sourceLabel(event)}
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

  const selectedFamilyMeta = familyMeta(family);
  const selectedSourceMeta = sourceMeta(source);

  const hasActiveFilters =
    Boolean(query) ||
    Boolean(actor) ||
    Boolean(target) ||
    Boolean(family) ||
    Boolean(source) ||
    Boolean(type);

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
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
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
          <option value="">All families (what kind of event)</option>
          {familyOptions.map((option) => (
            <option key={option} value={option}>
              {familyMeta(option).label || option}
            </option>
          ))}
        </select>

        <select
          className="input"
          value={source}
          onChange={(e) => setSource(e.target.value)}
        >
          <option value="">All sources (where it came from)</option>
          {sourceOptions.map((option) => (
            <option key={option} value={option}>
              {sourceMeta(option).label || option}
            </option>
          ))}
        </select>

        <select
          className="input"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="">All event types (exact action)</option>
          {typeOptions.map((option) => (
            <option key={option} value={option}>
              {prettyLabel(option)}
            </option>
          ))}
        </select>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <FilterExplainCard
          title="Families = event category"
          description={
            selectedFamilyMeta.label
              ? `${selectedFamilyMeta.label}: ${selectedFamilyMeta.description}`
              : "Use this to narrow by the kind of action: moderation, tickets, members, voice, verification, or system."
          }
          tone={selectedFamilyMeta.tone}
        />

        <FilterExplainCard
          title="Sources = where it came from"
          description={
            selectedSourceMeta.label
              ? `${selectedSourceMeta.label}: ${selectedSourceMeta.description}`
              : "Use this to narrow by origin: Discord, dashboard, bot logic, ticket message context, or system maintenance."
          }
          tone={selectedSourceMeta.tone}
        />
      </div>

      {hasActiveFilters ? (
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 14,
          }}
        >
          {query ? (
            <ActiveFilterChip
              label={`Search: ${query}`}
              onClear={() => setQuery("")}
            />
          ) : null}

          {actor ? (
            <ActiveFilterChip
              label={`Actor: ${actor}`}
              onClear={() => setActor("")}
            />
          ) : null}

          {target ? (
            <ActiveFilterChip
              label={`Target: ${target}`}
              onClear={() => setTarget("")}
            />
          ) : null}

          {family ? (
            <ActiveFilterChip
              label={`Family: ${familyMeta(family).label || family}`}
              onClear={() => setFamily("")}
            />
          ) : null}

          {source ? (
            <ActiveFilterChip
              label={`Source: ${sourceMeta(source).label || source}`}
              onClear={() => setSource("")}
            />
          ) : null}

          {type ? (
            <ActiveFilterChip
              label={`Type: ${prettyLabel(type)}`}
              onClear={() => setType("")}
            />
          ) : null}
        </div>
      ) : null}

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

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

function prettyLabel(value) {
  return String(value || "")
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const text = String(value || "").trim();
    if (text) return text;
  }
  return "";
}

function getInitials(name) {
  const text = String(name || "").trim();
  if (!text) return "•";

  const parts = text.split(/\s+/).filter(Boolean).slice(0, 2);
  if (!parts.length) return "•";

  return parts.map((p) => p[0]?.toUpperCase() || "").join("");
}

function getMeta(event) {
  return event?.meta && typeof event.meta === "object" ? event.meta : {};
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
    const bucketSize = 4194304;
    const cycleSize = bucketSize * 6;
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

function formatDateTime(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "—";
  }
}

function sourceLabel(event) {
  return sourceMeta(event?.source).label || safeText(event?.source, "Timeline");
}

function familyLabel(event) {
  return familyMeta(event?.event_family).label || "";
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

  if (q && !eventSearchBlob(event).includes(q)) return false;

  return true;
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean).map((v) => String(v).trim()))].sort(
    (a, b) => a.localeCompare(b)
  );
}

function getActorName(event) {
  const meta = getMeta(event);

  return firstNonEmpty(
    event?.actor_display_name,
    event?.actor_name,
    meta?.actor_display_name,
    meta?.actor_name,
    meta?.staff_name,
    event?.staff_name,
    "System"
  );
}

function getTargetName(event) {
  const meta = getMeta(event);

  return firstNonEmpty(
    event?.target_display_name,
    event?.target_name,
    meta?.target_display_name,
    meta?.target_name,
    meta?.member_name,
    meta?.owner_name,
    ""
  );
}

function buildIdentityText(name, id) {
  const cleanName = String(name || "").trim();
  const cleanId = String(id || "").trim();

  if (!cleanName && !cleanId) return "";
  if (!cleanId) return cleanName;
  if (!cleanName) return cleanId;
  if (cleanName.includes(cleanId)) return cleanName;

  return `${cleanName} (${cleanId})`;
}

function isSameIdentity(event) {
  const actorId = String(event?.actor_id || "").trim();
  const targetId = String(event?.target_user_id || "").trim();
  const actorName = normalizeText(getActorName(event));
  const targetName = normalizeText(getTargetName(event));

  if (actorId && targetId && actorId === targetId) return true;
  if (actorName && targetName && actorName === targetName) return true;

  return false;
}

function getVisibleDescription(event) {
  const raw = String(event?.description || "").trim();
  const eventType = prettyLabel(event?.event_type || event?.title || "activity");
  const actorName = normalizeText(getActorName(event));
  const targetName = normalizeText(getTargetName(event));
  const rawNorm = normalizeText(raw);

  if (!raw) {
    return `Performed ${eventType}.`;
  }

  const mostlyDuplicate =
    (actorName && rawNorm.includes(actorName)) ||
    (targetName && rawNorm.includes(targetName));

  if (mostlyDuplicate && raw.length > 70) {
    return `Performed ${eventType}.`;
  }

  return raw;
}

function getAvatarCandidates(event) {
  const meta = getMeta(event);

  return [
    event?.actor_avatar_url,
    event?.actorAvatarUrl,
    event?.avatar_url,
    event?.avatarUrl,
    meta?.actor_avatar_url,
    meta?.actorAvatarUrl,
    meta?.avatar_url,
    meta?.avatarUrl,
    event?.target_avatar_url,
    event?.targetAvatarUrl,
    meta?.target_avatar_url,
    meta?.targetAvatarUrl,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
}

function TimelineAvatar({ event, actorName }) {
  const actorId = String(event?.actor_id || "").trim();
  const fallbackDiscordAvatar = getDiscordDefaultAvatarUrl(actorId);
  const candidates = getAvatarCandidates(event);
  const preferred = candidates[0] || fallbackDiscordAvatar || "";
  const [src, setSrc] = useState(preferred);

  useEffect(() => {
    setSrc(preferred);
  }, [preferred]);

  if (src) {
    return (
      <img
        src={src}
        alt={actorName || "Actor"}
        onError={() => {
          const nextCandidate = candidates.find((candidate) => candidate && candidate !== src);

          if (nextCandidate) {
            setSrc(nextCandidate);
            return;
          }

          if (src !== fallbackDiscordAvatar && fallbackDiscordAvatar) {
            setSrc(fallbackDiscordAvatar);
            return;
          }

          setSrc("");
        }}
        className="timeline-avatar-image"
      />
    );
  }

  return (
    <div className="timeline-avatar-fallback" aria-hidden="true">
      {getInitials(actorName)}
    </div>
  );
}

function TimelineDetailRow({ label, value }) {
  if (!value) return null;

  return (
    <div className="timeline-detail-row">
      <div className="muted timeline-detail-label">{label}</div>
      <div className="timeline-detail-value">{value}</div>
    </div>
  );
}

function ActiveFilterChip({ label, onClear }) {
  return (
    <button type="button" onClick={onClear} className="timeline-filter-chip">
      {label} ✕
    </button>
  );
}

function FilterExplainCard({ title, description, tone = "neutral" }) {
  const colors = getToneColors(tone);

  return (
    <div
      className="timeline-explain-card"
      style={{
        borderColor: colors.border,
        background: colors.bg,
        color: colors.text,
      }}
    >
      <div className="timeline-explain-title">{title}</div>
      <div className="timeline-explain-copy">{description}</div>
    </div>
  );
}

function TimelineCard({ event, expanded, onToggle }) {
  const accent = getEventAccent(event);
  const actorName = getActorName(event);
  const targetName = getTargetName(event);
  const meta = getMeta(event);
  const familyTone = familyMeta(event?.event_family).tone;
  const sourceTone = sourceMeta(event?.source).tone;
  const familyColors = getToneColors(familyTone);
  const sourceColors = getToneColors(sourceTone);

  const actorLine = buildIdentityText(actorName, event?.actor_id);
  const targetLine = buildIdentityText(targetName, event?.target_user_id);
  const sameIdentity = isSameIdentity(event);
  const visibleDescription = getVisibleDescription(event);

  return (
    <div className="timeline-card" style={{ borderLeftColor: accent }}>
      <div className="timeline-card-avatar">
        <TimelineAvatar event={event} actorName={actorName} />
      </div>

      <div className="timeline-card-main">
        <div className="timeline-card-head">
          <div className="timeline-card-title-wrap">
            <div className="timeline-card-title">
              {safeText(event?.title, "Activity Event")}
            </div>

            {actorLine ? (
              <div className="muted timeline-card-actor">By {actorLine}</div>
            ) : null}
          </div>

          <div className="timeline-card-chip-row">
            <span
              className="timeline-pill"
              style={{
                background: sourceColors.bg,
                borderColor: sourceColors.border,
                color: sourceColors.text,
              }}
            >
              {sourceLabel(event)}
            </span>

            {event?.event_family ? (
              <span
                className="timeline-pill"
                style={{
                  background: familyColors.bg,
                  borderColor: familyColors.border,
                  color: familyColors.text,
                }}
              >
                {familyLabel(event)}
              </span>
            ) : null}
          </div>
        </div>

        {targetLine && !sameIdentity ? (
          <div className="muted timeline-card-target">Target: {targetLine}</div>
        ) : null}

        <div className="muted timeline-card-description">{visibleDescription}</div>

        <div className="muted timeline-card-meta">
          <span>{timeAgo(event?.created_at)}</span>

          {event?.event_type ? (
            <>
              <span>•</span>
              <span>{safeText(event?.event_type)}</span>
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

        <div className="timeline-card-actions">
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
          <div className="timeline-card-details">
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
              value={actorLine}
            />
            <TimelineDetailRow
              label="Target"
              value={!sameIdentity ? targetLine : "Same as actor"}
            />
            <TimelineDetailRow
              label="Channel"
              value={
                event?.channel_name || event?.channel_id
                  ? `${event.channel_name || "Unknown"}${
                      event?.channel_id ? ` (${event.channel_id})` : ""
                    }`
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
              <div className="timeline-meta-block">
                <div className="muted timeline-meta-block-label">Metadata</div>
                <pre className="timeline-meta-pre">
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
      <div className="timeline-topbar">
        <div>
          <h2 style={{ marginTop: 0, marginBottom: 0 }}>Activity Feed</h2>
          <div className="muted timeline-topbar-copy">
            Search Discord actions, dashboard actions, tickets, moderation, and member changes
          </div>
        </div>

        <div className="muted timeline-topbar-count">
          {filteredEvents.length} shown • {safeEvents.length} loaded
        </div>
      </div>

      <div className="timeline-filter-grid">
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

      <div className="timeline-explain-grid">
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
        <div className="timeline-active-filters">
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

      <div className="timeline-toolbar-actions">
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
        <div className="muted timeline-empty">
          No activity matched the current filters.
        </div>
      ) : (
        <div className="timeline-list">
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

      <style jsx>{`
        .timeline-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 14px;
          flex-wrap: wrap;
        }

        .timeline-topbar-copy {
          font-size: 13px;
          margin-top: 6px;
          line-height: 1.5;
        }

        .timeline-topbar-count {
          font-size: 13px;
        }

        .timeline-filter-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 10px;
          margin-bottom: 14px;
        }

        .timeline-explain-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 10px;
          margin-bottom: 14px;
        }

        .timeline-explain-card {
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          padding: 12px;
          min-width: 0;
        }

        .timeline-explain-title {
          font-weight: 800;
          font-size: 13px;
          margin-bottom: 4px;
        }

        .timeline-explain-copy {
          font-size: 12px;
          line-height: 1.5;
        }

        .timeline-active-filters {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 14px;
        }

        .timeline-filter-chip {
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.05);
          color: var(--text-strong);
          border-radius: 999px;
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }

        .timeline-toolbar-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 14px;
        }

        .timeline-empty {
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 16px;
          background: rgba(255, 255, 255, 0.02);
        }

        .timeline-list {
          display: grid;
          gap: 12px;
        }

        .timeline-card {
          display: grid;
          grid-template-columns: 48px minmax(0, 1fr);
          gap: 12px;
          align-items: start;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-left: 4px solid rgba(255, 255, 255, 0.12);
          border-radius: 18px;
          padding: 14px;
          background:
            radial-gradient(circle at top right, rgba(255,255,255,0.04), transparent 42%),
            rgba(255,255,255,0.02);
        }

        .timeline-card-avatar {
          display: flex;
          align-items: flex-start;
          justify-content: center;
        }

        .timeline-avatar-image,
        .timeline-avatar-fallback {
          width: 40px;
          height: 40px;
          min-width: 40px;
          min-height: 40px;
          max-width: 40px;
          max-height: 40px;
          border-radius: 999px;
          overflow: hidden;
          flex-shrink: 0;
          aspect-ratio: 1 / 1;
        }

        .timeline-avatar-image {
          object-fit: cover;
          object-position: center;
          display: block;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
        }

        .timeline-avatar-fallback {
          display: grid;
          place-items: center;
          font-weight: 800;
          font-size: 13px;
          color: #fff;
          background:
            radial-gradient(circle at top right, rgba(93,255,141,0.18), transparent 45%),
            linear-gradient(180deg, rgba(46,77,102,0.98), rgba(20,35,50,0.98));
          border: 1px solid rgba(255,255,255,0.08);
        }

        .timeline-card-main {
          min-width: 0;
        }

        .timeline-card-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 6px;
        }

        .timeline-card-title-wrap {
          min-width: 0;
          flex: 1;
        }

        .timeline-card-title {
          font-weight: 800;
          line-height: 1.2;
          color: var(--text-strong);
          overflow-wrap: anywhere;
        }

        .timeline-card-actor,
        .timeline-card-target {
          font-size: 13px;
          margin-top: 6px;
          overflow-wrap: anywhere;
          line-height: 1.45;
        }

        .timeline-card-chip-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          align-items: center;
        }

        .timeline-pill {
          font-size: 11px;
          font-weight: 700;
          padding: 4px 8px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          white-space: nowrap;
          line-height: 1.1;
        }

        .timeline-card-description {
          margin-top: 4px;
          line-height: 1.55;
          word-break: break-word;
        }

        .timeline-card-meta {
          margin-top: 8px;
          font-size: 12px;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
          line-height: 1.4;
        }

        .timeline-card-actions {
          margin-top: 12px;
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .timeline-card-details {
          margin-top: 12px;
          padding: 12px;
          border-radius: 14px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          display: grid;
          gap: 10px;
        }

        .timeline-detail-row {
          display: grid;
          grid-template-columns: 110px minmax(0, 1fr);
          gap: 10px;
          align-items: start;
        }

        .timeline-detail-label {
          font-size: 12px;
          font-weight: 700;
        }

        .timeline-detail-value {
          font-size: 13px;
          line-height: 1.5;
          word-break: break-word;
          color: var(--text-strong);
        }

        .timeline-meta-block {
          margin-top: 2px;
          padding-top: 10px;
          border-top: 1px solid rgba(255,255,255,0.08);
        }

        .timeline-meta-block-label {
          font-size: 12px;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .timeline-meta-pre {
          margin: 0;
          white-space: pre-wrap;
          word-break: break-word;
          font-size: 12px;
          line-height: 1.45;
          color: var(--text-muted);
        }

        @media (max-width: 640px) {
          .timeline-card {
            grid-template-columns: 1fr;
            gap: 10px;
          }

          .timeline-card-avatar {
            justify-content: flex-start;
          }

          .timeline-card-head {
            display: grid;
            grid-template-columns: 1fr;
            gap: 8px;
          }

          .timeline-card-actions {
            display: grid;
            grid-template-columns: 1fr;
          }

          .timeline-card-actions :global(.button) {
            width: 100% !important;
            min-width: 0 !important;
          }

          .timeline-detail-row {
            grid-template-columns: 1fr;
            gap: 4px;
          }
        }
      `}</style>
    </div>
  );
}

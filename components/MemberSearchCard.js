"use client";

import { useEffect, useMemo, useState } from "react";
import MemberDrawer from "@/components/MemberDrawer";

function initials(value) {
  const raw = String(value || "?").trim();
  if (!raw) return "?";

  const parts = raw.split(/\s+/).filter(Boolean).slice(0, 2);
  if (!parts.length) return raw.slice(0, 1).toUpperCase();

  return parts.map((part) => part.slice(0, 1).toUpperCase()).join("");
}

function useDebouncedValue(value, delay = 250) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}

function getDisplayName(member) {
  return (
    member?.display_name ||
    member?.nickname ||
    member?.username ||
    member?.user_id ||
    "Unknown Member"
  );
}

function getTopRoleLabel(member) {
  if (member?.top_role) return member.top_role;
  if (member?.highest_role_name) return member.highest_role_name;
  if (Array.isArray(member?.role_names) && member.role_names.length) return member.role_names[0];
  return "No top role";
}

function getRolePreview(member) {
  if (Array.isArray(member?.role_names) && member.role_names.length) {
    return member.role_names.slice(0, 4);
  }
  if (Array.isArray(member?.roles) && member.roles.length) {
    return member.roles
      .map((role) => {
        if (typeof role === "string") return role;
        if (role && typeof role === "object" && role.name) return role.name;
        return null;
      })
      .filter(Boolean)
      .slice(0, 4);
  }
  return [];
}

function formatTime(value) {
  if (!value) return "Unknown";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "Unknown";
  }
}

function mergeMemberSnapshotIntoList(rows, nextMember) {
  const nextId = String(nextMember?.user_id || nextMember?.id || "").trim();
  if (!nextId) return rows;

  return rows.map((item) => {
    const itemId = String(item?.user_id || item?.id || "").trim();
    if (itemId !== nextId) return item;
    return { ...item, ...nextMember };
  });
}

function sortResults(rows) {
  return [...rows].sort((a, b) => {
    const aConflict = String(a?.role_state || "").includes("conflict") ? 1 : 0;
    const bConflict = String(b?.role_state || "").includes("conflict") ? 1 : 0;
    if (aConflict !== bConflict) return bConflict - aConflict;

    const aInGuild = a?.in_guild !== false ? 1 : 0;
    const bInGuild = b?.in_guild !== false ? 1 : 0;
    if (aInGuild !== bInGuild) return bInGuild - aInGuild;

    const aUpdated = new Date(a?.updated_at || a?.last_seen_at || a?.joined_at || 0).getTime();
    const bUpdated = new Date(b?.updated_at || b?.last_seen_at || b?.joined_at || 0).getTime();
    return bUpdated - aUpdated;
  });
}

function QuickMemberActions({ member, currentStaffId, onRefresh }) {
  const [busy, setBusy] = useState("");
  const [reason, setReason] = useState("");
  const [timeoutMinutes, setTimeoutMinutes] = useState("10");

  const userId = String(member?.user_id || member?.id || "").trim();
  if (!userId || !currentStaffId) return null;

  async function queueAction(action, payload = {}) {
    setBusy(action);
    try {
      const res = await fetch("/api/dashboard/mod-action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
        body: JSON.stringify({
          action,
          payload: {
            ...payload,
            staff_id: currentStaffId,
            reason: String(reason || "").trim(),
          },
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to queue member action.");
      }

      await onRefresh?.();
    } catch (err) {
      alert(err?.message || "Failed to queue member action.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="member-search-actions">
      <div className="member-search-action-grid">
        <input
          className="input"
          placeholder="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <input
          className="input"
          placeholder="Timeout minutes"
          value={timeoutMinutes}
          onChange={(e) => setTimeoutMinutes(e.target.value)}
        />
      </div>

      <div className="member-search-action-buttons">
        <button
          type="button"
          className="button ghost"
          disabled={Boolean(busy)}
          onClick={() =>
            queueAction("timeout_member", {
              user_id: userId,
              minutes: Number(timeoutMinutes || 10),
            })
          }
        >
          {busy === "timeout_member" ? "Working..." : "Timeout"}
        </button>

        <button
          type="button"
          className="button ghost"
          disabled={Boolean(busy)}
          onClick={() => queueAction("remove_timeout", { user_id: userId })}
        >
          {busy === "remove_timeout" ? "Working..." : "Remove Timeout"}
        </button>

        <button
          type="button"
          className="button ghost"
          disabled={Boolean(busy)}
          onClick={() => queueAction("mute_member", { user_id: userId })}
        >
          {busy === "mute_member" ? "Working..." : "Mute VC"}
        </button>

        <button
          type="button"
          className="button ghost"
          disabled={Boolean(busy)}
          onClick={() => queueAction("disconnect_member", { user_id: userId })}
        >
          {busy === "disconnect_member" ? "Working..." : "Disconnect VC"}
        </button>

        <button
          type="button"
          className="button danger"
          disabled={Boolean(busy)}
          onClick={() => queueAction("strip_roles", { user_id: userId })}
        >
          {busy === "strip_roles" ? "Working..." : "Strip Roles"}
        </button>
      </div>

      <style jsx>{`
        .member-search-actions {
          display: grid;
          gap: 10px;
          margin-top: 12px;
        }

        .member-search-action-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .member-search-action-buttons {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        @media (max-width: 720px) {
          .member-search-action-grid,
          .member-search-action-buttons {
            display: grid;
            grid-template-columns: 1fr;
          }

          .member-search-action-buttons .button {
            width: 100%;
            min-width: 0;
          }
        }
      `}</style>
    </div>
  );
}

function MemberSearchResult({
  member,
  currentStaffId,
  onRefresh,
  onOpenProfile,
  expanded,
  onToggle,
}) {
  const displayName = getDisplayName(member);
  const avatarUrl = member.avatar_url || null;
  const inGuild = member.in_guild !== false;
  const memberId = member.user_id || member.id || "";
  const topRoleLabel = getTopRoleLabel(member);
  const rolePreview = getRolePreview(member);
  const conflict = String(member?.role_state || "").includes("conflict");

  return (
    <div className={`member-search-result premium ${expanded ? "expanded" : ""}`}>
      <button
        type="button"
        className="member-search-toggle"
        onClick={onToggle}
      >
        <div
          className="row"
          style={{
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
            flexWrap: "nowrap",
          }}
        >
          <div className="row" style={{ minWidth: 0, flex: 1, alignItems: "center", gap: 12 }}>
            <div className="avatar">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  width="38"
                  height="38"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                initials(displayName)
              )}
            </div>

            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="member-search-name">{displayName}</div>
              <div className="muted member-search-id">
                {memberId || "No user id"}
              </div>
              {member.nickname && member.nickname !== displayName ? (
                <div className="muted member-search-nick">
                  Nickname: {member.nickname}
                </div>
              ) : null}
            </div>
          </div>

          <div className="member-search-status-stack">
            <span className={`badge ${inGuild ? "claimed" : "closed"}`}>
              {inGuild ? "In Server" : "Former"}
            </span>
            <span
              className={`badge ${
                member.has_verified_role ? "low" : member.has_unverified ? "medium" : "open"
              }`}
            >
              {member.has_verified_role ? "Verified" : member.has_unverified ? "Unverified" : "Unknown"}
            </span>
            <span className={`badge ${member.has_staff_role ? "claimed" : "open"}`}>
              {member.has_staff_role ? "Staff" : "Member"}
            </span>
            {conflict ? <span className="badge danger">Conflict</span> : null}
          </div>
        </div>

        <div className="member-search-role-row">
          <span className="badge">{topRoleLabel}</span>
          {rolePreview.map((roleName) => (
            <span
              key={`${memberId}-${roleName}`}
              className="badge"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "var(--text-soft)",
              }}
            >
              {roleName}
            </span>
          ))}
        </div>

        <div className="row" style={{ justifyContent: "space-between", gap: 12, marginTop: 12 }}>
          <div className="muted" style={{ fontSize: 12 }}>
            {expanded ? "Hide quick controls" : "Open quick controls"}
          </div>
          <div className="badge open">{expanded ? "Expanded" : "Quick View"}</div>
        </div>
      </button>

      {expanded ? (
        <div className="member-search-expand">
          <div className="member-search-meta-grid">
            <div className="member-detail-item">
              <span className="ticket-info-label">Joined</span>
              <span>{formatTime(member.joined_at)}</span>
            </div>
            <div className="member-detail-item">
              <span className="ticket-info-label">Updated</span>
              <span>{formatTime(member.updated_at || member.last_seen_at)}</span>
            </div>
            <div className="member-detail-item">
              <span className="ticket-info-label">Role State</span>
              <span>{member.role_state || "unknown"}</span>
            </div>
          </div>

          <QuickMemberActions
            member={member}
            currentStaffId={currentStaffId}
            onRefresh={onRefresh}
          />

          <div className="member-search-bottom-buttons">
            <button
              type="button"
              className="button"
              onClick={onOpenProfile}
            >
              Open Profile
            </button>

            <button
              type="button"
              className="button ghost"
              onClick={onToggle}
            >
              Collapse
            </button>
          </div>
        </div>
      ) : null}

      <style jsx>{`
        .member-search-result.premium {
          border: 1px solid rgba(255,255,255,0.08);
          background:
            radial-gradient(circle at top right, rgba(93,255,141,0.06), transparent 36%),
            rgba(255,255,255,0.025);
          border-radius: 22px;
          padding: 14px;
        }

        .member-search-result.expanded {
          background:
            radial-gradient(circle at top right, rgba(99,213,255,0.08), transparent 36%),
            rgba(99,213,255,0.05);
          border-color: rgba(99,213,255,0.18);
          box-shadow: 0 0 18px rgba(99,213,255,0.08);
        }

        .member-search-toggle {
          appearance: none;
          -webkit-appearance: none;
          background: transparent;
          border: 0;
          width: 100%;
          padding: 0;
          margin: 0;
          text-align: left;
          color: inherit;
          cursor: pointer;
        }

        .member-search-name {
          font-weight: 900;
          color: var(--text-strong, #f8fafc);
          overflow-wrap: anywhere;
          line-height: 1.12;
          letter-spacing: -0.02em;
        }

        .member-search-id,
        .member-search-nick {
          margin-top: 4px;
          font-size: 13px;
          overflow-wrap: anywhere;
        }

        .member-search-status-stack {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 6px;
          flex-shrink: 0;
        }

        .member-search-role-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 12px;
        }

        .member-search-expand {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid rgba(255,255,255,0.08);
        }

        .member-search-meta-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 12px;
        }

        .member-search-bottom-buttons {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 12px;
        }

        @media (max-width: 720px) {
          .member-search-status-stack {
            gap: 5px;
          }

          .member-search-meta-grid,
          .member-search-bottom-buttons {
            grid-template-columns: 1fr;
            display: grid;
          }

          .member-search-bottom-buttons .button {
            width: 100%;
            min-width: 0;
          }
        }
      `}</style>
    </div>
  );
}

export default function MemberSearchCard({
  currentStaffId = null,
  onRefresh = async () => {},
}) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 250);

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [expandedMemberId, setExpandedMemberId] = useState("");

  async function reloadSearchPreservingQuery() {
    const q = String(debouncedQuery || "").trim();
    if (!q) {
      await onRefresh?.();
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/discord/member-search?q=${encodeURIComponent(q)}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Member search failed.");
      }

      setResults(sortResults(Array.isArray(json?.results) ? json.results : []));
      await onRefresh?.();
    } catch (err) {
      setError(err?.message || "Member search failed.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const q = debouncedQuery.trim();
      if (!q) {
        setResults([]);
        setError("");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const res = await fetch(`/api/discord/member-search?q=${encodeURIComponent(q)}`, { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json?.error || "Member search failed.");
        }

        if (!cancelled) {
          setResults(sortResults(Array.isArray(json?.results) ? json.results : []));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || "Member search failed.");
          setResults([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const summary = useMemo(() => {
    const total = results.length;
    const inServer = results.filter((x) => x.in_guild !== false).length;
    const leftServer = results.filter((x) => x.in_guild === false).length;
    const verified = results.filter((x) => !!x.has_verified_role).length;
    const pending = results.filter((x) => !!x.has_unverified).length;
    const staff = results.filter((x) => !!x.has_staff_role).length;
    const conflicts = results.filter((x) => String(x?.role_state || "").includes("conflict")).length;
    return { total, inServer, leftServer, verified, pending, staff, conflicts };
  }, [results]);

  useEffect(() => {
    if (!selected) return;
    const selectedId = String(selected?.user_id || selected?.id || "").trim();
    if (!selectedId) return;

    const updatedSelected = results.find((item) => String(item?.user_id || item?.id || "").trim() === selectedId);
    if (updatedSelected) {
      setSelected(updatedSelected);
    }
  }, [results, selected]);

  function toggleExpanded(member) {
    const memberId = String(member?.user_id || member?.id || "").trim();
    if (!memberId) return;
    setExpandedMemberId((prev) => (prev === memberId ? "" : memberId));
  }

  function handleMemberUpdated(nextMember) {
    setResults((prev) => sortResults(mergeMemberSnapshotIntoList(prev, nextMember)));
    setSelected((prev) => {
      const prevId = String(prev?.user_id || prev?.id || "").trim();
      const nextId = String(nextMember?.user_id || nextMember?.id || "").trim();
      if (!prevId || prevId !== nextId) return prev;
      return { ...prev, ...nextMember };
    });
  }

  return (
    <>
      <div className="card">
        <div
          className="row"
          style={{
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
            marginBottom: 12,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0 }}>Live Member Search</h2>
            <div className="muted" style={{ marginTop: 6 }}>
              Search username, display name, nickname, or ID with expandable real-action member controls
            </div>
          </div>

          {query.trim() ? (
            <div className="muted" style={{ fontSize: 13 }}>
              {summary.total} result{summary.total === 1 ? "" : "s"}
            </div>
          ) : null}
        </div>

        <div className="space">
          <input
            className="input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search members..."
            autoComplete="off"
          />

          {error ? <div className="error-banner">{error}</div> : null}
          {!query.trim() ? <div className="empty-state">Start typing to search live member records.</div> : null}
          {loading ? <div className="loading-state">Searching members...</div> : null}
          {query.trim() && !loading && !results.length && !error ? <div className="empty-state">No matching members found.</div> : null}

          {!loading && results.length ? (
            <>
              <div className="member-search-summary" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <span className="badge">{summary.total} tracked</span>
                <span className="badge claimed">{summary.inServer} in server</span>
                {summary.leftServer ? <span className="badge closed">{summary.leftServer} former</span> : null}
                <span className="badge low">{summary.verified} verified</span>
                <span className="badge medium">{summary.pending} unverified</span>
                <span className="badge claimed">{summary.staff} staff</span>
                {summary.conflicts ? <span className="badge danger">{summary.conflicts} conflicts</span> : null}
              </div>

              <div className="member-search-results">
                {results.map((member, index) => {
                  const memberId = member.user_id || member.id || `member-${index}`;
                  const expanded = expandedMemberId === memberId;

                  return (
                    <MemberSearchResult
                      key={memberId}
                      member={member}
                      currentStaffId={currentStaffId}
                      onRefresh={reloadSearchPreservingQuery}
                      onOpenProfile={() => setSelected(member)}
                      expanded={expanded}
                      onToggle={() => toggleExpanded(member)}
                    />
                  );
                })}
              </div>
            </>
          ) : null}
        </div>
      </div>

      <MemberDrawer
        member={selected}
        onClose={() => setSelected(null)}
        onMemberUpdated={handleMemberUpdated}
      />
    </>
  );
}

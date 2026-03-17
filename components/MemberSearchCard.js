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

  if (Array.isArray(member?.role_names) && member.role_names.length) {
    return member.role_names[0];
  }

  if (Array.isArray(member?.roles) && member.roles.length) {
    const first = member.roles[0];
    if (typeof first === "string") return first;
    if (first && typeof first === "object" && first.name) return first.name;
  }

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

  const found = rows.some((item) => String(item?.user_id || item?.id || "") === nextId);
  if (!found) return rows;

  return rows.map((item) => {
    const itemId = String(item?.user_id || item?.id || "").trim();
    if (itemId !== nextId) return item;
    return { ...item, ...nextMember };
  });
}

export default function MemberSearchCard() {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 250);

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [selected, setSelected] = useState(null);
  const [expandedMemberId, setExpandedMemberId] = useState("");

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
        const res = await fetch(`/api/discord/member-search?q=${encodeURIComponent(q)}`, {
          cache: "no-store",
        });

        const json = await res.json();

        if (!res.ok) {
          throw new Error(json.error || "Member search failed.");
        }

        if (!cancelled) {
          setResults(Array.isArray(json.results) ? json.results : []);
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
    const pending = results.filter((x) => !x.has_verified_role).length;
    const staff = results.filter((x) => !!x.has_staff_role).length;
    const conflicts = results.filter((x) => String(x?.role_state || "").includes("conflict")).length;

    return {
      total,
      inServer,
      leftServer,
      verified,
      pending,
      staff,
      conflicts,
    };
  }, [results]);

  useEffect(() => {
    if (!selected) return;

    const selectedId = selected.user_id || selected.id;
    if (!selectedId) return;

    const updatedSelected = results.find((item) => (item.user_id || item.id) === selectedId);

    if (updatedSelected) {
      setSelected(updatedSelected);
    }
  }, [results, selected]);

  function toggleExpanded(member) {
    const memberId = member?.user_id || member?.id || "";
    if (!memberId) return;

    setExpandedMemberId((prev) => (prev === memberId ? "" : memberId));
  }

  function handleMemberUpdated(nextMember) {
    setResults((prev) => mergeMemberSnapshotIntoList(prev, nextMember));
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

          {query.trim() && !loading && !results.length && !error ? (
            <div className="empty-state">No matching members found.</div>
          ) : null}

          {!loading && results.length ? (
            <>
              <div className="member-search-summary" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <span className="badge">{summary.total} tracked</span>
                <span className="badge claimed">{summary.inServer} in server</span>
                {summary.leftServer ? <span className="badge closed">{summary.leftServer} former</span> : null}
                <span className="badge low">{summary.verified} verified</span>
                <span className="badge medium">{summary.pending} pending</span>
                <span className="badge claimed">{summary.staff} staff</span>
                {summary.conflicts ? <span className="badge danger">{summary.conflicts} conflicts</span> : null}
              </div>

              <div className="member-search-results">
                {results.map((member, index) => {
                  const displayName = getDisplayName(member);
                  const avatarUrl = member.avatar_url || null;
                  const inGuild = member.in_guild !== false;
                  const memberId = member.user_id || member.id || `member-${index}`;
                  const topRoleLabel = getTopRoleLabel(member);
                  const rolePreview = getRolePreview(member);
                  const expanded = expandedMemberId === memberId;
                  const hasConflict = String(member?.role_state || "").includes("conflict");

                  return (
                    <div
                      key={memberId}
                      className="member-search-result"
                      style={{
                        border: "1px solid rgba(255,255,255,0.08)",
                        background: hasConflict ? "rgba(127,29,29,0.12)" : "rgba(255,255,255,0.02)",
                        borderRadius: 18,
                        padding: 12,
                      }}
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
                        <button
                          type="button"
                          onClick={() => toggleExpanded(member)}
                          style={{
                            background: "transparent",
                            border: "none",
                            padding: 0,
                            textAlign: "left",
                            cursor: "pointer",
                            minWidth: 0,
                            flex: 1,
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
                              <div
                                style={{
                                  fontWeight: 800,
                                  color: "var(--text-strong)",
                                  overflowWrap: "anywhere",
                                  lineHeight: 1.15,
                                }}
                              >
                                {displayName}
                              </div>

                              <div className="muted" style={{ marginTop: 4, fontSize: 13, overflowWrap: "anywhere" }}>
                                {memberId || "No user id"}
                              </div>

                              {member.nickname && member.nickname !== displayName ? (
                                <div className="muted" style={{ marginTop: 4, fontSize: 12, overflowWrap: "anywhere" }}>
                                  Nickname: {member.nickname}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </button>

                        <div
                          className="member-search-badges"
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-end",
                            gap: 6,
                            flexShrink: 0,
                          }}
                        >
                          <button
                            type="button"
                            className={`badge ${inGuild ? "claimed" : "closed"}`}
                            style={{ cursor: "pointer" }}
                            onClick={() => toggleExpanded(member)}
                          >
                            {inGuild ? "In Server" : "Former"}
                          </button>

                          <button
                            type="button"
                            className={`badge ${member.has_verified_role ? "low" : member.has_unverified ? "medium" : "open"}`}
                            style={{ cursor: "pointer" }}
                            onClick={() => toggleExpanded(member)}
                          >
                            {member.has_verified_role ? "Verified" : member.has_unverified ? "Unverified" : "Unknown"}
                          </button>

                          <button
                            type="button"
                            className={`badge ${member.has_staff_role ? "claimed" : "open"}`}
                            style={{ cursor: "pointer" }}
                            onClick={() => toggleExpanded(member)}
                          >
                            {member.has_staff_role ? "Staff" : "Member"}
                          </button>
                        </div>
                      </div>

                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                        <span className="badge">{topRoleLabel}</span>
                        {hasConflict ? <span className="badge danger">{member.role_state}</span> : null}

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

                      {expanded ? (
                        <div
                          style={{
                            marginTop: 12,
                            paddingTop: 12,
                            borderTop: "1px solid rgba(255,255,255,0.08)",
                          }}
                        >
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                              gap: 10,
                              marginBottom: 12,
                            }}
                          >
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

                          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                            <button
                              type="button"
                              className="button"
                              style={{ width: "auto", minWidth: 130 }}
                              onClick={() => setSelected(member)}
                            >
                              Open Profile
                            </button>

                            <button
                              type="button"
                              className="button ghost"
                              style={{ width: "auto", minWidth: 130 }}
                              onClick={() => toggleExpanded(member)}
                            >
                              Collapse
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </>
          ) : null}
        </div>
      </div>

      <MemberDrawer member={selected} onClose={() => setSelected(null)} onMemberUpdated={handleMemberUpdated} />
    </>
  );
}

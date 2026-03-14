"use client";

import { useMemo, useState } from "react";
import { syncRoleMembersAction } from "@/lib/dashboardActions";

type RoleRow = {
  id?: string | null;
  guild_id?: string | null;
  role_id?: string | null;
  name?: string | null;
  position?: number | null;
  member_count?: number | null;
};

type GuildMemberRole = {
  id?: string;
  name?: string;
  position?: number;
};

type GuildMemberRow = {
  guild_id?: string | null;
  user_id?: string | null;
  username?: string | null;
  display_name?: string | null;
  nickname?: string | null;
  avatar_url?: string | null;
  role_ids?: string[] | null;
  role_names?: string[] | null;
  roles?: GuildMemberRole[] | null;
  in_guild?: boolean | null;
  joined_at?: string | null;
  updated_at?: string | null;
  last_seen_at?: string | null;
};

type RoleHierarchyProps = {
  roles: RoleRow[];
  members: GuildMemberRow[];
  currentStaffId?: string | null;
  className?: string;
  title?: string;
  onChanged?: () => void | Promise<void>;
};

function normalizeString(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeBool(value: unknown): boolean {
  return value === true;
}

function formatDate(value?: string | null): string {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString();
}

function getMemberId(member: GuildMemberRow): string {
  return normalizeString(member.user_id);
}

function getRoleId(role: RoleRow): string {
  return normalizeString(role.role_id || role.id);
}

function getDisplayName(member: GuildMemberRow): string {
  return (
    normalizeString(member.display_name) ||
    normalizeString(member.nickname) ||
    normalizeString(member.username) ||
    "Unknown Member"
  );
}

function getSubtitle(member: GuildMemberRow): string {
  const username = normalizeString(member.username);
  const userId = getMemberId(member);

  if (username && userId) return `${username} • ${userId}`;
  if (username) return username;
  if (userId) return userId;
  return "Unknown";
}

function getRoleNames(member: GuildMemberRow): string[] {
  if (Array.isArray(member.role_names)) {
    return member.role_names.map((r) => normalizeString(r)).filter(Boolean);
  }

  if (Array.isArray(member.roles)) {
    return member.roles.map((r) => normalizeString(r?.name)).filter(Boolean);
  }

  return [];
}

function memberHasRole(
  member: GuildMemberRow,
  roleId: string,
  roleName: string
): boolean {
  const normalizedRoleId = normalizeString(roleId);
  const normalizedRoleName = normalizeString(roleName).toLowerCase();

  if (Array.isArray(member.role_ids)) {
    const hasId = member.role_ids.some(
      (id) => normalizeString(id) === normalizedRoleId
    );
    if (hasId) return true;
  }

  if (Array.isArray(member.roles)) {
    const hasRoleObj = member.roles.some(
      (r) =>
        normalizeString(r?.id) === normalizedRoleId ||
        normalizeString(r?.name).toLowerCase() === normalizedRoleName
    );
    if (hasRoleObj) return true;
  }

  if (Array.isArray(member.role_names)) {
    const hasName = member.role_names.some(
      (name) => normalizeString(name).toLowerCase() === normalizedRoleName
    );
    if (hasName) return true;
  }

  return false;
}

function chipStyle(selected = false) {
  return {
    background: selected
      ? "rgba(59,130,246,0.18)"
      : "rgba(255,255,255,0.06)",
    border: selected
      ? "1px solid rgba(59,130,246,0.38)"
      : "1px solid rgba(255,255,255,0.08)",
    color: selected ? "#dbeafe" : "var(--text-soft)",
  } as const;
}

function compactButtonStyle(disabled = false) {
  return {
    width: "auto",
    minWidth: 108,
    height: 42,
    opacity: disabled ? 0.75 : 1,
  } as const;
}

function avatarFallback(name: string): string {
  const clean = normalizeString(name);
  if (!clean) return "??";
  return clean.slice(0, 2).toUpperCase();
}

export default function RoleHierarchy({
  roles,
  members,
  currentStaffId,
  className = "",
  title = "Role Hierarchy Viewer",
  onChanged,
}: RoleHierarchyProps) {
  const activeMembers = useMemo(() => {
    return members.filter(
      (m) => normalizeBool(m.in_guild) || m.in_guild == null
    );
  }, [members]);

  const sortedRoles = useMemo(() => {
    return [...roles].sort((a, b) => {
      const posA = Number(a.position ?? 0);
      const posB = Number(b.position ?? 0);

      if (posA !== posB) return posB - posA;

      return normalizeString(a.name).localeCompare(
        normalizeString(b.name)
      );
    });
  }, [roles]);

  const [selectedRole, setSelectedRole] = useState<RoleRow | null>(null);
  const [expandedRoleId, setExpandedRoleId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [syncingRoleId, setSyncingRoleId] = useState<string>("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedRoleMembers = useMemo(() => {
    if (!selectedRole) return [];

    const roleId = getRoleId(selectedRole);
    const roleName = normalizeString(selectedRole.name);

    const base = activeMembers.filter((member) =>
      memberHasRole(member, roleId, roleName)
    );

    const term = search.trim().toLowerCase();
    if (!term) return base;

    return base.filter((member) => {
      const haystack = [
        getDisplayName(member),
        member.username || "",
        member.nickname || "",
        getMemberId(member),
        ...getRoleNames(member),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [selectedRole, activeMembers, search]);

  function openRole(role: RoleRow) {
    setSelectedRole(role);
    setExpandedRoleId(getRoleId(role));
    setSearch("");
    setError("");
    setMessage("");
  }

  function toggleExpand(role: RoleRow) {
    const roleId = getRoleId(role);
    setExpandedRoleId((prev) => (prev === roleId ? "" : roleId));
  }

  async function handleRoleSync(role: RoleRow) {
    const roleId = getRoleId(role);

    if (!roleId) {
      setError("Missing role ID.");
      return;
    }

    setSyncingRoleId(roleId);
    setError("");
    setMessage("");

    try {
      const result = await syncRoleMembersAction(
        {
          roleId,
          staffId: currentStaffId ?? null,
          requestedBy: currentStaffId ?? null,
        },
        {
          timeoutMs: 60_000,
          intervalMs: 2_000,
        }
      );

      if (!result.ok) {
        throw new Error(
          result.command?.error || "Failed to sync role members."
        );
      }

      setMessage(
        `Role sync complete${
          normalizeString(role.name)
            ? ` for ${normalizeString(role.name)}`
            : ""
        }.`
      );

      if (onChanged) {
        await onChanged();
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to sync role members."
      );
    } finally {
      setSyncingRoleId("");
    }
  }

  return (
    <div className={className}>
      <div className="card" style={{ marginBottom: 18 }}>
        <div style={{ marginBottom: 14 }}>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <div className="muted" style={{ marginTop: 6 }}>
            Compact on mobile. Tap a role row to expand. Tap the count bubble or
            role name to open members with that role.
          </div>
        </div>

        <div className="space">
          {sortedRoles.length === 0 ? (
            <div className="empty-state">No roles available.</div>
          ) : (
            sortedRoles.map((role) => {
              const roleId = getRoleId(role);
              const roleName = normalizeString(role.name) || "Unnamed Role";
              const count = Number(role.member_count ?? 0);
              const selected =
                !!selectedRole && getRoleId(selectedRole) === roleId;
              const expanded = expandedRoleId === roleId;
              const syncing = syncingRoleId === roleId;

              return (
                <div
                  key={roleId || normalizeString(role.id) || roleName}
                  className="card"
                  style={{
                    padding: 12,
                    borderRadius: 18,
                    border: selected
                      ? "1px solid rgba(59,130,246,0.35)"
                      : "1px solid rgba(255,255,255,0.08)",
                    background: selected
                      ? "linear-gradient(180deg, rgba(59,130,246,0.10), rgba(59,130,246,0.04))"
                      : "rgba(255,255,255,0.02)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    className="row"
                    style={{
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 10,
                      flexWrap: "nowrap",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => toggleExpand(role)}
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
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          minWidth: 0,
                        }}
                      >
                        <div
                          style={{
                            width: 10,
                            height: 10,
                            minWidth: 10,
                            borderRadius: "999px",
                            background: selected
                              ? "rgba(59,130,246,0.95)"
                              : "rgba(255,255,255,0.20)",
                            boxShadow: selected
                              ? "0 0 10px rgba(59,130,246,0.45)"
                              : "none",
                          }}
                        />

                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 800,
                              color: "var(--text-strong)",
                              overflowWrap: "anywhere",
                              lineHeight: 1.15,
                            }}
                          >
                            {roleName}
                          </div>

                          <div
                            className="muted"
                            style={{
                              marginTop: 4,
                              fontSize: 13,
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              flexWrap: "wrap",
                            }}
                          >
                            <span>Position {Number(role.position ?? 0)}</span>
                            <span>•</span>
                            <span>{count} member{count === 1 ? "" : "s"}</span>
                          </div>
                        </div>
                      </div>
                    </button>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexShrink: 0,
                      }}
                    >
                      <button
                        type="button"
                        className="badge"
                        style={{
                          ...chipStyle(selected),
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                        onClick={() => openRole(role)}
                      >
                        {count}
                      </button>

                      <button
                        type="button"
                        className="button ghost"
                        disabled={syncing}
                        onClick={() => handleRoleSync(role)}
                        style={compactButtonStyle(syncing)}
                      >
                        {syncing ? "Syncing..." : "Sync"}
                      </button>
                    </div>
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
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(150px, 1fr))",
                          gap: 10,
                        }}
                      >
                        <div className="member-detail-item">
                          <span className="ticket-info-label">Role</span>
                          <span>{roleName}</span>
                        </div>

                        <div className="member-detail-item">
                          <span className="ticket-info-label">Position</span>
                          <span>{Number(role.position ?? 0)}</span>
                        </div>

                        <div className="member-detail-item">
                          <span className="ticket-info-label">Tracked Members</span>
                          <span>{count}</span>
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: 10,
                          flexWrap: "wrap",
                          marginTop: 12,
                        }}
                      >
                        <button
                          type="button"
                          className="button"
                          onClick={() => openRole(role)}
                          style={{ width: "auto", minWidth: 140 }}
                        >
                          View Members
                        </button>

                        <button
                          type="button"
                          className="button ghost"
                          onClick={() => handleRoleSync(role)}
                          disabled={syncing}
                          style={{ width: "auto", minWidth: 140 }}
                        >
                          {syncing ? "Syncing Role..." : "Sync Role"}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>

      {message ? (
        <div
          className="info-banner"
          style={{
            marginBottom: 18,
            border: "1px solid rgba(16,185,129,0.28)",
            background: "rgba(16,185,129,0.12)",
            color: "#d1fae5",
          }}
        >
          {message}
        </div>
      ) : null}

      {error ? (
        <div
          className="error-banner"
          style={{
            marginBottom: 18,
            border: "1px solid rgba(239,68,68,0.28)",
            background: "rgba(239,68,68,0.12)",
            color: "#fecaca",
          }}
        >
          {error}
        </div>
      ) : null}

      {selectedRole ? (
        <div className="card">
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
            <div>
              <h2 style={{ margin: 0 }}>
                {normalizeString(selectedRole.name) || "Role Members"}
              </h2>
              <div className="muted" style={{ marginTop: 6 }}>
                Showing {selectedRoleMembers.length} member
                {selectedRoleMembers.length === 1 ? "" : "s"}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                width: "100%",
                maxWidth: 460,
              }}
            >
              <input
                className="input"
                style={{ flex: 1, minWidth: 180 }}
                placeholder="Search members, IDs, or role names..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <button
                type="button"
                className="button ghost"
                onClick={() => {
                  setSelectedRole(null);
                  setSearch("");
                }}
                style={{ width: "auto", minWidth: 92 }}
              >
                Close
              </button>
            </div>
          </div>

          <div className="space">
            {selectedRoleMembers.length === 0 ? (
              <div className="empty-state">
                No members found for this role.
              </div>
            ) : (
              selectedRoleMembers.map((member) => (
                <div
                  key={`${getMemberId(member)}-${
                    member.updated_at || member.last_seen_at || ""
                  }`}
                  className="card"
                  style={{
                    padding: 14,
                    borderRadius: 18,
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <div
                    className="row"
                    style={{
                      alignItems: "flex-start",
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        minWidth: 48,
                        borderRadius: "999px",
                        overflow: "hidden",
                        border: "1px solid rgba(255,255,255,0.08)",
                        background: "rgba(255,255,255,0.06)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 800,
                        color: "var(--text-strong)",
                      }}
                    >
                      {member.avatar_url ? (
                        <img
                          src={member.avatar_url}
                          alt={getDisplayName(member)}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        avatarFallback(getDisplayName(member))
                      )}
                    </div>

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontWeight: 800,
                          color: "var(--text-strong)",
                          overflowWrap: "anywhere",
                        }}
                      >
                        {getDisplayName(member)}
                      </div>

                      <div
                        className="muted"
                        style={{
                          marginTop: 4,
                          fontSize: 13,
                        }}
                      >
                        {getSubtitle(member)}
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(160px, 1fr))",
                          gap: 10,
                          marginTop: 12,
                        }}
                      >
                        <div className="member-detail-item">
                          <span className="ticket-info-label">Joined</span>
                          <span>{formatDate(member.joined_at)}</span>
                        </div>

                        <div className="member-detail-item">
                          <span className="ticket-info-label">Last Seen</span>
                          <span>
                            {formatDate(
                              member.last_seen_at || member.updated_at
                            )}
                          </span>
                        </div>

                        <div className="member-detail-item">
                          <span className="ticket-info-label">Role Count</span>
                          <span>{getRoleNames(member).length}</span>
                        </div>
                      </div>

                      {getRoleNames(member).length > 0 ? (
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 8,
                            marginTop: 12,
                          }}
                        >
                          {getRoleNames(member).map((roleName) => {
                            const highlighted =
                              roleName.toLowerCase() ===
                              normalizeString(selectedRole.name).toLowerCase();

                            return (
                              <span
                                key={`${getMemberId(member)}-${roleName}`}
                                className="badge"
                                style={
                                  highlighted
                                    ? {
                                        background:
                                          "rgba(59,130,246,0.18)",
                                        border:
                                          "1px solid rgba(59,130,246,0.38)",
                                        color: "#dbeafe",
                                      }
                                    : {
                                        background:
                                          "rgba(255,255,255,0.06)",
                                        border:
                                          "1px solid rgba(255,255,255,0.08)",
                                        color: "var(--text-soft)",
                                      }
                                }
                              >
                                {roleName}
                              </span>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

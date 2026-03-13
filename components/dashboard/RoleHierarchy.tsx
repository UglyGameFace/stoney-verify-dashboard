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

type GuildMemberRow = {
  guild_id?: string | null;
  user_id?: string | null;
  username?: string | null;
  display_name?: string | null;
  nickname?: string | null;
  avatar_url?: string | null;
  role_ids?: string[] | null;
  role_names?: string[] | null;
  roles?: Array<{ id?: string; name?: string }> | null;
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
    return member.roles
      .map((r) => normalizeString(r?.name))
      .filter(Boolean);
  }

  return [];
}

function memberHasRole(member: GuildMemberRow, roleId: string, roleName: string): boolean {
  const normalizedRoleId = normalizeString(roleId);
  const normalizedRoleName = normalizeString(roleName).toLowerCase();

  if (Array.isArray(member.role_ids)) {
    const hasId = member.role_ids.some((id) => normalizeString(id) === normalizedRoleId);
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

function buttonClass(kind: "primary" | "secondary", disabled = false) {
  const base =
    "inline-flex items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-semibold transition border";
  const palette =
    kind === "primary"
      ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
      : "bg-zinc-900 text-white border-zinc-700 hover:bg-zinc-800";
  const off = disabled ? " opacity-50 cursor-not-allowed hover:bg-inherit" : "";
  return `${base} ${palette}${off}`;
}

function panelClass() {
  return "rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4";
}

function inputClass() {
  return "w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-zinc-500";
}

export default function RoleHierarchy({
  roles,
  members,
  currentStaffId,
  className = "",
  title = "Role Hierarchy Viewer",
  onChanged,
}: RoleHierarchyProps) {
  const activeMembers = useMemo(
    () => members.filter((m) => normalizeBool(m.in_guild) || m.in_guild == null),
    [members]
  );

  const sortedRoles = useMemo(() => {
    return [...roles].sort((a, b) => {
      const posA = Number(a.position ?? 0);
      const posB = Number(b.position ?? 0);
      if (posA !== posB) return posB - posA;
      return normalizeString(a.name).localeCompare(normalizeString(b.name));
    });
  }, [roles]);

  const [selectedRole, setSelectedRole] = useState<RoleRow | null>(null);
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
        throw new Error(result.command?.error || "Failed to sync role members.");
      }

      const summary = result.command?.result as
        | {
            summary?: {
              role_name?: string;
              processed?: number;
              failed?: number;
            };
          }
        | undefined;

      setMessage(
        `Role sync complete${
          summary?.summary?.role_name ? ` for ${summary.summary.role_name}` : ""
        }.`
      );

      if (onChanged) {
        await onChanged();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sync role members.");
    } finally {
      setSyncingRoleId("");
    }
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-4">
        <div className="mb-4">
          <div className="text-lg font-semibold text-white">{title}</div>
          <div className="text-sm text-zinc-400">
            Tap a role name or count bubble to open the members with that role.
          </div>
        </div>

        <div className="space-y-3">
          {sortedRoles.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 text-sm text-zinc-400">
              No roles available.
            </div>
          ) : (
            sortedRoles.map((role) => {
              const roleId = getRoleId(role);
              const roleName = normalizeString(role.name) || "Unnamed Role";
              const count = Number(role.member_count ?? 0);
              const selected = selectedRole && getRoleId(selectedRole) === roleId;
              const syncing = syncingRoleId === roleId;

              return (
                <div
                  key={roleId || normalizeString(role.id) || roleName}
                  className={`rounded-2xl border p-4 transition ${
                    selected
                      ? "border-blue-700 bg-blue-950/20"
                      : "border-zinc-800 bg-zinc-900/60"
                  }`}
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        className="block text-left"
                        onClick={() => {
                          setSelectedRole(role);
                          setSearch("");
                          setError("");
                          setMessage("");
                        }}
                      >
                        <div className="truncate text-base font-semibold text-white">
                          {roleName}
                        </div>
                        <div className="mt-1 text-xs text-zinc-400">
                          Position: {Number(role.position ?? 0)}
                        </div>
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRole(role);
                          setSearch("");
                          setError("");
                          setMessage("");
                        }}
                        className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-900"
                      >
                        {count} member{count === 1 ? "" : "s"}
                      </button>

                      <button
                        type="button"
                        className={buttonClass("secondary", syncing)}
                        disabled={syncing}
                        onClick={() => handleRoleSync(role)}
                      >
                        {syncing ? "Syncing..." : "Sync Role"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {!!message && (
        <div className="rounded-2xl border border-emerald-800 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-300">
          {message}
        </div>
      )}

      {!!error && (
        <div className="rounded-2xl border border-red-800 bg-red-950/30 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {selectedRole && (
        <div className={panelClass()}>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-lg font-semibold text-white">
                {normalizeString(selectedRole.name) || "Role Members"}
              </div>
              <div className="text-sm text-zinc-400">
                Showing {selectedRoleMembers.length} member
                {selectedRoleMembers.length === 1 ? "" : "s"}
              </div>
            </div>

            <div className="flex gap-2">
              <input
                className={inputClass()}
                placeholder="Search members, IDs, or role names..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button
                type="button"
                className={buttonClass("secondary")}
                onClick={() => {
                  setSelectedRole(null);
                  setSearch("");
                }}
              >
                Close
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {selectedRoleMembers.length === 0 ? (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 text-sm text-zinc-400">
                No members found for this role.
              </div>
            ) : (
              selectedRoleMembers.map((member) => (
                <div
                  key={`${getMemberId(member)}-${member.updated_at || member.last_seen_at || ""}`}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-12 w-12 overflow-hidden rounded-full border border-zinc-800 bg-zinc-800">
                      {member.avatar_url ? (
                        <img
                          src={member.avatar_url}
                          alt={getDisplayName(member)}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-sm font-bold text-zinc-300">
                          {getDisplayName(member).slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="truncate text-base font-semibold text-white">
                        {getDisplayName(member)}
                      </div>
                      <div className="mt-1 text-sm text-zinc-400">
                        {getSubtitle(member)}
                      </div>

                      <div className="mt-3 grid gap-2 text-xs text-zinc-400 sm:grid-cols-2 lg:grid-cols-3">
                        <div>
                          <span className="font-semibold text-zinc-300">Joined:</span>{" "}
                          {formatDate(member.joined_at)}
                        </div>
                        <div>
                          <span className="font-semibold text-zinc-300">Last Seen:</span>{" "}
                          {formatDate(member.last_seen_at || member.updated_at)}
                        </div>
                        <div>
                          <span className="font-semibold text-zinc-300">Role Count:</span>{" "}
                          {getRoleNames(member).length}
                        </div>
                      </div>

                      {getRoleNames(member).length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {getRoleNames(member).map((roleName) => (
                            <span
                              key={`${getMemberId(member)}-${roleName}`}
                              className={`rounded-full border px-2.5 py-1 text-xs ${
                                roleName.toLowerCase() ===
                                normalizeString(selectedRole.name).toLowerCase()
                                  ? "border-blue-700 bg-blue-950/40 text-blue-300"
                                  : "border-zinc-700 bg-zinc-950 text-zinc-300"
                              }`}
                            >
                              {roleName}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

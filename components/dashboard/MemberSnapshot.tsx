"use client";

import { useMemo, useState } from "react";

type SnapshotMember = {
  guild_id?: string | null;
  user_id?: string | null;
  id?: string | null;
  username?: string | null;
  display_name?: string | null;
  nickname?: string | null;
  avatar_url?: string | null;
  has_verified_role?: boolean | null;
  has_unverified?: boolean | null;
  has_staff_role?: boolean | null;
  in_guild?: boolean | null;
  role_state?: string | null;
  role_names?: string[] | null;
  joined_at?: string | null;
  updated_at?: string | null;
  last_seen_at?: string | null;
};

type MemberSnapshotProps = {
  members: SnapshotMember[];
  className?: string;
  title?: string;
};

type BucketKey = "verified" | "unverified" | "staff";

function normalizeBool(value: unknown): boolean {
  return value === true;
}

function getMemberId(member: SnapshotMember): string {
  return String(member.user_id || member.id || "").trim();
}

function getDisplayName(member: SnapshotMember): string {
  return (
    String(member.display_name || "").trim() ||
    String(member.nickname || "").trim() ||
    String(member.username || "").trim() ||
    "Unknown Member"
  );
}

function getSubtitle(member: SnapshotMember): string {
  const username = String(member.username || "").trim();
  const id = getMemberId(member);
  if (username && id) return `${username} • ${id}`;
  if (username) return username;
  if (id) return id;
  return "Unknown";
}

function formatDate(value?: string | null): string {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString();
}

function bucketClass(kind: BucketKey) {
  if (kind === "verified") {
    return "border-emerald-800 bg-emerald-950/30 text-emerald-300 hover:bg-emerald-900/30";
  }
  if (kind === "unverified") {
    return "border-amber-800 bg-amber-950/30 text-amber-300 hover:bg-amber-900/30";
  }
  return "border-blue-800 bg-blue-950/30 text-blue-300 hover:bg-blue-900/30";
}

function panelClass() {
  return "rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4";
}

function inputClass() {
  return "w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-zinc-500";
}

export default function MemberSnapshot({
  members,
  className = "",
  title = "Member Control Snapshot",
}: MemberSnapshotProps) {
  const activeMembers = useMemo(
    () => members.filter((m) => normalizeBool(m.in_guild) || m.in_guild == null),
    [members]
  );

  const verifiedMembers = useMemo(
    () => activeMembers.filter((m) => normalizeBool(m.has_verified_role)),
    [activeMembers]
  );

  const unverifiedMembers = useMemo(
    () =>
      activeMembers.filter(
        (m) =>
          normalizeBool(m.has_unverified) ||
          (!normalizeBool(m.has_verified_role) && !normalizeBool(m.has_staff_role))
      ),
    [activeMembers]
  );

  const staffMembers = useMemo(
    () => activeMembers.filter((m) => normalizeBool(m.has_staff_role)),
    [activeMembers]
  );

  const [activeBucket, setActiveBucket] = useState<BucketKey | null>(null);
  const [search, setSearch] = useState("");

  const currentMembers = useMemo(() => {
    const base =
      activeBucket === "verified"
        ? verifiedMembers
        : activeBucket === "unverified"
        ? unverifiedMembers
        : activeBucket === "staff"
        ? staffMembers
        : [];

    const term = search.trim().toLowerCase();
    if (!term) return base;

    return base.filter((member) => {
      const haystack = [
        getDisplayName(member),
        member.username || "",
        member.nickname || "",
        getMemberId(member),
        ...(member.role_names || []),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [activeBucket, verifiedMembers, unverifiedMembers, staffMembers, search]);

  const bucketTitle =
    activeBucket === "verified"
      ? "Verified Members"
      : activeBucket === "unverified"
      ? "Unverified Members"
      : activeBucket === "staff"
      ? "Staff Members"
      : "";

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-white">{title}</div>
            <div className="text-sm text-zinc-400">
              Tap any bubble to open the matching member list.
            </div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-xs text-zinc-400">
            Total Active: <span className="font-semibold text-zinc-200">{activeMembers.length}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => {
              setActiveBucket("verified");
              setSearch("");
            }}
            className={`rounded-2xl border p-4 text-left transition ${bucketClass("verified")}`}
          >
            <div className="text-xs font-semibold uppercase tracking-wide">Verified</div>
            <div className="mt-2 text-3xl font-bold">{verifiedMembers.length}</div>
            <div className="mt-1 text-sm opacity-90">Open verified member list</div>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveBucket("unverified");
              setSearch("");
            }}
            className={`rounded-2xl border p-4 text-left transition ${bucketClass("unverified")}`}
          >
            <div className="text-xs font-semibold uppercase tracking-wide">Unverified</div>
            <div className="mt-2 text-3xl font-bold">{unverifiedMembers.length}</div>
            <div className="mt-1 text-sm opacity-90">Open unverified member list</div>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveBucket("staff");
              setSearch("");
            }}
            className={`rounded-2xl border p-4 text-left transition ${bucketClass("staff")}`}
          >
            <div className="text-xs font-semibold uppercase tracking-wide">Staff</div>
            <div className="mt-2 text-3xl font-bold">{staffMembers.length}</div>
            <div className="mt-1 text-sm opacity-90">Open staff member list</div>
          </button>
        </div>
      </div>

      {activeBucket && (
        <div className={panelClass()}>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-lg font-semibold text-white">{bucketTitle}</div>
              <div className="text-sm text-zinc-400">
                Showing {currentMembers.length} member{currentMembers.length === 1 ? "" : "s"}
              </div>
            </div>

            <div className="flex gap-2">
              <input
                className={inputClass()}
                placeholder="Search members, IDs, or roles..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button
                type="button"
                className="rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
                onClick={() => {
                  setActiveBucket(null);
                  setSearch("");
                }}
              >
                Close
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {currentMembers.length === 0 ? (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 text-sm text-zinc-400">
                No members found for this filter.
              </div>
            ) : (
              currentMembers.map((member) => (
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
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="truncate text-base font-semibold text-white">
                          {getDisplayName(member)}
                        </div>

                        {normalizeBool(member.has_verified_role) && (
                          <span className="rounded-full border border-emerald-800 bg-emerald-950/40 px-2 py-0.5 text-xs font-semibold text-emerald-300">
                            Verified
                          </span>
                        )}

                        {normalizeBool(member.has_unverified) && (
                          <span className="rounded-full border border-amber-800 bg-amber-950/40 px-2 py-0.5 text-xs font-semibold text-amber-300">
                            Unverified
                          </span>
                        )}

                        {normalizeBool(member.has_staff_role) && (
                          <span className="rounded-full border border-blue-800 bg-blue-950/40 px-2 py-0.5 text-xs font-semibold text-blue-300">
                            Staff
                          </span>
                        )}
                      </div>

                      <div className="mt-1 text-sm text-zinc-400">{getSubtitle(member)}</div>

                      <div className="mt-3 grid gap-2 text-xs text-zinc-400 sm:grid-cols-2 lg:grid-cols-3">
                        <div>
                          <span className="font-semibold text-zinc-300">Role State:</span>{" "}
                          {member.role_state || "unknown"}
                        </div>
                        <div>
                          <span className="font-semibold text-zinc-300">Joined:</span>{" "}
                          {formatDate(member.joined_at)}
                        </div>
                        <div>
                          <span className="font-semibold text-zinc-300">Last Seen:</span>{" "}
                          {formatDate(member.last_seen_at || member.updated_at)}
                        </div>
                      </div>

                      {member.role_names && member.role_names.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {member.role_names.map((roleName) => (
                            <span
                              key={`${getMemberId(member)}-${roleName}`}
                              className="rounded-full border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-300"
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

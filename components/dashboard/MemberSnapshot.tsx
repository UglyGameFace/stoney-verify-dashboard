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

function bubbleStyle(kind: BucketKey) {
  if (kind === "verified") {
    return {
      border: "1px solid rgba(52, 211, 153, 0.28)",
      background: "linear-gradient(180deg, rgba(16,185,129,0.16), rgba(16,185,129,0.08))",
      color: "#d1fae5",
    };
  }

  if (kind === "unverified") {
    return {
      border: "1px solid rgba(245, 158, 11, 0.28)",
      background: "linear-gradient(180deg, rgba(245,158,11,0.16), rgba(245,158,11,0.08))",
      color: "#fef3c7",
    };
  }

  return {
    border: "1px solid rgba(59, 130, 246, 0.28)",
    background: "linear-gradient(180deg, rgba(59,130,246,0.16), rgba(59,130,246,0.08))",
    color: "#dbeafe",
  };
}

function chipStyle(kind: "verified" | "unverified" | "staff") {
  if (kind === "verified") {
    return {
      border: "1px solid rgba(52, 211, 153, 0.28)",
      background: "rgba(16,185,129,0.12)",
      color: "#d1fae5",
    };
  }
  if (kind === "unverified") {
    return {
      border: "1px solid rgba(245, 158, 11, 0.28)",
      background: "rgba(245,158,11,0.12)",
      color: "#fef3c7",
    };
  }
  return {
    border: "1px solid rgba(59, 130, 246, 0.28)",
    background: "rgba(59,130,246,0.12)",
    color: "#dbeafe",
  };
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
    <div className={className}>
      <div className="card" style={{ marginBottom: 18 }}>
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
            <h2 style={{ margin: 0 }}>{title}</h2>
            <div className="muted" style={{ marginTop: 6 }}>
              Tap any bubble to open the matching member list.
            </div>
          </div>

          <div className="badge" style={{ alignSelf: "flex-start" }}>
            Total Active: {activeMembers.length}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          <button
            type="button"
            onClick={() => {
              setActiveBucket("verified");
              setSearch("");
            }}
            style={{
              ...bubbleStyle("verified"),
              borderRadius: 18,
              padding: "16px 14px",
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.9 }}>VERIFIED</div>
            <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.1, marginTop: 10 }}>
              {verifiedMembers.length}
            </div>
            <div style={{ marginTop: 8, fontSize: 14, opacity: 0.95 }}>
              Open verified member list
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveBucket("unverified");
              setSearch("");
            }}
            style={{
              ...bubbleStyle("unverified"),
              borderRadius: 18,
              padding: "16px 14px",
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.9 }}>UNVERIFIED</div>
            <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.1, marginTop: 10 }}>
              {unverifiedMembers.length}
            </div>
            <div style={{ marginTop: 8, fontSize: 14, opacity: 0.95 }}>
              Open unverified member list
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveBucket("staff");
              setSearch("");
            }}
            style={{
              ...bubbleStyle("staff"),
              borderRadius: 18,
              padding: "16px 14px",
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.9 }}>STAFF</div>
            <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.1, marginTop: 10 }}>
              {staffMembers.length}
            </div>
            <div style={{ marginTop: 8, fontSize: 14, opacity: 0.95 }}>
              Open staff member list
            </div>
          </button>
        </div>
      </div>

      {activeBucket ? (
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
              <h2 style={{ margin: 0 }}>{bucketTitle}</h2>
              <div className="muted" style={{ marginTop: 6 }}>
                Showing {currentMembers.length} member{currentMembers.length === 1 ? "" : "s"}
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
                placeholder="Search members, IDs, or roles..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <button
                type="button"
                className="button ghost"
                onClick={() => {
                  setActiveBucket(null);
                  setSearch("");
                }}
                style={{ width: "auto", minWidth: 92 }}
              >
                Close
              </button>
            </div>
          </div>

          <div className="space">
            {currentMembers.length === 0 ? (
              <div className="empty-state">No members found for this filter.</div>
            ) : (
              currentMembers.map((member) => (
                <div
                  key={`${getMemberId(member)}-${member.updated_at || member.last_seen_at || ""}`}
                  className="card"
                  style={{
                    padding: 14,
                    borderRadius: 18,
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <div className="row" style={{ alignItems: "flex-start", gap: 12 }}>
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
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        getDisplayName(member).slice(0, 2).toUpperCase()
                      )}
                    </div>

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        className="row"
                        style={{
                          gap: 8,
                          alignItems: "center",
                          flexWrap: "wrap",
                          marginBottom: 6,
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 800,
                            color: "var(--text-strong)",
                            overflowWrap: "anywhere",
                          }}
                        >
                          {getDisplayName(member)}
                        </div>

                        {normalizeBool(member.has_verified_role) ? (
                          <span className="badge" style={chipStyle("verified")}>
                            Verified
                          </span>
                        ) : null}

                        {normalizeBool(member.has_unverified) ? (
                          <span className="badge" style={chipStyle("unverified")}>
                            Unverified
                          </span>
                        ) : null}

                        {normalizeBool(member.has_staff_role) ? (
                          <span className="badge" style={chipStyle("staff")}>
                            Staff
                          </span>
                        ) : null}
                      </div>

                      <div className="muted" style={{ fontSize: 13, overflowWrap: "anywhere" }}>
                        {getSubtitle(member)}
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                          gap: 10,
                          marginTop: 12,
                        }}
                      >
                        <div className="member-detail-item">
                          <span className="ticket-info-label">Role State</span>
                          <span>{member.role_state || "unknown"}</span>
                        </div>

                        <div className="member-detail-item">
                          <span className="ticket-info-label">Joined</span>
                          <span>{formatDate(member.joined_at)}</span>
                        </div>

                        <div className="member-detail-item">
                          <span className="ticket-info-label">Last Seen</span>
                          <span>{formatDate(member.last_seen_at || member.updated_at)}</span>
                        </div>
                      </div>

                      {member.role_names && member.role_names.length > 0 ? (
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 8,
                            marginTop: 12,
                          }}
                        >
                          {member.role_names.map((roleName) => (
                            <span
                              key={`${getMemberId(member)}-${roleName}`}
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

"use client";

import { useMemo, useState } from "react";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeString(value) {
  return String(value || "").trim();
}

function looksLikeDiscordId(value) {
  return /^\d{16,22}$/.test(normalizeString(value));
}

function isLikelyBot(row) {
  const name = normalizeString(row?.staff_name).toLowerCase();
  const rawId = normalizeString(row?.staff_id).toLowerCase();
  const flags = [
    row?.is_bot,
    row?.bot,
    row?.isBot,
    row?.user_is_bot,
    row?.member_is_bot,
  ];

  if (flags.some(Boolean)) return true;

  const combined = `${name} ${rawId}`.trim();

  if (!combined) return false;

  const botNeedles = [
    " bot",
    "bot ",
    "#0000",
    "ticket tool",
    "tickettool",
    "disboard",
    "probot",
    "jockie music",
    "top.gg",
    "pokemon idle",
    "stoney verify",
    "verify helper",
    "manager#",
    "manager bot",
  ];

  return botNeedles.some((needle) => combined.includes(needle));
}

function displayStaffName(row) {
  const cleanedName = normalizeString(row?.staff_name);
  const cleanedId = normalizeString(row?.staff_id);

  if (cleanedName) return cleanedName;
  if (cleanedId && !looksLikeDiscordId(cleanedId)) return cleanedId;
  return "Unknown Staff";
}

function displayStaffSubline(row) {
  const rawId = normalizeString(row?.staff_id);
  const role = normalizeString(row?.staff_role || row?.role_name || "");

  if (role) return role;

  if (looksLikeDiscordId(rawId)) {
    return `ID ${rawId}`;
  }

  if (rawId && rawId !== displayStaffName(row)) {
    return rawId;
  }

  return "Human staff record";
}

function formatLastActive(value) {
  if (!value) return "Unknown";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "Unknown";
  }
}

function scoreRow(row) {
  return (
    Number(row?.tickets_handled || 0) * 1000 +
    Number(row?.approvals || 0) * 100 +
    Number(row?.denials || 0) * 10 -
    Number(row?.avg_response_minutes || 0)
  );
}

function formatPercent(part, total) {
  if (!total) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

function compactNumber(value) {
  const num = Number(value || 0);
  if (num >= 1000) return `${(num / 1000).toFixed(num >= 10000 ? 0 : 1)}k`;
  return String(num);
}

export default function StaffMetricsCard({ metrics = [] }) {
  const [showAll, setShowAll] = useState(false);

  const prepared = useMemo(() => {
    return safeArray(metrics)
      .filter((row) => normalizeString(row?.staff_name || row?.staff_id))
      .filter((row) => !isLikelyBot(row))
      .sort((a, b) => {
        const handledDiff =
          Number(b?.tickets_handled || 0) - Number(a?.tickets_handled || 0);
        if (handledDiff !== 0) return handledDiff;

        const approvalsDiff =
          Number(b?.approvals || 0) - Number(a?.approvals || 0);
        if (approvalsDiff !== 0) return approvalsDiff;

        const denialsDiff =
          Number(a?.denials || 0) - Number(b?.denials || 0);
        if (denialsDiff !== 0) return denialsDiff;

        return displayStaffName(a).localeCompare(displayStaffName(b));
      });
  }, [metrics]);

  const visibleRows = useMemo(() => {
    return showAll ? prepared : prepared.slice(0, 8);
  }, [prepared, showAll]);

  const totalHandled = prepared.reduce(
    (sum, row) => sum + Number(row?.tickets_handled || 0),
    0
  );

  const totalApprovals = prepared.reduce(
    (sum, row) => sum + Number(row?.approvals || 0),
    0
  );

  const totalDenials = prepared.reduce(
    (sum, row) => sum + Number(row?.denials || 0),
    0
  );

  const topHandled = prepared.reduce(
    (max, row) => Math.max(max, Number(row?.tickets_handled || 0)),
    0
  );

  const avgResponseAcrossTeam = prepared.length
    ? Math.round(
        prepared.reduce(
          (sum, row) => sum + Number(row?.avg_response_minutes || 0),
          0
        ) / prepared.length
      )
    : 0;

  const topPerformer = prepared[0] || null;

  return (
    <div className="space">
      {!prepared.length ? (
        <div className="empty-state">
          No human staff metrics are available yet.
        </div>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: 10,
              marginBottom: 14,
            }}
          >
            <div className="member-detail-item">
              <span className="ticket-info-label">Human Staff</span>
              <span style={{ color: "var(--text-strong, #f8fafc)" }}>
                {prepared.length}
              </span>
            </div>

            <div className="member-detail-item">
              <span className="ticket-info-label">Handled</span>
              <span style={{ color: "var(--text-strong, #f8fafc)" }}>
                {compactNumber(totalHandled)}
              </span>
            </div>

            <div className="member-detail-item">
              <span className="ticket-info-label">Approvals</span>
              <span style={{ color: "var(--text-strong, #f8fafc)" }}>
                {compactNumber(totalApprovals)}
              </span>
            </div>

            <div className="member-detail-item">
              <span className="ticket-info-label">Denials</span>
              <span style={{ color: "var(--text-strong, #f8fafc)" }}>
                {compactNumber(totalDenials)}
              </span>
            </div>

            <div className="member-detail-item">
              <span className="ticket-info-label">Avg Response</span>
              <span style={{ color: "var(--text-strong, #f8fafc)" }}>
                {avgResponseAcrossTeam}m
              </span>
            </div>

            <div className="member-detail-item">
              <span className="ticket-info-label">Top Performer</span>
              <span
                style={{
                  color: "var(--text-strong, #f8fafc)",
                  overflowWrap: "anywhere",
                }}
              >
                {topPerformer ? displayStaffName(topPerformer) : "—"}
              </span>
            </div>
          </div>

          <div className="space">
            {visibleRows.map((row, index) => {
              const handled = Number(row?.tickets_handled || 0);
              const approvals = Number(row?.approvals || 0);
              const denials = Number(row?.denials || 0);
              const avgResponse = Number(row?.avg_response_minutes || 0);

              const widthPercent =
                topHandled > 0
                  ? Math.max(10, Math.round((handled / topHandled) * 100))
                  : 10;

              const approvalRate = formatPercent(approvals, handled || 0);

              const rank = index + 1;

              return (
                <details
                  key={`${normalizeString(row?.staff_id)}-${displayStaffName(row)}`}
                  className="card"
                  style={{
                    padding: 14,
                    borderRadius: 18,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.02)",
                  }}
                >
                  <summary
                    style={{
                      listStyle: "none",
                      cursor: "pointer",
                      outline: "none",
                    }}
                  >
                    <div
                      className="row"
                      style={{
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          className="row"
                          style={{
                            alignItems: "center",
                            gap: 10,
                            flexWrap: "wrap",
                          }}
                        >
                          <span className="badge">{`#${rank}`}</span>

                          <div
                            style={{
                              fontWeight: 800,
                              color: "var(--text-strong, #f8fafc)",
                              overflowWrap: "anywhere",
                              lineHeight: 1.15,
                              fontSize: 18,
                            }}
                          >
                            {displayStaffName(row)}
                          </div>
                        </div>

                        <div
                          className="muted"
                          style={{
                            marginTop: 4,
                            fontSize: 13,
                            overflowWrap: "anywhere",
                          }}
                        >
                          {displayStaffSubline(row)}
                        </div>

                        <div
                          style={{
                            marginTop: 8,
                            fontSize: 13,
                            color: "var(--text-muted, rgba(255,255,255,0.72))",
                          }}
                        >
                          {approvalRate} approval rate
                        </div>

                        <div
                          style={{
                            marginTop: 12,
                            height: 8,
                            width: "100%",
                            borderRadius: 999,
                            background: "rgba(255,255,255,0.08)",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${widthPercent}%`,
                              borderRadius: 999,
                              background:
                                "linear-gradient(90deg, var(--accent, #45d483), var(--accent-2, #3b82f6))",
                            }}
                          />
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          flexWrap: "wrap",
                          justifyContent: "flex-end",
                          flexShrink: 0,
                        }}
                      >
                        <span className="badge">{handled} handled</span>
                        <span className="badge claimed">{approvals} approvals</span>
                        {denials > 0 ? (
                          <span className="badge medium">{denials} denials</span>
                        ) : null}
                      </div>
                    </div>
                  </summary>

                  <div
                    style={{
                      marginTop: 14,
                      paddingTop: 14,
                      borderTop: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                        gap: 10,
                      }}
                    >
                      <div className="member-detail-item">
                        <span className="ticket-info-label">Tickets Handled</span>
                        <span style={{ color: "var(--text-strong, #f8fafc)" }}>
                          {handled}
                        </span>
                      </div>

                      <div className="member-detail-item">
                        <span className="ticket-info-label">Approvals</span>
                        <span style={{ color: "var(--text-strong, #f8fafc)" }}>
                          {approvals}
                        </span>
                      </div>

                      <div className="member-detail-item">
                        <span className="ticket-info-label">Denials</span>
                        <span style={{ color: "var(--text-strong, #f8fafc)" }}>
                          {denials}
                        </span>
                      </div>

                      <div className="member-detail-item">
                        <span className="ticket-info-label">Approval Rate</span>
                        <span style={{ color: "var(--text-strong, #f8fafc)" }}>
                          {approvalRate}
                        </span>
                      </div>

                      <div className="member-detail-item">
                        <span className="ticket-info-label">Avg Response</span>
                        <span style={{ color: "var(--text-strong, #f8fafc)" }}>
                          {avgResponse}m
                        </span>
                      </div>

                      <div className="member-detail-item">
                        <span className="ticket-info-label">Last Active</span>
                        <span style={{ color: "var(--text-strong, #f8fafc)" }}>
                          {formatLastActive(row?.last_active)}
                        </span>
                      </div>

                      <div className="member-detail-item">
                        <span className="ticket-info-label">Performance Score</span>
                        <span style={{ color: "var(--text-strong, #f8fafc)" }}>
                          {scoreRow(row)}
                        </span>
                      </div>

                      {normalizeString(row?.staff_id) ? (
                        <div className="member-detail-item">
                          <span className="ticket-info-label">Staff ID</span>
                          <span
                            style={{
                              color: "var(--text-strong, #f8fafc)",
                              overflowWrap: "anywhere",
                            }}
                          >
                            {normalizeString(row?.staff_id)}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </details>
              );
            })}
          </div>

          {prepared.length > 8 ? (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginTop: 14,
              }}
            >
              <button
                className="button ghost"
                type="button"
                style={{ width: "auto", minWidth: 140 }}
                onClick={() => setShowAll((prev) => !prev)}
              >
                {showAll ? "Show Less" : `Show All (${prepared.length})`}
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

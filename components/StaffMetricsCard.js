"use client";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeString(value) {
  return String(value || "").trim();
}

function looksLikeDiscordId(value) {
  return /^\d{16,22}$/.test(normalizeString(value));
}

function displayStaffName(row) {
  return (
    normalizeString(row?.staff_name) ||
    (looksLikeDiscordId(row?.staff_id) ? "Unknown Staff" : normalizeString(row?.staff_id)) ||
    "Unknown Staff"
  );
}

function displayStaffSubline(row) {
  const rawId = normalizeString(row?.staff_id);
  if (looksLikeDiscordId(rawId)) {
    return `ID ${rawId}`;
  }

  const fallback = normalizeString(rawId);
  if (fallback && fallback !== displayStaffName(row)) {
    return fallback;
  }

  return "Staff record";
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

export default function StaffMetricsCard({ metrics = [] }) {
  const safeMetrics = safeArray(metrics)
    .filter((row) => normalizeString(row?.staff_name || row?.staff_id))
    .sort((a, b) => {
      const handledDiff =
        Number(b?.tickets_handled || 0) - Number(a?.tickets_handled || 0);
      if (handledDiff !== 0) return handledDiff;

      const approvalsDiff =
        Number(b?.approvals || 0) - Number(a?.approvals || 0);
      if (approvalsDiff !== 0) return approvalsDiff;

      return displayStaffName(a).localeCompare(displayStaffName(b));
    });

  const totalHandled = safeMetrics.reduce(
    (sum, row) => sum + Number(row?.tickets_handled || 0),
    0
  );

  const totalApprovals = safeMetrics.reduce(
    (sum, row) => sum + Number(row?.approvals || 0),
    0
  );

  const topHandled = safeMetrics.reduce(
    (max, row) => Math.max(max, Number(row?.tickets_handled || 0)),
    0
  );

  return (
    <div className="space">
      {!safeMetrics.length ? (
        <div className="empty-state">
          No staff metrics are available yet.
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
              <span className="ticket-info-label">Staff</span>
              <span>{safeMetrics.length}</span>
            </div>

            <div className="member-detail-item">
              <span className="ticket-info-label">Handled</span>
              <span>{totalHandled}</span>
            </div>

            <div className="member-detail-item">
              <span className="ticket-info-label">Approvals</span>
              <span>{totalApprovals}</span>
            </div>

            <div className="member-detail-item">
              <span className="ticket-info-label">Top Performer</span>
              <span>{displayStaffName(safeMetrics[0])}</span>
            </div>
          </div>

          <div className="space">
            {safeMetrics.map((row) => {
              const handled = Number(row?.tickets_handled || 0);
              const approvals = Number(row?.approvals || 0);
              const denials = Number(row?.denials || 0);
              const avgResponse = Number(row?.avg_response_minutes || 0);

              const widthPercent =
                topHandled > 0
                  ? Math.max(10, Math.round((handled / topHandled) * 100))
                  : 10;

              const ratioLabel =
                handled > 0
                  ? `${Math.round((approvals / Math.max(handled, 1)) * 100)}% approval rate`
                  : "No handled tickets yet";

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
                        flexWrap: "nowrap",
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontWeight: 800,
                            color: "var(--text-strong)",
                            overflowWrap: "anywhere",
                            lineHeight: 1.15,
                            fontSize: 18,
                          }}
                        >
                          {displayStaffName(row)}
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
                            color: "var(--text-muted)",
                          }}
                        >
                          {ratioLabel}
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
                                "linear-gradient(90deg, rgba(69,212,131,0.9), rgba(59,130,246,0.9))",
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
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(140px, 1fr))",
                        gap: 10,
                      }}
                    >
                      <div className="member-detail-item">
                        <span className="ticket-info-label">Tickets Handled</span>
                        <span>{handled}</span>
                      </div>

                      <div className="member-detail-item">
                        <span className="ticket-info-label">Approvals</span>
                        <span>{approvals}</span>
                      </div>

                      <div className="member-detail-item">
                        <span className="ticket-info-label">Denials</span>
                        <span>{denials}</span>
                      </div>

                      <div className="member-detail-item">
                        <span className="ticket-info-label">Avg Response</span>
                        <span>{avgResponse}m</span>
                      </div>

                      <div className="member-detail-item">
                        <span className="ticket-info-label">Last Active</span>
                        <span>{formatLastActive(row?.last_active)}</span>
                      </div>

                      <div className="member-detail-item">
                        <span className="ticket-info-label">Performance Score</span>
                        <span>{scoreRow(row)}</span>
                      </div>
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

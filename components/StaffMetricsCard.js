export default function StaffMetricsCard({ metrics = [] }) {
  const safeMetrics = Array.isArray(metrics) ? metrics : [];

  const sortedMetrics = [...safeMetrics].sort((a, b) => {
    const handledDiff =
      Number(b?.tickets_handled || 0) - Number(a?.tickets_handled || 0);
    if (handledDiff !== 0) return handledDiff;

    const approvalsDiff =
      Number(b?.approvals || 0) - Number(a?.approvals || 0);
    if (approvalsDiff !== 0) return approvalsDiff;

    return String(a?.staff_name || a?.staff_id || "").localeCompare(
      String(b?.staff_name || b?.staff_id || "")
    );
  });

  const topHandled = sortedMetrics.reduce(
    (max, row) => Math.max(max, Number(row?.tickets_handled || 0)),
    0
  );

  function formatLastActive(value) {
    if (!value) return "Unknown";

    try {
      return new Date(value).toLocaleString();
    } catch {
      return "Unknown";
    }
  }

  function compactName(row) {
    return (
      row?.staff_name ||
      row?.staff_id ||
      "Unknown Staff"
    );
  }

  return (
    <div className="card">
      <div
        className="row"
        style={{
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Staff Performance</h2>
          <div className="muted" style={{ marginTop: 6 }}>
            Compact mobile cards with expandable performance details.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <span className="badge">
            {sortedMetrics.length} staff
          </span>
          <span className="badge claimed">
            {sortedMetrics.reduce(
              (sum, row) => sum + Number(row?.tickets_handled || 0),
              0
            )}{" "}
            handled
          </span>
        </div>
      </div>

      {!sortedMetrics.length ? (
        <div className="empty-state">No staff metrics yet.</div>
      ) : (
        <div className="space">
          {sortedMetrics.map((row) => {
            const handled = Number(row?.tickets_handled || 0);
            const approvals = Number(row?.approvals || 0);
            const denials = Number(row?.denials || 0);
            const avgResponse = Number(row?.avg_response_minutes || 0);
            const staffName = compactName(row);

            const widthPercent =
              topHandled > 0
                ? Math.max(8, Math.round((handled / topHandled) * 100))
                : 8;

            return (
              <details
                key={row?.staff_id || staffName}
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
                        }}
                      >
                        {staffName}
                      </div>

                      <div
                        className="muted"
                        style={{
                          marginTop: 4,
                          fontSize: 13,
                          overflowWrap: "anywhere",
                        }}
                      >
                        {row?.staff_id || "No staff ID"}
                      </div>

                      <div
                        style={{
                          marginTop: 10,
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
                      <span className="badge">
                        {handled} handled
                      </span>
                      <span className="badge claimed">
                        {approvals} approvals
                      </span>
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
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}

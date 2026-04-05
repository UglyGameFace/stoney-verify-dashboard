function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function safeText(value, fallback = "—") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function safeCount(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function formatTime(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "—";
  }
}

function buildHistoricalNames(initialData, viewer, member) {
  const names = [
    member?.display_name,
    member?.username,
    member?.nickname,
    viewer?.global_name,
    viewer?.username,
    ...safeArray(initialData?.historicalUsernames),
  ];

  safeArray(initialData?.usernameHistory).forEach((row) => {
    names.push(row?.username, row?.display_name, row?.nickname);
  });

  return [...new Set(names.map((item) => String(item || "").trim()).filter(Boolean))].slice(0, 20);
}

function getLatestVcSession(initialData) {
  return safeArray(initialData?.vcSessions)
    .slice()
    .sort((a, b) => new Date(b?.created_at || 0).getTime() - new Date(a?.created_at || 0).getTime())[0] || null;
}

function getVerificationSummary(initialData, verificationFlags) {
  const summary = safeObject(initialData?.verification);
  const flags = safeArray(verificationFlags);
  const latestVc = getLatestVcSession(initialData);

  return {
    status: safeText(summary?.status, "unknown"),
    flag_count: safeCount(summary?.flag_count, flags.length),
    flagged_count: safeCount(summary?.flagged_count, flags.filter((item) => item?.flagged).length),
    latest_flag_at: summary?.latest_flag_at || null,
    vc_latest_status: safeText(summary?.vc_latest_status, latestVc?.status || "—"),
    vc_request_count: safeCount(summary?.vc_request_count, safeArray(initialData?.vcSessions).length),
  };
}

export function HomeExtraSignals({ initialData, member, verificationFlags, viewer, openTicket }) {
  const entry = safeObject(initialData?.entry);
  const relationships = safeObject(initialData?.relationships);
  const ticketSummary = safeObject(initialData?.ticketSummary);
  const verification = getVerificationSummary(initialData, verificationFlags);
  const names = buildHistoricalNames(initialData, viewer, member);

  return (
    <>
      <div className="info-grid" style={{ marginTop: 14 }}>
        <div className="mini-card">
          <div className="ticket-info-label">Total Tickets</div>
          <div>{safeCount(ticketSummary?.total)}</div>
        </div>

        <div className="mini-card">
          <div className="ticket-info-label">Open / Claimed</div>
          <div>{safeCount(ticketSummary?.open, openTicket ? 1 : 0)}</div>
        </div>

        <div className="mini-card">
          <div className="ticket-info-label">Verification Flags</div>
          <div>{safeCount(verification.flag_count)}</div>
        </div>

        <div className="mini-card">
          <div className="ticket-info-label">Joined Via</div>
          <div>{safeText(entry?.entry_method || entry?.join_source, "Unknown")}</div>
        </div>

        <div className="mini-card">
          <div className="ticket-info-label">Vouches</div>
          <div>{safeCount(relationships?.vouch_count)}</div>
        </div>

        <div className="mini-card">
          <div className="ticket-info-label">Latest VC Status</div>
          <div>{safeText(verification.vc_latest_status)}</div>
        </div>
      </div>

      {names.length > 1 ? (
        <div style={{ marginTop: 14 }}>
          <div className="ticket-info-label" style={{ marginBottom: 8 }}>
            Known Names
          </div>
          <div className="roles">
            {names.map((name) => (
              <span key={name} className="badge">
                {name}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

export function AccountExtraSections({ initialData, member, verificationFlags, viewer }) {
  const entry = safeObject(initialData?.entry);
  const relationships = safeObject(initialData?.relationships);
  const stats = safeObject(initialData?.stats);
  const verification = getVerificationSummary(initialData, verificationFlags);
  const latestVc = getLatestVcSession(initialData);
  const names = buildHistoricalNames(initialData, viewer, member);
  const vouches = safeArray(initialData?.vouches).slice(0, 4);

  return (
    <>
      <div className="card member-section tone-history">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
          <div>
            <h2 style={{ margin: 0 }}>Verification &amp; Activity</h2>
            <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
              Signals tied to your review and support history
            </div>
          </div>
        </div>

        <div className="info-grid">
          <div className="mini-card">
            <div className="ticket-info-label">Dashboard Status</div>
            <div>{verification.status}</div>
          </div>

          <div className="mini-card">
            <div className="ticket-info-label">Flag Count</div>
            <div>{safeCount(verification.flag_count)}</div>
          </div>

          <div className="mini-card">
            <div className="ticket-info-label">Latest Flag</div>
            <div>{formatTime(verification.latest_flag_at)}</div>
          </div>

          <div className="mini-card">
            <div className="ticket-info-label">Latest VC Status</div>
            <div>{safeText(verification.vc_latest_status, safeText(latestVc?.status))}</div>
          </div>

          <div className="mini-card">
            <div className="ticket-info-label">VC Requests</div>
            <div>{safeCount(verification.vc_request_count)}</div>
          </div>

          <div className="mini-card">
            <div className="ticket-info-label">Recent Activity</div>
            <div>{safeCount(stats?.activity_count)}</div>
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <div className="ticket-info-label" style={{ marginBottom: 8 }}>
            Recent Vouches
          </div>
          {vouches.length ? (
            <div className="space">
              {vouches.map((vouch) => (
                <div key={vouch?.id || `${vouch?.actor_id || "vouch"}-${vouch?.created_at || ""}`} className="mini-card">
                  <div className="ticket-info-label">{safeText(vouch?.actor_name || vouch?.actor_id, "Member Vouch")}</div>
                  <div style={{ lineHeight: 1.6 }}>{safeText(vouch?.reason, "No note provided.")}</div>
                  <div className="muted" style={{ marginTop: 8 }}>{formatTime(vouch?.created_at)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: 14 }}>
              No vouch history is visible here yet.
            </div>
          )}
        </div>
      </div>

      <div className="card member-section tone-account">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
          <div>
            <h2 style={{ margin: 0 }}>Name &amp; Join History</h2>
            <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
              What the dashboard currently remembers about you
            </div>
          </div>
        </div>

        <div className="info-grid">
          <div className="mini-card">
            <div className="ticket-info-label">Entry Method</div>
            <div>{safeText(entry?.entry_method || entry?.join_source, "Unknown")}</div>
          </div>

          <div className="mini-card">
            <div className="ticket-info-label">Invited By</div>
            <div>{safeText(entry?.inviter_name || entry?.inviter_id, "Unknown")}</div>
          </div>

          <div className="mini-card">
            <div className="ticket-info-label">Invite Code</div>
            <div>{safeText(entry?.invite_code, entry?.vanity_used ? "Vanity Link" : "Unknown")}</div>
          </div>

          <div className="mini-card">
            <div className="ticket-info-label">Latest Vouch</div>
            <div>{formatTime(relationships?.latest_vouch_at)}</div>
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <div className="ticket-info-label" style={{ marginBottom: 8 }}>
            Known Names
          </div>
          {names.length ? (
            <div className="roles">
              {names.map((name) => (
                <span key={name} className="badge">
                  {name}
                </span>
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: 14 }}>
              No historical name data is visible yet.
            </div>
          )}
        </div>
      </div>
    </>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";

type ServerRow = {
  id: string;
  name: string;
  icon_url?: string | null;
  owner?: boolean;
  can_manage?: boolean;
  bot_installed?: boolean;
  selected?: boolean;
  is_default_env_guild?: boolean;
};

type ServerResponse = {
  ok?: boolean;
  error?: string;
  selectedGuildId?: string;
  servers?: ServerRow[];
  installedCount?: number;
  manageableCount?: number;
};

function normalizeString(value: unknown): string {
  return String(value || "").trim();
}

function getServerInitial(name: string) {
  return normalizeString(name).slice(0, 1).toUpperCase() || "S";
}

function friendlyServerError(raw: unknown): string {
  const text = normalizeString(raw);
  const lower = text.toLowerCase();

  if (!text) return "Failed to load servers. Please try again.";

  if (lower.includes("429") || lower.includes("rate limit") || lower.includes("retry_after")) {
    const retryMatch = text.match(/retry_after["']?\s*[:=]\s*([0-9.]+)/i);
    const retryText = retryMatch?.[1] ? ` Wait about ${Math.ceil(Number(retryMatch[1])) || 1} second and refresh.` : " Wait a moment and refresh.";
    return `Discord is rate limiting the server list right now.${retryText}`;
  }

  if (lower.includes("401") || lower.includes("unauthorized") || lower.includes("session")) {
    return "Your Discord session is not active. Sign in again, then return to Servers.";
  }

  if (lower.includes("403") || lower.includes("forbidden")) {
    return "Discord did not allow this server list request. Make sure you are signed into the right Discord account.";
  }

  return text.length > 180 ? `${text.slice(0, 180)}…` : text;
}

export default function ServerSelector() {
  const [servers, setServers] = useState<ServerRow[]>([]);
  const [selectedGuildId, setSelectedGuildId] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const selectedServer = useMemo(
    () => servers.find((row) => row.id === selectedGuildId || row.selected) || null,
    [servers, selectedGuildId]
  );

  const installedCount = useMemo(
    () => servers.filter((server) => server.bot_installed).length,
    [servers]
  );

  async function loadServers() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/servers", {
        method: "GET",
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });
      const json = (await res.json().catch(() => null)) as ServerResponse | null;
      if (!res.ok || json?.error) throw new Error(json?.error || `Server list request failed with status ${res.status}.`);
      setServers(Array.isArray(json?.servers) ? json.servers : []);
      setSelectedGuildId(normalizeString(json?.selectedGuildId));
    } catch (err) {
      setError(friendlyServerError(err instanceof Error ? err.message : err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadServers();
  }, []);

  async function selectServer(server: ServerRow) {
    if (!server.bot_installed) {
      setError("Dank Shield is not installed in that server yet. Invite the bot there first, then refresh this page.");
      return;
    }
    setSavingId(server.id);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/servers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
        body: JSON.stringify({ guild_id: server.id }),
      });
      const json = (await res.json().catch(() => null)) as ServerResponse | null;
      if (!res.ok || json?.error) throw new Error(json?.error || `Failed to select server. Status ${res.status}.`);
      setSelectedGuildId(server.id);
      setServers((prev) => prev.map((row) => ({ ...row, selected: row.id === server.id })));
      setMessage(`${server.name} is selected. Dashboard tools will now use this server only.`);
    } catch (err) {
      setError(friendlyServerError(err instanceof Error ? err.message : err));
    } finally {
      setSavingId("");
    }
  }

  return (
    <div className="space">
      <div className="card server-flow-card">
        <div className="server-flow-head">
          <div>
            <div className="muted server-eyebrow">Server Context</div>
            <h2 style={{ margin: 0 }}>Available servers</h2>
            <div className="muted server-copy">
              Pick one server before using staff tools. Only servers where your Discord account can manage settings are shown here.
            </div>
          </div>
          <button type="button" className="button ghost server-refresh" onClick={() => void loadServers()} disabled={loading || Boolean(savingId)}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="server-status-strip">
          <div>
            <span className="server-status-label">Selected</span>
            <strong>{selectedServer?.name || "None yet"}</strong>
          </div>
          <div>
            <span className="server-status-label">Manageable</span>
            <strong>{servers.length}</strong>
          </div>
          <div>
            <span className="server-status-label">Bot installed</span>
            <strong>{installedCount}</strong>
          </div>
        </div>

        {selectedServer ? (
          <div className="info-banner server-next-step">
            <div>
              <strong>{selectedServer.name} is active.</strong>
              <div>Next: open the dashboard or set up ticket categories/forms for this server.</div>
            </div>
            <div className="server-next-actions">
              <a className="button primary" href="/">Open Dashboard</a>
              <a className="button ghost" href="/ticket-categories">Manage Categories</a>
              <a className="button ghost" href="/ticket-forms">Manage Forms</a>
            </div>
          </div>
        ) : null}

        {error ? <div className="error-banner server-error" style={{ marginTop: 12 }}>{error}</div> : null}
        {message ? <div className="info-banner" style={{ marginTop: 12 }}>{message}</div> : null}
      </div>

      {loading ? (
        <div className="card muted">Loading your manageable servers...</div>
      ) : servers.length ? (
        <div className="server-grid">
          {servers.map((server) => {
            const installed = Boolean(server.bot_installed);
            const selected = selectedGuildId === server.id || Boolean(server.selected);
            return (
              <div key={server.id} className={`server-card ${selected ? "selected" : ""} ${!installed ? "disabled" : ""}`}>
                <div className="server-main">
                  <div className="server-icon">
                    {server.icon_url ? <img src={server.icon_url} alt="" /> : <span>{getServerInitial(server.name)}</span>}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="server-name">{server.name}</div>
                    <div className="server-meta">
                      {server.owner ? "Owner" : "Manage Server"} • {installed ? "Dank Shield installed" : "Bot not installed"}
                      {server.is_default_env_guild ? " • Default dev server" : ""}
                    </div>
                  </div>
                </div>

                <div className="server-card-footer">
                  <div className={`server-pill ${installed ? "installed" : "missing"}`}>
                    {installed ? "Ready" : "Install needed"}
                  </div>
                  <button
                    type="button"
                    className={selected ? "button ghost" : "button primary"}
                    disabled={!installed || savingId === server.id}
                    onClick={() => void selectServer(server)}
                    style={{ width: "auto", minWidth: 140 }}
                  >
                    {savingId === server.id ? "Selecting..." : selected ? "Selected" : installed ? "Select Server" : "Install Bot First"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card empty-state server-empty-state">
          <strong>No manageable servers found.</strong>
          <span>Make sure you are signed into the right Discord account and have Manage Server or Administrator permission.</span>
          <span>If Discord is rate limiting requests, wait a moment and tap Refresh.</span>
        </div>
      )}

      <style jsx>{`
        .server-flow-card {
          display: grid;
          gap: 14px;
        }
        .server-flow-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 14px;
          flex-wrap: wrap;
        }
        .server-eyebrow {
          margin-bottom: 8px;
          font-size: 12px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          font-weight: 900;
        }
        .server-copy {
          margin-top: 6px;
          line-height: 1.55;
          max-width: 760px;
        }
        .server-refresh {
          width: auto;
          min-width: 130px;
        }
        .server-status-strip {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }
        .server-status-strip > div {
          border: 1px solid rgba(255,255,255,0.14);
          border-radius: 16px;
          padding: 12px;
          background: rgba(255,255,255,0.055);
          min-width: 0;
        }
        .server-status-label {
          display: block;
          color: var(--muted, #c7ddcf);
          font-size: 12px;
          margin-bottom: 4px;
        }
        .server-status-strip strong {
          display: block;
          color: var(--text-strong, #fff);
          overflow-wrap: anywhere;
        }
        .server-error {
          overflow-wrap: anywhere;
          line-height: 1.45;
        }
        .server-next-step {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .server-next-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        .server-next-actions :global(.button) {
          width: auto;
          min-width: 150px;
        }
        .server-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 14px;
        }
        .server-card {
          border: 1px solid rgba(255,255,255,0.14);
          border-radius: 22px;
          padding: 16px;
          background: rgba(255,255,255,0.055);
          display: grid;
          gap: 16px;
        }
        .server-main {
          display: flex;
          gap: 12px;
          align-items: center;
          min-width: 0;
        }
        .server-icon {
          width: 52px;
          height: 52px;
          min-width: 52px;
          border-radius: 18px;
          overflow: hidden;
          display: grid;
          place-items: center;
          background: rgba(93,255,141,0.14);
          color: #e8fff0;
          font-weight: 900;
          font-size: 20px;
        }
        .server-icon img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .server-name {
          font-weight: 900;
          color: var(--text-strong, #fff);
          overflow-wrap: anywhere;
          font-size: 18px;
        }
        .server-meta {
          margin-top: 5px;
          color: var(--muted, #c7ddcf);
          font-size: 13px;
          line-height: 1.4;
        }
        .server-card-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .server-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 34px;
          padding: 7px 11px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 900;
          border: 1px solid rgba(255,255,255,0.14);
        }
        .server-pill.installed {
          color: #e7fff0;
          background: rgba(93,255,141,0.14);
          border-color: rgba(93,255,141,0.28);
        }
        .server-pill.missing {
          color: #fff1c8;
          background: rgba(255,211,107,0.13);
          border-color: rgba(255,211,107,0.26);
        }
        .server-empty-state {
          display: grid;
          gap: 8px;
          text-align: left;
          line-height: 1.45;
        }
        .server-empty-state strong {
          color: var(--text-strong, #fff);
        }
        @media (max-width: 720px) {
          .server-status-strip {
            grid-template-columns: 1fr;
          }
          .server-next-actions,
          .server-next-actions :global(.button),
          .server-card-footer,
          .server-card-footer :global(.button),
          .server-refresh {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}

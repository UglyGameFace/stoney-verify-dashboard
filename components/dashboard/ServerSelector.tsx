"use client";

import { useEffect, useState } from "react";

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

export default function ServerSelector() {
  const [servers, setServers] = useState<ServerRow[]>([]);
  const [selectedGuildId, setSelectedGuildId] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

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
      if (!res.ok || json?.error) throw new Error(json?.error || "Failed to load servers.");
      setServers(Array.isArray(json?.servers) ? json.servers : []);
      setSelectedGuildId(normalizeString(json?.selectedGuildId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load servers.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadServers();
  }, []);

  async function selectServer(server: ServerRow) {
    if (!server.bot_installed) {
      setError("Dank Shield is not installed in that server yet. Invite the bot there first, then refresh.");
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
      if (!res.ok || json?.error) throw new Error(json?.error || "Failed to select server.");
      setSelectedGuildId(server.id);
      setServers((prev) => prev.map((row) => ({ ...row, selected: row.id === server.id })));
      setMessage(`${server.name} is now selected.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to select server.");
    } finally {
      setSavingId("");
    }
  }

  return (
    <div className="space">
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0 }}>Choose a Server</h2>
            <div className="muted" style={{ marginTop: 6, lineHeight: 1.5 }}>
              Pick a server you can manage where Dank Shield is installed. This becomes the dashboard context for tickets, categories, forms, and settings.
            </div>
          </div>
          <button type="button" className="button ghost" onClick={() => void loadServers()} disabled={loading || Boolean(savingId)} style={{ width: "auto" }}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        {error ? <div className="error-banner" style={{ marginTop: 12 }}>{error}</div> : null}
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
                    {server.icon_url ? <img src={server.icon_url} alt="" /> : <span>{server.name.slice(0, 1).toUpperCase()}</span>}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="server-name">{server.name}</div>
                    <div className="server-meta">
                      {server.owner ? "Owner" : "Manage Server"} • {installed ? "Dank Shield installed" : "Bot not installed"}
                      {server.is_default_env_guild ? " • Default dev server" : ""}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className={selected ? "button ghost" : "button primary"}
                  disabled={!installed || savingId === server.id}
                  onClick={() => void selectServer(server)}
                  style={{ width: "auto", minWidth: 140 }}
                >
                  {savingId === server.id ? "Selecting..." : selected ? "Selected" : installed ? "Select" : "Install Bot First"}
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card empty-state">
          No manageable servers were found. Make sure you are signed into the right Discord account and have Manage Server or Administrator permission.
        </div>
      )}

      <style jsx>{`
        .server-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 14px;
        }
        .server-card {
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 20px;
          padding: 14px;
          background: rgba(255,255,255,0.035);
          display: grid;
          gap: 14px;
        }
        .server-card.selected {
          border-color: rgba(93,255,141,0.34);
          box-shadow: 0 0 0 1px rgba(93,255,141,0.12) inset;
        }
        .server-card.disabled {
          opacity: 0.72;
        }
        .server-main {
          display: flex;
          gap: 12px;
          align-items: center;
          min-width: 0;
        }
        .server-icon {
          width: 48px;
          height: 48px;
          min-width: 48px;
          border-radius: 16px;
          overflow: hidden;
          display: grid;
          place-items: center;
          background: rgba(93,255,141,0.10);
          color: #d9ffe6;
          font-weight: 900;
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
        }
        .server-meta {
          margin-top: 4px;
          color: var(--muted, #9fb0c3);
          font-size: 12px;
          line-height: 1.35;
        }
      `}</style>
    </div>
  );
}

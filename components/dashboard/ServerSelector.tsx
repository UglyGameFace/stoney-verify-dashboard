"use client";

import { useEffect, useMemo, useState } from "react";

type BotInstallState = "installed" | "missing" | "unknown";

type ServerRow = {
  id: string;
  name: string;
  icon_url?: string | null;
  owner?: boolean;
  bot_installed?: boolean;
  bot_install_state?: BotInstallState | string | null;
  bot_check_error?: string | null;
  bot_invite_url?: string | null;
  selected?: boolean;
  is_default_env_guild?: boolean;
};

type ServerResponse = {
  error?: string;
  selectedGuildId?: string;
  servers?: ServerRow[];
  botCheckOk?: boolean;
  botCheckError?: string | null;
};

function text(value: unknown): string {
  return String(value || "").trim();
}

function getServerInitial(name: string): string {
  return text(name).slice(0, 1).toUpperCase() || "S";
}

function getInstallState(server: ServerRow): BotInstallState {
  if (server.bot_installed) return "installed";
  const value = text(server.bot_install_state).toLowerCase();
  if (value === "installed") return "installed";
  if (value === "unknown") return "unknown";
  return "missing";
}

function getInstallMeta(server: ServerRow): string {
  const state = getInstallState(server);
  if (state === "installed") return "Dank Shield installed";
  if (state === "unknown") return "Bot status check temporarily blocked";
  return "Dank Shield not installed";
}

function getInstallLabel(server: ServerRow): string {
  const state = getInstallState(server);
  if (state === "installed") return "Ready";
  if (state === "unknown") return "Check blocked";
  return "Invite needed";
}

function friendlyServerError(raw: unknown): string {
  const value = text(raw);
  const lower = value.toLowerCase();

  if (!value) return "Failed to load servers. Please try again.";
  if (lower.includes("429") || lower.includes("rate limit") || lower.includes("retry_after")) {
    return "Discord is rate limiting one of the live checks right now. Confirmed installed servers remain usable.";
  }
  if (lower.includes("401") || lower.includes("unauthorized") || lower.includes("session") || lower.includes("login")) {
    return "One live Discord check could not use the current session, but confirmed installed servers remain usable.";
  }
  if (lower.includes("403") || lower.includes("forbidden")) {
    return "Discord blocked one live check. Confirmed installed servers remain usable.";
  }

  return value.length > 180 ? `${value.slice(0, 180)}…` : value;
}

export default function ServerSelector() {
  const [servers, setServers] = useState<ServerRow[]>([]);
  const [selectedGuildId, setSelectedGuildId] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [botCheckError, setBotCheckError] = useState("");

  const selectedServer = useMemo(
    () => servers.find((row) => row.id === selectedGuildId || row.selected) || null,
    [servers, selectedGuildId]
  );

  const installedCount = useMemo(
    () => servers.filter((server) => getInstallState(server) === "installed").length,
    [servers]
  );

  const unresolvedCount = useMemo(
    () => servers.filter((server) => getInstallState(server) !== "installed").length,
    [servers]
  );

  const showBotCheckWarning = Boolean(botCheckError && !loading && (!servers.length || unresolvedCount > 0));

  async function loadServers() {
    setLoading(true);
    setError("");
    setMessage("");
    setBotCheckError("");

    try {
      const res = await fetch("/api/servers", {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Cache-Control": "no-store", Pragma: "no-cache" },
      });
      const json = (await res.json().catch(() => null)) as ServerResponse | null;
      if (!res.ok || json?.error) throw new Error(json?.error || `Server list request failed with status ${res.status}.`);

      const nextServers = Array.isArray(json?.servers) ? json.servers : [];
      setServers(nextServers);
      setSelectedGuildId(text(json?.selectedGuildId));

      const nextUnresolvedCount = nextServers.filter((server) => getInstallState(server) !== "installed").length;
      setBotCheckError(nextUnresolvedCount > 0 ? text(json?.botCheckError) : "");
    } catch (err) {
      setError(friendlyServerError(err instanceof Error ? err.message : err));
      setBotCheckError("");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadServers();
  }, []);

  async function selectServer(server: ServerRow) {
    const installState = getInstallState(server);

    if (installState !== "installed") {
      if (installState === "unknown") {
        setError("Bot status could not be verified right now. Wait a moment and tap Refresh/Recheck so a temporary Discord failure does not mislabel an installed server.");
        return;
      }

      const inviteUrl = text(server.bot_invite_url);
      if (inviteUrl) {
        window.location.href = inviteUrl;
        return;
      }

      setError("Dank Shield is not installed in that server yet. Invite the bot there first, then refresh this page.");
      return;
    }

    setSavingId(server.id);
    setError("");
    setMessage("");
    setBotCheckError("");

    try {
      const res = await fetch("/api/servers", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          Pragma: "no-cache",
        },
        body: JSON.stringify({ guild_id: server.id }),
      });
      const json = (await res.json().catch(() => null)) as (ServerResponse & { bot_invite_url?: string | null }) | null;

      if (!res.ok || json?.error) {
        const inviteUrl = text(json?.bot_invite_url);
        if (inviteUrl) {
          window.location.href = inviteUrl;
          return;
        }
        throw new Error(json?.error || `Failed to select server. Status ${res.status}.`);
      }

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
              Select the server Dank Shield should manage. Servers with confirmed bot access become selectable; temporary Discord check failures show a recheck action instead of a false install warning.
            </div>
          </div>
          <button type="button" className="button ghost server-refresh" onClick={() => void loadServers()} disabled={loading || Boolean(savingId)}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="server-status-strip">
          <div><span className="server-status-label">Selected</span><strong>{selectedServer?.name || "None yet"}</strong></div>
          <div><span className="server-status-label">Manageable</span><strong>{servers.length}</strong></div>
          <div><span className="server-status-label">Ready servers</span><strong>{installedCount}</strong></div>
        </div>

        {showBotCheckWarning ? (
          <div className="info-banner server-warning" style={{ marginTop: 12 }}>
            Bot install check warning: {friendlyServerError(botCheckError)}
          </div>
        ) : null}

        {selectedServer ? (
          <div className="info-banner server-next-step">
            <div><strong>{selectedServer.name} is active.</strong><div>Next: open the dashboard or set up ticket categories/forms for this server.</div></div>
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
            const installState = getInstallState(server);
            const installed = installState === "installed";
            const unknown = installState === "unknown";
            const selected = selectedGuildId === server.id || Boolean(server.selected);
            const inviteUrl = text(server.bot_invite_url);

            return (
              <div key={server.id} className={`server-card ${selected ? "selected" : ""} ${installed ? "" : "needs-install"}`}>
                <div className="server-main">
                  <div className="server-icon">{server.icon_url ? <img src={server.icon_url} alt="" /> : <span>{getServerInitial(server.name)}</span>}</div>
                  <div style={{ minWidth: 0 }}>
                    <div className="server-name">{server.name}</div>
                    <div className="server-meta">
                      {server.owner ? "Owner" : "Manage Server"} • {getInstallMeta(server)}{server.is_default_env_guild ? " • Default server" : ""}
                    </div>
                    {unknown && server.bot_check_error ? <div className="server-subtle-warning">{friendlyServerError(server.bot_check_error)}</div> : null}
                  </div>
                </div>

                <div className="server-card-footer">
                  <div className={`server-pill ${installed ? "installed" : unknown ? "unknown" : "missing"}`}>{getInstallLabel(server)}</div>
                  {installed ? (
                    <button type="button" className={selected ? "button ghost" : "button primary"} disabled={savingId === server.id} onClick={() => void selectServer(server)} style={{ width: "auto", minWidth: 140 }}>
                      {savingId === server.id ? "Selecting..." : selected ? "Selected" : "Select Server"}
                    </button>
                  ) : unknown ? (
                    <button type="button" className="button ghost" onClick={() => void loadServers()} style={{ width: "auto", minWidth: 140 }}>Recheck</button>
                  ) : inviteUrl ? (
                    <a className="button primary" href={inviteUrl} style={{ width: "auto", minWidth: 140 }}>Invite Bot</a>
                  ) : (
                    <button type="button" className="button ghost" onClick={() => void loadServers()} style={{ width: "auto", minWidth: 140 }}>Recheck</button>
                  )}
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
        .server-flow-card { display: grid; gap: 14px; }
        .server-flow-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; flex-wrap: wrap; }
        .server-eyebrow { margin-bottom: 8px; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 900; }
        .server-copy { margin-top: 6px; line-height: 1.55; max-width: 760px; }
        .server-refresh { width: auto; min-width: 130px; }
        .server-status-strip { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
        .server-status-strip > div { border: 1px solid rgba(255,255,255,0.14); border-radius: 16px; padding: 12px; background: rgba(255,255,255,0.055); min-width: 0; }
        .server-status-label { display: block; color: var(--muted, #c7ddcf); font-size: 12px; margin-bottom: 4px; }
        .server-status-strip strong { display: block; color: var(--text-strong, #fff); overflow-wrap: anywhere; }
        .server-error, .server-warning { overflow-wrap: anywhere; line-height: 1.45; }
        .server-next-step { display: flex; justify-content: space-between; align-items: center; gap: 14px; flex-wrap: wrap; }
        .server-next-actions { display: flex; gap: 10px; flex-wrap: wrap; }
        .server-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; }
        .server-card { border: 1px solid rgba(255,255,255,0.14); border-radius: 22px; padding: 18px; background: rgba(2, 8, 18, 0.78); display: grid; gap: 16px; }
        .server-card.selected { border-color: rgba(54, 211, 153, 0.72); box-shadow: 0 0 0 1px rgba(54, 211, 153, 0.18), 0 18px 44px rgba(0,0,0,0.24); }
        .server-main { display: flex; gap: 14px; align-items: flex-start; min-width: 0; }
        .server-icon { width: 54px; height: 54px; min-width: 54px; border-radius: 16px; overflow: hidden; background: rgba(54, 211, 153, 0.1); display: grid; place-items: center; font-weight: 900; color: #e8fff2; }
        .server-icon img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .server-name { font-weight: 900; color: var(--text-strong, #fff); font-size: 20px; line-height: 1.2; overflow-wrap: anywhere; }
        .server-meta { margin-top: 5px; color: var(--muted, #c7ddcf); line-height: 1.4; overflow-wrap: anywhere; }
        .server-subtle-warning { margin-top: 8px; color: #ffd7a5; font-size: 13px; line-height: 1.35; overflow-wrap: anywhere; }
        .server-card-footer { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
        .server-pill { font-weight: 850; color: var(--text-strong, #fff); }
        .server-pill.installed { color: #d9ffee; }
        .server-pill.unknown { color: #ffe3b3; }
        .server-pill.missing { color: #ffd3d3; }
        .server-empty-state { display: grid; gap: 8px; text-align: center; line-height: 1.35; }
        @media (max-width: 760px) { .server-status-strip { grid-template-columns: 1fr; } .server-next-actions, .server-next-actions .button { width: 100%; } }
      `}</style>
    </div>
  );
}

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
  error_code?: string;
  selectedGuildId?: string;
  servers?: ServerRow[];
  botCheckOk?: boolean;
  botCheckError?: string | null;
};

function text(value: unknown): string {
  return String(value || "").trim();
}

function dashboardHref(guildId: string): string {
  return `/dashboard/${encodeURIComponent(text(guildId))}`;
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

function friendlyServerError(raw: unknown, hasVisibleServers = false): string {
  const value = text(raw);
  const lower = value.toLowerCase();

  if (!value) return "Failed to load servers. Please try again.";

  if (!hasVisibleServers) {
    if (lower.includes("429") || lower.includes("rate limit") || lower.includes("retry_after")) {
      return "Discord is rate limiting the server list right now. Wait a moment, then tap Refresh.";
    }
    if (lower.includes("401") || lower.includes("unauthorized") || lower.includes("session") || lower.includes("login") || lower.includes("oauth")) {
      return "The dashboard could not load your Discord server list with the current login. Open Account → Reset Login once, then sign in again.";
    }
    if (lower.includes("403") || lower.includes("forbidden")) {
      return "Discord blocked the server list request. Make sure this Discord account can manage the server, then refresh.";
    }
    if (lower.includes("bot token") || lower.includes("bot credential")) {
      return "The bot install check needs attention, but the dashboard also could not load your manageable server list yet.";
    }
  }

  if (lower.includes("429") || lower.includes("rate limit") || lower.includes("retry_after")) {
    return "Discord is rate limiting one live check. Already listed servers remain usable.";
  }
  if (lower.includes("bot token") || lower.includes("bot credential")) {
    return "The bot install check needs attention. Already confirmed installed servers remain selectable.";
  }
  if (lower.includes("401") || lower.includes("unauthorized") || lower.includes("session") || lower.includes("login") || lower.includes("oauth")) {
    return "One live Discord check could not use the current session. Already listed servers remain usable.";
  }
  if (lower.includes("403") || lower.includes("forbidden")) {
    return "Discord blocked one live check. Already listed servers remain usable.";
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

  const selectedDashboardHref = selectedGuildId ? dashboardHref(selectedGuildId) : selectedServer?.id ? dashboardHref(selectedServer.id) : "/";

  const installedCount = useMemo(
    () => servers.filter((server) => getInstallState(server) === "installed").length,
    [servers]
  );

  const unresolvedServers = useMemo(
    () => servers.filter((server) => getInstallState(server) !== "installed"),
    [servers]
  );

  const unresolvedCount = unresolvedServers.length;
  const allVisibleServersReady = servers.length > 0 && unresolvedCount === 0;
  const unresolvedError = unresolvedServers.map((server) => text(server.bot_check_error)).find(Boolean) || botCheckError;
  const showBotCheckWarning = Boolean(unresolvedError && !loading && servers.length > 0 && !allVisibleServersReady && unresolvedCount > 0);

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
      const nextSelectedGuildId = text(json?.selectedGuildId);
      const nextUnresolvedServers = nextServers.filter((server) => getInstallState(server) !== "installed");
      const nextUnresolvedError = nextUnresolvedServers.map((server) => text(server.bot_check_error)).find(Boolean) || text(json?.botCheckError);

      setServers(nextServers);
      setSelectedGuildId(nextSelectedGuildId);
      setBotCheckError(nextUnresolvedServers.length > 0 ? nextUnresolvedError : "");
    } catch (err) {
      setError(friendlyServerError(err instanceof Error ? err.message : err, servers.length > 0));
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
      setMessage(`${server.name} is selected. Opening this server dashboard...`);
      window.location.href = dashboardHref(server.id);
    } catch (err) {
      setError(friendlyServerError(err instanceof Error ? err.message : err, servers.length > 0));
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
            Bot install check warning: {friendlyServerError(unresolvedError, servers.length > 0)}
          </div>
        ) : null}

        {selectedServer ? (
          <div className="info-banner server-next-step">
            <div><strong>{selectedServer.name} is active.</strong><div>Next: open this server dashboard or set up ticket categories/forms for this server.</div></div>
            <div className="server-next-actions">
              <a className="button primary" href={selectedDashboardHref}>Open Dashboard</a>
              <a className="button ghost" href={`${selectedDashboardHref}/categories`}>Manage Categories</a>
              <a className="button ghost" href={`${selectedDashboardHref}/forms`}>Manage Forms</a>
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
                    {unknown && server.bot_check_error ? <div className="server-subtle-warning">{friendlyServerError(server.bot_check_error, servers.length > 0)}</div> : null}
                  </div>
                </div>

                <div className="server-card-footer">
                  <div className={`server-pill ${installed ? "installed" : unknown ? "unknown" : "missing"}`}>{getInstallLabel(server)}</div>
                  {installed ? (
                    <button type="button" className={selected ? "button ghost" : "button primary"} disabled={savingId === server.id} onClick={() => void selectServer(server)} style={{ width: "auto", minWidth: 140 }}>
                      {savingId === server.id ? "Opening..." : selected ? "Open Server" : "Manage Server"}
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
          <span>The server list did not load any Discord servers for this login.</span>
          <span>Use Account → Reset Login once, sign in again, then tap Refresh. If this repeats, the Discord server-list API is rejecting or rate-limiting the request.</span>
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
        .server-card { border: 1px solid rgba(255,255,255,0.14); border-radius: 22px; padding: 18px; background: rgba(2, 8, 18, 0.78); display: grid; gap: 16px; box-shadow: 0 16px 36px rgba(0,0,0,0.22); }
        .server-card.selected { border-color: rgba(74, 222, 128, 0.75); box-shadow: 0 0 0 1px rgba(74, 222, 128, 0.25), 0 16px 42px rgba(34,197,94,0.16); }
        .server-main { display: flex; gap: 12px; align-items: flex-start; min-width: 0; }
        .server-icon { width: 58px; height: 58px; flex: 0 0 58px; border-radius: 18px; display: grid; place-items: center; background: rgba(34,197,94,0.12); color: #dfffea; font-weight: 950; overflow: hidden; }
        .server-icon img { width: 100%; height: 100%; object-fit: cover; }
        .server-name { font-weight: 950; font-size: 20px; color: var(--text-strong, #fff); overflow-wrap: anywhere; line-height: 1.1; }
        .server-meta { margin-top: 6px; color: var(--muted, #c7ddcf); line-height: 1.35; }
        .server-subtle-warning { margin-top: 8px; color: #ffd6a3; font-size: 13px; line-height: 1.35; }
        .server-card-footer { display: flex; justify-content: space-between; gap: 12px; align-items: center; flex-wrap: wrap; }
        .server-pill { font-weight: 900; color: #fff; }
        .server-pill.installed { color: #dfffea; }
        .server-pill.unknown { color: #ffd6a3; }
        .server-pill.missing { color: #ffd2d2; }
        .empty-state { display: grid; gap: 6px; text-align: center; }
        @media (max-width: 720px) {
          .server-status-strip { grid-template-columns: 1fr; }
          .server-next-actions, .server-next-actions .button { width: 100%; }
          .server-card-footer .button { flex: 1; }
        }
      `}</style>
    </div>
  );
}

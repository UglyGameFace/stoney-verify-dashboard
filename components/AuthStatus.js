"use client";

import { useEffect, useMemo, useState } from "react";

function getAvatarUrl(session) {
  return (
    session?.user?.avatar ||
    session?.user?.avatar_url ||
    session?.user?.image ||
    session?.user?.picture ||
    session?.avatar ||
    session?.avatar_url ||
    ""
  );
}

function getUsername(session) {
  return (
    session?.user?.global_name ||
    session?.user?.display_name ||
    session?.user?.username ||
    session?.username ||
    "User"
  );
}

function getAvatarAlt(session) {
  return `${getUsername(session)} avatar`;
}

export default function AuthStatus() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const json = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(json?.error || "Failed to load session.");
        }

        if (mounted) {
          setSession(json?.session || null);
        }
      } catch (err) {
        if (mounted) {
          setError(err?.message || "Failed to load session.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadSession();

    return () => {
      mounted = false;
    };
  }, []);

  const avatarUrl = useMemo(() => getAvatarUrl(session), [session]);
  const username = useMemo(() => getUsername(session), [session]);

  if (loading) {
    return <div className="loading-state">Checking session...</div>;
  }

  if (error) {
    return <div className="error-banner">{error}</div>;
  }

  if (!session) {
    return (
      <div className="auth-status-card">
        <div className="space" style={{ gap: 10 }}>
          <div>
            <div style={{ fontWeight: 800, marginBottom: 4 }}>Staff Login</div>
            <div className="muted" style={{ fontSize: 13 }}>
              Sign in with Discord to access staff actions and live moderation tools.
            </div>
          </div>

          <a className="button primary" href="/api/auth/login">
            Login with Discord
          </a>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="auth-status-card compact">
        <div className="auth-status-row">
          <div className="auth-user-block">
            <div className="auth-avatar">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={getAvatarAlt(session)}
                  width="44"
                  height="44"
                />
              ) : (
                <div className="auth-avatar-fallback" aria-hidden="true" />
              )}
            </div>

            <div className="auth-user-copy">
              <div className="auth-username">{username}</div>
              <div className="muted auth-subline">
                {session?.isStaff ? "Staff access active" : "View-only session"}
              </div>
            </div>
          </div>

          <a className="button ghost auth-status-logout" href="/api/auth/logout">
            Logout
          </a>
        </div>
      </div>

      <style jsx>{`
        .auth-status-card.compact {
          padding: 0;
          background: transparent;
          border: 0;
          box-shadow: none;
        }

        .auth-status-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }

        .auth-user-block {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
          flex: 1;
        }

        .auth-avatar {
          width: 44px;
          height: 44px;
          min-width: 44px;
          border-radius: 999px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.04);
          box-shadow: 0 0 14px rgba(99, 213, 255, 0.12);
        }

        .auth-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .auth-avatar-fallback {
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, #68f5bf 0%, #63d5ff 100%);
        }

        .auth-user-copy {
          min-width: 0;
          flex: 1;
        }

        .auth-username {
          font-weight: 900;
          font-size: 15px;
          line-height: 1.1;
          color: var(--text-strong, #f8fafc);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .auth-subline {
          margin-top: 4px;
          font-size: 13px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .auth-status-logout {
          min-width: 120px;
          text-align: center;
          text-decoration: none;
        }
      `}</style>
    </>
  );
}

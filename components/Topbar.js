"use client";

import { useEffect, useMemo, useState } from "react";
import AuthStatus from "@/components/AuthStatus";

function getHeaderContent(session) {
  if (session?.isStaff) {
    return {
      eyebrow: "Stoney Balonney control room",
      title: "Stoney Verify Dashboard",
      description:
        "Green-room command for tickets, joins, verification flow, role sync, fraud checks, and staff actions.",
      badge: "Staff Console",
      tone: "staff",
    };
  }

  return {
    eyebrow: "Member support portal",
    title: "My Dashboard",
    description:
      "Track your verification status, support progress, and ticket history without staff-only controls.",
    badge: "Member View",
    tone: "member",
  };
}

function getDisplayName(session) {
  return (
    session?.user?.username ||
    session?.discordUser?.username ||
    session?.user?.name ||
    "User"
  );
}

function getAvatar(session) {
  return session?.user?.avatar || session?.discordUser?.avatar || "";
}

export default function Topbar() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      try {
        const res = await fetch("/api/auth/me", {
          cache: "no-store",
        });

        const json = await res.json().catch(() => null);

        if (!mounted) return;

        if (res.ok) {
          setSession(json?.session || null);
        } else {
          setSession(null);
        }
      } catch {
        if (!mounted) return;
        setSession(null);
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

  const content = useMemo(() => getHeaderContent(session), [session]);
  const displayName = getDisplayName(session);
  const avatar = getAvatar(session);
  const initial = String(displayName || "?").slice(0, 1).toUpperCase();

  return (
    <div
      className={`card stoner-topbar topbar-shell ${content.tone}`}
      style={{ marginBottom: 18 }}
    >
      <div className="topbar-glow topbar-glow-a" />
      <div className="topbar-glow topbar-glow-b" />

      <div
        className="row"
        style={{
          justifyContent: "space-between",
          alignItems: "stretch",
          flexWrap: "wrap",
          gap: 16,
          position: "relative",
          zIndex: 1,
        }}
      >
        <div className="topbar-copy">
          <div className="topbar-meta-row">
            <div className="muted topbar-eyebrow">
              {loading ? "Loading dashboard..." : content.eyebrow}
            </div>

            <span className={`topbar-badge ${content.tone}`}>
              {loading ? "Checking Session" : content.badge}
            </span>
          </div>

          <h1 className="topbar-title">
            {loading ? "Dashboard" : content.title}
          </h1>

          <div className="muted topbar-description">
            {loading
              ? "Loading your session and dashboard view..."
              : content.description}
          </div>

          {!loading && session ? (
            <div className="topbar-presence">
              <div className="topbar-presence-user">
                {avatar ? (
                  <div className="topbar-avatar">
                    <img
                      src={avatar}
                      alt={`${displayName} avatar`}
                      width="44"
                      height="44"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                  </div>
                ) : (
                  <div className="topbar-avatar fallback">{initial}</div>
                )}

                <div className="topbar-presence-copy">
                  <div className="topbar-presence-name">{displayName}</div>
                  <div className="muted topbar-presence-subline">
                    {session?.isStaff
                      ? "Staff tools and moderation controls available"
                      : "Personal support, verification, and ticket tracking"}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="topbar-auth-wrap">
          <AuthStatus />
        </div>
      </div>

      <style jsx>{`
        .topbar-shell {
          position: relative;
          overflow: hidden;
          border-radius: 28px;
          padding: 22px;
          border: 1px solid rgba(110, 150, 255, 0.16);
          background:
            radial-gradient(circle at top right, rgba(74, 222, 128, 0.08), transparent 36%),
            radial-gradient(circle at bottom left, rgba(96, 165, 250, 0.08), transparent 34%),
            linear-gradient(180deg, rgba(19, 32, 62, 0.96), rgba(13, 23, 45, 0.94));
          box-shadow:
            0 10px 30px rgba(0, 0, 0, 0.28),
            inset 0 1px 0 rgba(255, 255, 255, 0.04);
        }

        .topbar-shell.staff {
          border-color: rgba(95, 143, 255, 0.22);
        }

        .topbar-shell.member {
          border-color: rgba(92, 214, 165, 0.22);
        }

        .topbar-glow {
          position: absolute;
          border-radius: 999px;
          filter: blur(42px);
          opacity: 0.5;
          pointer-events: none;
        }

        .topbar-glow-a {
          width: 220px;
          height: 220px;
          right: -60px;
          top: -70px;
          background: rgba(96, 165, 250, 0.18);
        }

        .topbar-glow-b {
          width: 180px;
          height: 180px;
          left: -40px;
          bottom: -70px;
          background: rgba(74, 222, 128, 0.14);
        }

        .topbar-copy {
          min-width: 0;
          flex: 1 1 460px;
        }

        .topbar-auth-wrap {
          width: 100%;
          max-width: 360px;
          display: flex;
          align-items: stretch;
        }

        .topbar-meta-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 10px;
        }

        .topbar-eyebrow {
          font-size: 14px;
          letter-spacing: 0.01em;
        }

        .topbar-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 32px;
          padding: 7px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.02em;
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: rgba(241, 245, 249, 0.95);
          background: rgba(255, 255, 255, 0.04);
          backdrop-filter: blur(8px);
        }

        .topbar-badge.staff {
          border-color: rgba(96, 165, 250, 0.22);
          background: rgba(96, 165, 250, 0.1);
        }

        .topbar-badge.member {
          border-color: rgba(74, 222, 128, 0.22);
          background: rgba(74, 222, 128, 0.1);
        }

        .topbar-title {
          margin: 0;
          font-size: clamp(34px, 6vw, 52px);
          line-height: 0.98;
          letter-spacing: -0.04em;
          color: var(--text-strong, #f8fafc);
          text-wrap: balance;
        }

        .topbar-description {
          margin-top: 12px;
          max-width: 780px;
          line-height: 1.5;
          font-size: 15px;
        }

        .topbar-presence {
          margin-top: 18px;
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }

        .topbar-presence-user {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
          padding: 10px 12px;
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.035);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
        }

        .topbar-avatar {
          width: 44px;
          height: 44px;
          min-width: 44px;
          border-radius: 999px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.06);
        }

        .topbar-avatar.fallback {
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          color: #08111f;
          background: linear-gradient(135deg, #7cf29e, #7db7ff);
        }

        .topbar-presence-copy {
          min-width: 0;
        }

        .topbar-presence-name {
          font-size: 15px;
          font-weight: 800;
          color: var(--text-strong, #f8fafc);
          line-height: 1.15;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 320px;
        }

        .topbar-presence-subline {
          margin-top: 3px;
          font-size: 13px;
          line-height: 1.35;
        }

        @media (max-width: 767px) {
          .topbar-shell {
            padding: 18px;
            border-radius: 24px;
          }

          .topbar-auth-wrap {
            max-width: none;
          }

          .topbar-title {
            font-size: 30px;
          }

          .topbar-description {
            font-size: 14px;
          }

          .topbar-presence-name {
            max-width: 180px;
          }
        }
      `}</style>
    </div>
  );
}

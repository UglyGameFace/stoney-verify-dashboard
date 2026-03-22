"use client";

import { useEffect, useMemo, useState } from "react";
import AuthStatus from "@/components/AuthStatus";

function getHeaderContent(session) {
  if (session?.isStaff) {
    return {
      eyebrow: "Stoney Balonney command cloud",
      title: "Stoney Verify Dashboard",
      description:
        "Run the verification pipeline, ticket pressure, role sync, fraud watch, and live moderation from one glowing control room.",
      badge: "Staff Command",
      tone: "staff",
      accent: "green-blue",
    };
  }

  return {
    eyebrow: "Member smoke lounge",
    title: "My Dashboard",
    description:
      "Track verification, support, ticket progress, and next steps in one clean portal built for quick mobile use.",
    badge: "Member View",
    tone: "member",
    accent: "green-purple",
  };
}

function getOrbClass(accent) {
  if (accent === "green-purple") return "orb orb-member";
  return "orb orb-staff";
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
  const orbClass = getOrbClass(content.accent);

  return (
    <div
      className={`card stoner-topbar topbar-shell ${content.tone}`}
      style={{ marginBottom: 18 }}
    >
      <div className={`topbar-mist topbar-mist-a ${content.tone}`} />
      <div className={`topbar-mist topbar-mist-b ${content.tone}`} />
      <div className={`topbar-mist topbar-mist-c ${content.tone}`} />

      <div
        className="row topbar-row"
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
            <div className="topbar-eyebrow-wrap">
              <span className={orbClass} />
              <div className="muted topbar-eyebrow">
                {loading ? "Booting dashboard..." : content.eyebrow}
              </div>
            </div>

            <span className={`topbar-badge ${content.tone}`}>
              {loading ? "Checking Session" : content.badge}
            </span>
          </div>

          <h1 className="topbar-title neon-title">
            {loading ? "Dashboard" : content.title}
          </h1>

          <div className="muted topbar-description">
            {loading ? "Loading your dashboard..." : content.description}
          </div>

          <div className="topbar-chip-row">
            <span className="topbar-chip">
              One-hand mobile
            </span>
            <span className="topbar-chip">
              Live ticket control
            </span>
            <span className="topbar-chip">
              Verification command flow
            </span>
          </div>
        </div>

        <div className="topbar-auth-wrap">
          <AuthStatus />
        </div>
      </div>

      <style jsx>{`
        .topbar-shell {
          position: relative;
          overflow: hidden;
          border-radius: 30px;
          padding: 22px;
          border: 1px solid rgba(130, 255, 184, 0.14);
          background:
            radial-gradient(circle at top right, rgba(93, 255, 141, 0.08), transparent 28%),
            radial-gradient(circle at bottom left, rgba(99, 213, 255, 0.08), transparent 24%),
            linear-gradient(180deg, rgba(16, 28, 38, 0.95), rgba(7, 14, 24, 0.95));
          box-shadow:
            var(--shadow-strong),
            var(--glow-green);
        }

        .topbar-shell.member {
          box-shadow:
            var(--shadow-strong),
            var(--glow-purple);
        }

        .topbar-row {
          min-width: 0;
        }

        .topbar-mist {
          position: absolute;
          border-radius: 999px;
          filter: blur(54px);
          opacity: 0.48;
          pointer-events: none;
          mix-blend-mode: screen;
        }

        .topbar-mist-a {
          width: 260px;
          height: 260px;
          right: -60px;
          top: -80px;
        }

        .topbar-mist-b {
          width: 190px;
          height: 190px;
          left: -30px;
          bottom: -60px;
        }

        .topbar-mist-c {
          width: 160px;
          height: 160px;
          right: 34%;
          top: 24%;
          opacity: 0.22;
        }

        .topbar-mist.staff {
          background: rgba(99, 213, 255, 0.18);
        }

        .topbar-mist.member {
          background: rgba(178, 109, 255, 0.18);
        }

        .topbar-copy {
          min-width: 0;
          flex: 1 1 520px;
        }

        .topbar-auth-wrap {
          width: 100%;
          max-width: 380px;
          display: flex;
          align-items: stretch;
        }

        .topbar-meta-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 12px;
        }

        .topbar-eyebrow-wrap {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .topbar-eyebrow {
          font-size: 14px;
          letter-spacing: 0.02em;
        }

        .orb {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          flex: 0 0 10px;
        }

        .orb-staff {
          background: linear-gradient(135deg, var(--accent), var(--blue));
          box-shadow:
            0 0 12px rgba(93, 255, 141, 0.42),
            0 0 18px rgba(99, 213, 255, 0.28);
        }

        .orb-member {
          background: linear-gradient(135deg, var(--accent), var(--purple));
          box-shadow:
            0 0 12px rgba(93, 255, 141, 0.3),
            0 0 18px rgba(178, 109, 255, 0.28);
        }

        .topbar-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 34px;
          padding: 8px 13px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: rgba(248, 250, 252, 0.96);
          background: rgba(255, 255, 255, 0.04);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }

        .topbar-badge.staff {
          border-color: rgba(99, 213, 255, 0.24);
          background: rgba(99, 213, 255, 0.12);
          box-shadow: 0 0 18px rgba(99, 213, 255, 0.12);
        }

        .topbar-badge.member {
          border-color: rgba(178, 109, 255, 0.24);
          background: rgba(178, 109, 255, 0.12);
          box-shadow: 0 0 18px rgba(178, 109, 255, 0.12);
        }

        .topbar-title {
          margin: 0;
          max-width: 900px;
          text-wrap: balance;
        }

        .topbar-description {
          margin-top: 12px;
          max-width: 860px;
          line-height: 1.6;
          font-size: 15px;
        }

        .topbar-chip-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 16px;
        }

        .topbar-chip {
          display: inline-flex;
          align-items: center;
          min-height: 30px;
          padding: 7px 11px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          color: var(--text);
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.035);
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
            font-size: 30px !important;
          }

          .topbar-description {
            font-size: 14px;
            line-height: 1.52;
          }

          .topbar-chip-row {
            gap: 7px;
          }

          .topbar-chip {
            min-height: 28px;
            padding: 6px 10px;
            font-size: 11px;
          }
        }
      `}</style>
    </div>
  );
}

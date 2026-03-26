"use client";

import { useEffect, useMemo, useState } from "react";
import AuthStatus from "@/components/AuthStatus";

function getHeaderContent(session) {
  if (session?.isStaff) {
    return {
      eyebrow: "Staff control room",
      title: "Stoney Verify",
      description:
        "Verification, tickets, moderation, and live staff actions in one place.",
      badge: "Staff",
      tone: "staff",
      accent: "green-blue",
    };
  }

  return {
    eyebrow: "Member portal",
    title: "My Dashboard",
    description: "Your verification status, support access, and current ticket.",
    badge: "Member",
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
      style={{ marginBottom: 16 }}
    >
      <div className={`topbar-mist topbar-mist-a ${content.tone}`} />
      <div className={`topbar-mist topbar-mist-b ${content.tone}`} />

      <div className="topbar-grid">
        <div className="topbar-copy">
          <div className="topbar-meta-row">
            <div className="topbar-eyebrow-wrap">
              <span className={orbClass} />
              <div className="muted topbar-eyebrow">
                {loading ? "Loading session..." : content.eyebrow}
              </div>
            </div>

            <span className={`topbar-badge ${content.tone}`}>
              {loading ? "Loading" : content.badge}
            </span>
          </div>

          <h1 className="topbar-title">
            {loading ? "Dashboard" : content.title}
          </h1>

          <div className="muted topbar-description">
            {loading ? "Getting your dashboard ready..." : content.description}
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
          border-radius: 24px;
          padding: 16px;
          border: 1px solid rgba(130, 255, 184, 0.12);
          background:
            radial-gradient(circle at top right, rgba(93, 255, 141, 0.07), transparent 28%),
            radial-gradient(circle at bottom left, rgba(99, 213, 255, 0.07), transparent 24%),
            linear-gradient(180deg, rgba(16, 28, 38, 0.95), rgba(7, 14, 24, 0.96));
          box-shadow: var(--shadow-strong), var(--glow-green);
        }

        .topbar-shell.member {
          box-shadow: var(--shadow-strong), var(--glow-purple);
        }

        .topbar-grid {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 14px;
          align-items: stretch;
        }

        .topbar-copy {
          min-width: 0;
        }

        .topbar-auth-wrap {
          width: 100%;
          min-width: 0;
        }

        .topbar-mist {
          position: absolute;
          border-radius: 999px;
          filter: blur(54px);
          opacity: 0.42;
          pointer-events: none;
          mix-blend-mode: screen;
        }

        .topbar-mist-a {
          width: 220px;
          height: 220px;
          right: -60px;
          top: -80px;
        }

        .topbar-mist-b {
          width: 170px;
          height: 170px;
          left: -40px;
          bottom: -50px;
        }

        .topbar-mist.staff {
          background: rgba(99, 213, 255, 0.18);
        }

        .topbar-mist.member {
          background: rgba(178, 109, 255, 0.18);
        }

        .topbar-meta-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 10px;
        }

        .topbar-eyebrow-wrap {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .topbar-eyebrow {
          font-size: 13px;
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
          min-height: 30px;
          padding: 6px 12px;
          border-radius: 999px;
          font-size: 10px;
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
          max-width: 760px;
          font-size: clamp(28px, 5vw, 46px);
          line-height: 0.98;
          letter-spacing: -0.045em;
          font-weight: 950;
          color: var(--text-strong, #f8fafc);
          text-wrap: balance;
        }

        .topbar-description {
          margin-top: 10px;
          max-width: 700px;
          line-height: 1.55;
          font-size: 14px;
        }

        @media (min-width: 900px) {
          .topbar-grid {
            grid-template-columns: minmax(0, 1fr) minmax(280px, 360px);
            gap: 16px;
            align-items: center;
          }
        }

        @media (max-width: 767px) {
          .topbar-shell {
            padding: 16px;
            border-radius: 22px;
          }

          .topbar-title {
            font-size: 26px;
          }

          .topbar-description {
            font-size: 13px;
            line-height: 1.5;
          }

          .topbar-badge {
            min-height: 30px;
            padding: 6px 11px;
            font-size: 10px;
          }
        }
      `}</style>
    </div>
  );
}

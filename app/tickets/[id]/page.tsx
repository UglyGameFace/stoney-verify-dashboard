import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Sidebar from "@/components/Sidebar";
import TicketDetailClient from "@/components/TicketDetailClient";
import {
  getSession,
  getDiscordLoginUrl,
  hasDiscordOAuthConfig,
} from "@/lib/auth-server";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SessionLike = {
  isStaff?: boolean;
  user?: {
    discord_id?: string | null;
    id?: string | null;
    username?: string | null;
    name?: string | null;
  } | null;
  discordUser?: {
    id?: string | null;
    username?: string | null;
  } | null;
} | null;

type TicketWorkspaceData = {
  verificationLabel: string;
  riskLevel: string;
  noteCount: number;
  messageCount: number;
  flaggedCount: number;
  maxFlagScore: number;
  warnCount: number;
  latestActivityAt: string | null;
  recommendedActions: string[];
  sla: {
    sla_status: string;
    overdue: boolean;
    minutes_overdue: number;
    minutes_until_deadline: number;
  };
};

type TicketCounts = {
  notes: number;
  messages: number;
  flags: number;
  warns: number;
  tokens: number;
  vcSessions: number;
};

type TicketPageData = {
  ok: boolean;
  ticket: Record<string, unknown> | null;
  category: Record<string, unknown> | null;
  member: Record<string, unknown> | null;
  joins: Record<string, unknown>[];
  latestJoin: Record<string, unknown> | null;
  memberEvents: Record<string, unknown>[];
  verificationFlags: Record<string, unknown>[];
  verificationTokens: Record<string, unknown>[];
  vcSessions: Record<string, unknown>[];
  warns: Record<string, unknown>[];
  activity: Record<string, unknown>[];
  timeline: Record<string, unknown>[];
  messages: Record<string, unknown>[];
  notes: Record<string, unknown>[];
  workspace: TicketWorkspaceData;
  counts: TicketCounts;
  viewer: {
    id: string;
    username: string;
  };
  currentStaffId: string;
  error: string;
};

type TicketPageProps = {
  params: {
    id?: string;
  };
};

function normalizeString(value: unknown): string {
  return String(value || "").trim();
}

function normalizeNumber(value: unknown, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeBoolean(value: unknown): boolean {
  return value === true;
}

function safeText(value: unknown, fallback = "—"): string {
  const text = normalizeString(value);
  return text || fallback;
}

function formatDateTime(value: unknown): string {
  const text = normalizeString(value);
  if (!text) return "—";

  try {
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString();
  } catch {
    return "—";
  }
}

function resolveAppOrigin(): string {
  const explicitCandidates = [
    env?.siteUrl,
    env?.appUrl,
    env?.baseUrl,
    env?.publicUrl,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.SITE_URL,
    process.env.APP_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "",
  ]
    .map((value) => normalizeString(value))
    .filter(Boolean);

  if (explicitCandidates.length) {
    return explicitCandidates[0].replace(/\/+$/, "");
  }

  const headerStore = headers();
  const host =
    normalizeString(headerStore.get("x-forwarded-host")) ||
    normalizeString(headerStore.get("host"));

  const proto =
    normalizeString(headerStore.get("x-forwarded-proto")) ||
    (host.includes("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");

  if (host) {
    return `${proto}://${host}`;
  }

  return "http://127.0.0.1:3000";
}

function buildFallbackTicketData(
  ticketId: string,
  session: SessionLike
): TicketPageData {
  const viewerId =
    session?.user?.discord_id ||
    session?.user?.id ||
    session?.discordUser?.id ||
    "";

  const viewerName =
    session?.user?.username ||
    session?.discordUser?.username ||
    session?.user?.name ||
    "Staff";

  return {
    ok: false,
    ticket: null,
    category: null,
    member: null,
    joins: [],
    latestJoin: null,
    memberEvents: [],
    verificationFlags: [],
    verificationTokens: [],
    vcSessions: [],
    warns: [],
    activity: [],
    timeline: [],
    messages: [],
    notes: [],
    workspace: {
      verificationLabel: "Unknown",
      riskLevel: "unknown",
      noteCount: 0,
      messageCount: 0,
      flaggedCount: 0,
      maxFlagScore: 0,
      warnCount: 0,
      latestActivityAt: null,
      recommendedActions: [],
      sla: {
        sla_status: "no_deadline",
        overdue: false,
        minutes_overdue: 0,
        minutes_until_deadline: 0,
      },
    },
    counts: {
      notes: 0,
      messages: 0,
      flags: 0,
      warns: 0,
      tokens: 0,
      vcSessions: 0,
    },
    viewer: {
      id: viewerId,
      username: viewerName,
    },
    currentStaffId: viewerId,
    error: ticketId ? "Ticket not found." : "Missing ticket id.",
  };
}

async function fetchTicketData(
  ticketId: string,
  session: SessionLike
): Promise<TicketPageData> {
  if (!ticketId) {
    return buildFallbackTicketData(ticketId, session);
  }

  try {
    const headerStore = headers();
    const origin = resolveAppOrigin();
    const cookieHeader = normalizeString(headerStore.get("cookie"));
    const authHeader = normalizeString(headerStore.get("authorization"));

    const response = await fetch(
      `${origin}/api/tickets/${encodeURIComponent(ticketId)}`,
      {
        method: "GET",
        cache: "no-store",
        headers: {
          ...(cookieHeader ? { cookie: cookieHeader } : {}),
          ...(authHeader ? { authorization: authHeader } : {}),
          accept: "application/json",
          "x-dashboard-internal": "1",
        },
        next: { revalidate: 0 },
      }
    );

    const json = (await response.json().catch(() => null)) as
      | (Partial<TicketPageData> & { error?: string })
      | null;

    if (!response.ok || !json || typeof json !== "object") {
      return {
        ...buildFallbackTicketData(ticketId, session),
        error:
          json?.error ||
          `Failed to load ticket (${response.status || "unknown error"}).`,
      };
    }

    return {
      ...buildFallbackTicketData(ticketId, session),
      ...json,
      ok: Boolean(json.ok ?? true),
      error: "",
    };
  } catch (error: unknown) {
    return {
      ...buildFallbackTicketData(ticketId, session),
      error:
        error instanceof Error ? error.message : "Failed to load ticket.",
    };
  }
}

function LoginRequiredState() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        background: "#09090b",
        color: "white",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.03)",
          borderRadius: 20,
          padding: 24,
        }}
      >
        <h1 style={{ marginTop: 0 }}>Login Required</h1>
        <p style={{ color: "rgba(255,255,255,0.72)", lineHeight: 1.5 }}>
          Discord login is required to open ticket workspaces.
        </p>
        <p style={{ color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>
          OAuth configuration is currently missing or incomplete.
        </p>
      </div>
    </main>
  );
}

function TopActionLink({
  href,
  label,
  primary = false,
}: {
  href: string;
  label: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 42,
        padding: "10px 14px",
        borderRadius: 14,
        textDecoration: "none",
        fontWeight: 800,
        fontSize: 14,
        lineHeight: 1,
        border: primary
          ? "1px solid rgba(93,255,141,0.28)"
          : "1px solid rgba(255,255,255,0.08)",
        background: primary
          ? "rgba(93,255,141,0.10)"
          : "rgba(255,255,255,0.04)",
        color: "#f8fafc",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </Link>
  );
}

function WorkspaceBadge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "good" | "warn" | "danger" | "info";
}) {
  const stylesByTone: Record<string, { border: string; background: string }> = {
    neutral: {
      border: "1px solid rgba(255,255,255,0.08)",
      background: "rgba(255,255,255,0.04)",
    },
    good: {
      border: "1px solid rgba(93,255,141,0.24)",
      background: "rgba(93,255,141,0.08)",
    },
    warn: {
      border: "1px solid rgba(251,191,36,0.22)",
      background: "rgba(251,191,36,0.08)",
    },
    danger: {
      border: "1px solid rgba(248,113,113,0.22)",
      background: "rgba(248,113,113,0.08)",
    },
    info: {
      border: "1px solid rgba(99,213,255,0.22)",
      background: "rgba(99,213,255,0.08)",
    },
  };

  const toneStyles = stylesByTone[tone] || stylesByTone.neutral;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        minHeight: 30,
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        color: "#f8fafc",
        ...toneStyles,
      }}
    >
      {label}
    </span>
  );
}

function TicketUnavailableState({
  error,
  ticketId,
}: {
  error?: string;
  ticketId?: string;
}) {
  return (
    <div className="space">
      <div className="card">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="muted" style={{ marginBottom: 8 }}>
              Ticket Detail
            </div>

            <h1
              style={{
                margin: 0,
                fontSize: "clamp(30px, 5vw, 46px)",
                lineHeight: 0.96,
                letterSpacing: "-0.05em",
              }}
            >
              Ticket unavailable
            </h1>

            <div className="error-banner" style={{ marginTop: 16 }}>
              {error || "Ticket not found."}
            </div>

            {ticketId ? (
              <div className="muted" style={{ marginTop: 10 }}>
                Requested ticket ID: {ticketId}
              </div>
            ) : null}
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <TopActionLink href="/" label="← Dashboard" primary />
            <TopActionLink href="/#tickets" label="Tickets" />
          </div>
        </div>
      </div>
    </div>
  );
}

function TicketWorkspaceShellHeader({
  data,
  ticketId,
}: {
  data: TicketPageData;
  ticketId: string;
}) {
  const ticket = data.ticket || {};
  const workspace = data.workspace || {
    verificationLabel: "Unknown",
    riskLevel: "unknown",
    noteCount: 0,
    messageCount: 0,
    flaggedCount: 0,
    maxFlagScore: 0,
    warnCount: 0,
    latestActivityAt: null,
    recommendedActions: [],
    sla: {
      sla_status: "no_deadline",
      overdue: false,
      minutes_overdue: 0,
      minutes_until_deadline: 0,
    },
  };
  const counts = data.counts || {
    notes: 0,
    messages: 0,
    flags: 0,
    warns: 0,
    tokens: 0,
    vcSessions: 0,
  };

  const status = safeText(ticket.status, "unknown").toLowerCase();
  const risk = safeText(workspace.riskLevel, "unknown").toLowerCase();
  const verification = safeText(workspace.verificationLabel, "Unknown");
  const slaOverdue = normalizeBoolean(workspace?.sla?.overdue);
  const transcriptReady =
    normalizeString(ticket.transcript_url) ||
    normalizeString(ticket.transcript_message_id) ||
    normalizeString(ticket.transcript_channel_id);

  return (
    <div
      className="card"
      style={{
        background:
          "radial-gradient(circle at top right, rgba(93,255,141,0.08), transparent 28%), radial-gradient(circle at bottom left, rgba(99,213,255,0.06), transparent 24%), linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015)), linear-gradient(180deg, rgba(14, 25, 35, 0.98), rgba(7, 13, 21, 0.98))",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            className="muted"
            style={{
              marginBottom: 8,
              fontSize: 12,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Staff Ticket Workspace
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: "clamp(30px, 5vw, 46px)",
              lineHeight: 0.96,
              letterSpacing: "-0.05em",
              overflowWrap: "anywhere",
            }}
          >
            Ticket Workspace
          </h1>

          <div
            className="muted"
            style={{
              marginTop: 12,
              maxWidth: 920,
              lineHeight: 1.55,
              overflowWrap: "anywhere",
            }}
          >
            Ticket ID {ticketId} • Use this page for staff actions, member context,
            verification decisions, notes, timeline, and replies.
          </div>

          <div
            style={{
              marginTop: 14,
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <WorkspaceBadge
              label={`Status: ${safeText(ticket.status, "unknown")}`}
              tone={
                status === "deleted"
                  ? "danger"
                  : status === "closed"
                    ? "warn"
                    : status === "claimed"
                      ? "good"
                      : "info"
              }
            />
            <WorkspaceBadge
              label={`Verification: ${verification}`}
              tone={
                verification.toLowerCase() === "verified"
                  ? "good"
                  : verification.toLowerCase().includes("review")
                    ? "danger"
                    : verification.toLowerCase().includes("pending")
                      ? "warn"
                      : "neutral"
              }
            />
            <WorkspaceBadge
              label={`Risk: ${risk}`}
              tone={
                risk === "high"
                  ? "danger"
                  : risk === "medium"
                    ? "warn"
                    : risk === "low"
                      ? "good"
                      : "neutral"
              }
            />
            <WorkspaceBadge
              label={
                slaOverdue
                  ? `SLA Overdue • ${normalizeNumber(
                      workspace?.sla?.minutes_overdue,
                      0
                    )}m`
                  : `SLA • ${safeText(workspace?.sla?.sla_status, "no_deadline")}`
              }
              tone={slaOverdue ? "danger" : "info"}
            />
            <WorkspaceBadge
              label={transcriptReady ? "Transcript Ready" : "Transcript Pending"}
              tone={transcriptReady ? "good" : "neutral"}
            />
            {normalizeBoolean(ticket.is_ghost) ? (
              <WorkspaceBadge label="Ghost Ticket" tone="neutral" />
            ) : null}
            {normalizeBoolean(ticket.category_override) ? (
              <WorkspaceBadge label="Manual Category" tone="warn" />
            ) : null}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <TopActionLink href="/" label="← Dashboard" primary />
          <TopActionLink href="/#tickets" label="Tickets" />
          <TopActionLink href="/ticket-categories" label="Category Manager" />
          <TopActionLink href="/#members" label="Members" />
        </div>
      </div>

      <div
        style={{
          marginTop: 16,
          display: "grid",
          gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
          gap: 10,
        }}
      >
        <div className="member-detail-item">
          <div className="ticket-info-label">Messages</div>
          <div>{normalizeNumber(counts.messages, 0)}</div>
        </div>
        <div className="member-detail-item">
          <div className="ticket-info-label">Notes</div>
          <div>{normalizeNumber(counts.notes, 0)}</div>
        </div>
        <div className="member-detail-item">
          <div className="ticket-info-label">Flags</div>
          <div>{normalizeNumber(counts.flags, 0)}</div>
        </div>
        <div className="member-detail-item">
          <div className="ticket-info-label">Warns</div>
          <div>{normalizeNumber(counts.warns, 0)}</div>
        </div>
        <div className="member-detail-item">
          <div className="ticket-info-label">Tokens</div>
          <div>{normalizeNumber(counts.tokens, 0)}</div>
        </div>
        <div className="member-detail-item">
          <div className="ticket-info-label">VC Sessions</div>
          <div>{normalizeNumber(counts.vcSessions, 0)}</div>
        </div>
      </div>

      <div
        style={{
          marginTop: 16,
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 12,
        }}
      >
        <div className="member-detail-item">
          <div className="ticket-info-label">Latest Activity</div>
          <div>{formatDateTime(workspace.latestActivityAt)}</div>
        </div>
        <div className="member-detail-item">
          <div className="ticket-info-label">Recommended Actions</div>
          <div style={{ overflowWrap: "anywhere" }}>
            {Array.isArray(workspace.recommendedActions) &&
            workspace.recommendedActions.length
              ? workspace.recommendedActions.slice(0, 4).join(" • ")
              : "No immediate recommendations"}
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function TicketPage({ params }: TicketPageProps) {
  const ticketId = normalizeString(params?.id || "");
  const session = (await getSession()) as SessionLike;

  if (!session) {
    if (hasDiscordOAuthConfig()) {
      redirect(getDiscordLoginUrl());
    }

    return <LoginRequiredState />;
  }

  if (!session?.isStaff) {
    redirect("/");
  }

  const data = await fetchTicketData(ticketId, session);

  return (
    <div className="shell">
      <Sidebar />

      <main className="content">
        <div className="content-inner">
          {data?.ticket ? (
            <div className="space">
              <TicketWorkspaceShellHeader data={data} ticketId={ticketId} />
              <TicketDetailClient initialData={data} ticketId={ticketId} />
            </div>
          ) : (
            <TicketUnavailableState error={data?.error} ticketId={ticketId} />
          )}
        </div>
      </main>
    </div>
  );
}

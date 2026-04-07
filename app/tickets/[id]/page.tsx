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
            <Link className="button ghost" href="/" style={{ width: "auto" }}>
              ← Dashboard
            </Link>
            <Link className="button ghost" href="/#tickets" style={{ width: "auto" }}>
              Tickets
            </Link>
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
            <TicketDetailClient initialData={data} ticketId={ticketId} />
          ) : (
            <TicketUnavailableState error={data?.error} ticketId={ticketId} />
          )}
        </div>
      </main>
    </div>
  );
}

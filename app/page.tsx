import { getSession } from "@/lib/session";

export default async function Home({ searchParams }: { searchParams?: Record<string, string> }) {
  const s = await getSession();
  const next = searchParams?.next ? encodeURIComponent(searchParams.next) : "";
  return (
    <div className="container">
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>Stoney Verify — Staff Dashboard</div>
            <div className="muted" style={{ marginTop: 6 }}>
              Tokens • Kick timers • Manual approve/deny • Audit logs • Live monitor
            </div>
          </div>
          <div className="row">
            {s ? (
              <>
                <span className="pill">✅ {s.username}</span>
                <a className="btn btn-secondary" href="/dashboard">Open Dashboard</a>
                <a className="btn btn-secondary" href="/api/auth/logout">Logout</a>
              </>
            ) : (
              <a className="btn" href={`/api/auth/login${next ? `?next=${next}` : ""}`}>Login with Discord</a>
            )}
          </div>
        </div>
        <div className="hr" />
        <div className="muted">
          Access is gated by Discord roles from your server. If you can’t log in, you likely don’t have one of the staff role IDs in <code>DISCORD_STAFF_ROLE_IDS</code>.
        </div>
      </div>
    </div>
  );
}

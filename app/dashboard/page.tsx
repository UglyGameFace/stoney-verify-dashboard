import { getSession } from "@/lib/session";
import DashboardClient from "./DashboardClient";
import { redirect } from "next/navigation";

export default async function Dashboard() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="container">
      <div
        className="row"
        style={{ justifyContent: "space-between", marginBottom: 12 }}
      >
        <div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>
            Stoney Verify Dashboard
          </div>
          <div className="muted" style={{ marginTop: 6 }}>
            Welcome, {session.username}!
          </div>
        </div>

        <div className="row">
          <a className="btn btn-secondary" href="/">
            Home
          </a>
          <a className="btn btn-secondary" href="/api/auth/logout">
            Logout
          </a>
        </div>
      </div>

      <DashboardClient
        staffUser={{
          id: session.userId,
          username: session.username,
          roles: session.roles ?? [],
          guildId: session.guildId ?? null,
        }}
      />
    </div>
  );
}

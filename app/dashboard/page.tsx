import { getSession } from "@/lib/session";
import DashboardClient from "./ui";

export default async function Dashboard() {
  const s = await getSession();
  if (!s) return null; // middleware redirects anyway
  return (
    <div className="container">
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>Staff Dashboard</div>
          <div className="muted" style={{ marginTop: 6 }}>Signed in as {s.username}</div>
        </div>
        <div className="row">
          <a className="btn btn-secondary" href="/">Home</a>
          <a className="btn btn-secondary" href="/api/auth/logout">Logout</a>
        </div>
      </div>
      <DashboardClient staffUser={{ id: s.sub, username: s.username }} />
    </div>
  );
}

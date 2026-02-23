// app/dashboard/page.tsx
import { getSession } from "@/lib/session";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const s = await getSession();

  if (!s) {
    return (
      <div style={{ padding: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Not logged in</h1>
        <p style={{ marginTop: 8 }}>
          Your session cookie is missing or expired. Click login:
        </p>
        <p style={{ marginTop: 12 }}>
          <a href="/api/auth/login" style={{ textDecoration: "underline" }}>
            Login with Discord
          </a>
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <DashboardClient
        staffUser={{
          id: s.userId,        // ✅ FIX: was s.sub
          username: s.username,
          avatar: s.avatar ?? null,
          roles: s.roles ?? [],
          guildId: s.guildId ?? null,
        }}
      />
    </div>
  );
}

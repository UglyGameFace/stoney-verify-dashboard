import { redirect } from "next/navigation";
import DashboardClient from "./DashboardClient";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const s = await getSession();
  if (!s) redirect("/login");

  return (
    <div style={{ padding: 24 }}>
      <DashboardClient
        staffUser={{
          id: s.userId, // ✅ FIX: was s.sub in older broken builds
          username: s.username,
          roles: s.roles ?? [],
          guildId: s.guildId ?? null,
        }}
      />
    </div>
  );
}

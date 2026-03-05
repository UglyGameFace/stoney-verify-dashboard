import { getSession } from "@/lib/session";
import DashboardClient from "./DashboardClient";
import { redirect } from "next/navigation";

export default async function Dashboard() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <DashboardClient
      staffUser={{
        id: session.userId,
        username: session.username,
        roles: session.roles ?? [],
        guildId: session.guildId ?? null,
      }}
    />
  );
}

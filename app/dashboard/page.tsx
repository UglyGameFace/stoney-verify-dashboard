import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import DashboardUI from "./ui";

export default async function DashboardPage() {
  const session = await getSession();

  // If not logged in, redirect to login
  if (!session) {
    redirect("/login");
  }

  return (
    <DashboardUI
      staffUser={{
        userId: session.userId,
        username: session.username,
        roles: session.roles,
        avatar: session.avatar ?? null,
        guildId: session.guildId ?? null,
      }}
    />
  );
}

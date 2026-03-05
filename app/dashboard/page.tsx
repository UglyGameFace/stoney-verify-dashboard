import { getSession } from "@/lib/session";
import DashboardClient from "./DashboardClient";
import { redirect } from "next/navigation";

export default async function Dashboard() {
  const session = await getSession();
  if (!session) redirect("/login");

  // DashboardClient will render the themed UI (sb-shell, sidebar, etc)
  return <DashboardClient />;
}

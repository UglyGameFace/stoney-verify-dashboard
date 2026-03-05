import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

/**
 * Home route.
 * Keep this tiny: send staff straight to the dashboard,
 * otherwise send to login.
 */
export default async function Home() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  redirect("/dashboard");
}

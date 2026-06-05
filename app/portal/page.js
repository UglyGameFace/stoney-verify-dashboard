import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-server";
import { loginRouteFor } from "@/lib/auth-return";
import { createServerSupabase } from "@/lib/supabase-server";

import MemberPortalClient from "@/components/MemberPortalClient";

export const dynamic = "force-dynamic";

async function getUserTickets(userId) {
  const supabase = createServerSupabase();

  const { data, error } = await supabase
    .from("tickets")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export default async function PortalPage() {
  const session = await getSession();

  if (!session?.user?.id) {
    redirect(loginRouteFor("/portal"));
  }

  const tickets = await getUserTickets(session.user.id);

  return (
    <main className="portal-shell">
      <MemberPortalClient
        user={session.user}
        initialTickets={tickets}
      />
    </main>
  );
}

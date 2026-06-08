import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-server";
import { loginRouteFor } from "@/lib/auth-return";
import { getSelectedGuildId } from "@/lib/guild-selection";
import { createServerSupabase } from "@/lib/supabase-server";

import MemberPortalClient from "@/components/MemberPortalClient";

export const dynamic = "force-dynamic";

function clean(value) {
  return String(value ?? "").trim();
}

async function getUserTickets(userId, guildId) {
  const supabase = createServerSupabase();

  const { data, error } = await supabase
    .from("tickets")
    .select("*")
    .eq("guild_id", guildId)
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

  const guildId = clean(getSelectedGuildId());
  if (!guildId) {
    redirect("/servers");
  }

  const tickets = await getUserTickets(session.user.id, guildId);

  return (
    <main className="portal-shell">
      <MemberPortalClient
        user={session.user}
        selectedGuildId={guildId}
        initialTickets={tickets}
      />
    </main>
  );
}

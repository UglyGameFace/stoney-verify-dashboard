import { createServerSupabase } from "@/lib/supabase-server";
import { requireDashboardStaffSession, dashboardAuthJson, dashboardAuthErrorJson, type DashboardAuthSession } from "@/lib/dashboard-auth";
import { discordBotFetch } from "@/lib/discord-api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type DiscordChannel = {
  id?: string;
  name?: string;
  type?: number;
  parent_id?: string | null;
  position?: number | null;
};

type ExistingCategory = {
  id?: string | null;
  name?: string | null;
  slug?: string | null;
};

const TICKET_WORDS = ["ticket", "tickets", "support
import { createServerSupabase } from "@/lib/supabase-server";
import { requireDashboardStaffSession, dashboardAuthJson, dashboardAuthErrorJson } from "@/lib/dashboard-auth";
import { discordBotFetch } from "@/lib/discord-api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TICKET_WORDS = ["ticket", "tickets", "support", "help", "verify", "verification", "appeal", "report", "reports", "incident", "modmail", "claim", "transcript", "blacklist", "ban", "unban", "service", "services",
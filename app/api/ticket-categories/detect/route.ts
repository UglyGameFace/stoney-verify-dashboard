import { createServerSupabase } from "@/lib/supabase-server";
import { requireDashboardStaffSession, dashboardAuthJson, dashboardAuthErrorJson, type DashboardAuthSession } from "@/lib/dashboard-auth";
import { discordBotFetch } from "@/lib/discord-api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type DiscordChannel =
import { discordBotFetch } from "@/lib/discord-api";
import { createServerSupabase } from "@/lib/supabase-server";
import { requireDashboardStaffSession, dashboardAuthJson, dashboardAuthErrorJson } from "@/lib/dashboard-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CATEGORY_TYPE = 4;
const STRONG = ["ticket", "tickets", "
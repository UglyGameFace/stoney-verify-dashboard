import { createServerSupabase } from "@/lib/supabase-server";
import { requireDashboardStaffSession, dashboardAuthJson, dashboardAuthErrorJson } from "@/lib/dashboard-auth";
import { discordBotFetch } from "@/lib/discord-api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const WORDS = ["ticket", "support", "verify", "verification", "appeal", "report", "service", "modmail"];

function clean(v) {
  return String(v || "").trim();
}

function norm(v) {
  return clean(v).toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function slug(v) {
  return clean(v).toLowerCase
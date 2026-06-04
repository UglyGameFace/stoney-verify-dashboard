import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function configured(value) {
  return Boolean(String(value || "").trim());
}

export async function GET() {
  const defaultGuildConfigured = configured(env.guildId || env.discordGuildId);
  const oauthConfigured = Boolean(
    configured(env.discordClientId) &&
      configured(env.discordClientSecret) &&
      configured(env.discordRedirectUri) &&
      configured(env.appUrl || env.siteUrl || env.baseUrl || env.publicUrl)
  );
  const supabaseConfigured = Boolean(
    configured(env.supabaseUrl) && configured(env.supabaseServiceRole)
  );
  const botConfigured = configured(env.discordToken);

  return Response.json(
    {
      ok: true,
      service: "dank-shield-dashboard",
      version: "3.8",
      timestamp: new Date().toISOString(),
      mode: "multi-server",
      readiness: {
        oauthConfigured,
        supabaseConfigured,
        botConfigured,
        defaultGuildConfigured,
        selectedGuildRequiredForDashboardData: true,
      },
      checks: {
        discordClientId: configured(env.discordClientId),
        discordClientSecret: configured(env.discordClientSecret),
        discordRedirectUri: configured(env.discordRedirectUri),
        siteOrigin: configured(env.appUrl || env.siteUrl || env.baseUrl || env.publicUrl),
        supabaseUrl: configured(env.supabaseUrl),
        supabaseServiceRole: configured(env.supabaseServiceRole),
        discordBotToken: botConfigured,
        defaultGuildId: defaultGuildConfigured,
      },
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    }
  );
}

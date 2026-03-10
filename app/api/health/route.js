import { env } from "@/lib/env"

export async function GET() {
  return Response.json({
    ok: true,
    service: "stoney-verify-dashboard-v3.8",
    timestamp: new Date().toISOString(),
    guildConfigured: Boolean(env.guildId),
    oauthConfigured: Boolean(env.discordClientId && env.discordClientSecret && env.discordRedirectUri),
    supabaseConfigured: Boolean(env.supabaseUrl && env.supabaseServiceRole)
  })
}

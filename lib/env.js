function required(name: string, value: any) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function cleanId(value: any): string {
  if (!value) return ""
  return String(value).trim()
}

export const env = {
  appName:
    process.env.NEXT_PUBLIC_APP_NAME ||
    "Stoney Verify Dashboard V3.8",

  supabaseUrl:
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    "",

  supabaseAnonKey:
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "",

  // 🔒 SERVICE ROLE MUST ONLY COME FROM SERVER ENV
  supabaseServiceRole:
    process.env.SUPABASE_SERVICE_ROLE ||
    "",

  supabaseDbUrl:
    process.env.SUPABASE_DB_URL ||
    "",

  discordToken:
    process.env.DISCORD_TOKEN ||
    "",

  discordClientId:
    process.env.DISCORD_CLIENT_ID ||
    "",

  discordClientSecret:
    process.env.DISCORD_CLIENT_SECRET ||
    "",

  discordRedirectUri:
    process.env.DISCORD_REDIRECT_URI ||
    "",

  appUrl:
    process.env.APP_URL ||
    "",

  guildId: cleanId(
    process.env.DISCORD_GUILD_ID ||
    process.env.GUILD_ID ||
    ""
  ),

  staffRoleIds: (process.env.STAFF_ROLE_IDS || "")
    .split(",")
    .map((x) => cleanId(x))
    .filter(Boolean),

  staffRoleNames: (process.env.STAFF_ROLE_NAMES || "")
    .split(",")
    .map((x) => String(x).trim())
    .filter(Boolean),

  defaultStaffName:
    process.env.DEFAULT_STAFF_NAME ||
    "Dashboard Staff",

  isProduction:
    process.env.NODE_ENV === "production",

  botAutoSyncEnabled:
    String(process.env.BOT_AUTO_SYNC_ENABLED || "true")
      .toLowerCase() === "true",

  botAutoSyncIntervalMinutes:
    Number(process.env.BOT_AUTO_SYNC_INTERVAL_MINUTES || 30),

  botAutoSyncBatchLimit:
    Number(process.env.BOT_AUTO_SYNC_BATCH_LIMIT || 500)
}

export function assertServerEnv() {
  required(
    "NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL",
    env.supabaseUrl
  )

  required(
    "SUPABASE_SERVICE_ROLE",
    env.supabaseServiceRole
  )

  required(
    "DISCORD_TOKEN",
    env.discordToken
  )

  required(
    "DISCORD_GUILD_ID or GUILD_ID",
    env.guildId
  )

  return true
}

export function assertOAuthEnv() {
  required(
    "DISCORD_CLIENT_ID",
    env.discordClientId
  )

  required(
    "DISCORD_CLIENT_SECRET",
    env.discordClientSecret
  )

  required(
    "DISCORD_REDIRECT_URI",
    env.discordRedirectUri
  )

  required(
    "APP_URL",
    env.appUrl
  )

  required(
    "DISCORD_GUILD_ID or GUILD_ID",
    env.guildId
  )

  return true
}

export function assertBrowserEnv() {
  required(
    "NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL",
    env.supabaseUrl
  )

  required(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    env.supabaseAnonKey
  )

  return true
}

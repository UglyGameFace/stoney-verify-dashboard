function required(name: string, value: string): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function cleanId(value: unknown): string {
  if (!value) return "";
  return String(value).trim();
}

function cleanRoleName(value: unknown): string {
  if (!value) return "";
  return String(value).trim().toLowerCase();
}

function cleanUrl(value: unknown): string {
  if (!value) return "";
  return String(value).trim().replace(/\/+$/, "");
}

function cleanStringList(value: unknown): string[] {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function cleanNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function cleanBoolean(value: unknown, fallback: boolean): boolean {
  const text = String(value ?? "").trim().toLowerCase();

  if (!text) return fallback;
  if (["true", "1", "yes", "on"].includes(text)) return true;
  if (["false", "0", "no", "off"].includes(text)) return false;

  return fallback;
}

export type AppEnv = {
  appName: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRole: string;
  supabaseDbUrl: string;
  discordToken: string;
  discordClientId: string;
  discordClientSecret: string;
  discordRedirectUri: string;
  appUrl: string;
  siteUrl: string;
  baseUrl: string;
  publicUrl: string;
  guildId: string;
  discordGuildId: string;
  staffRoleIds: string[];
  staffRoleNames: string[];
  defaultStaffName: string;
  isProduction: boolean;
  botAutoSyncEnabled: boolean;
  botAutoSyncIntervalMinutes: number;
  botAutoSyncBatchLimit: number;
};

export const env: AppEnv = {
  appName: process.env.NEXT_PUBLIC_APP_NAME || "Stoney Verify Dashboard V3.8",

  supabaseUrl:
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    "",

  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",

  supabaseServiceRole:
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "",

  supabaseDbUrl: process.env.SUPABASE_DB_URL || "",

  discordToken: process.env.DISCORD_TOKEN || "",

  discordClientId: process.env.DISCORD_CLIENT_ID || "",

  discordClientSecret: process.env.DISCORD_CLIENT_SECRET || "",

  discordRedirectUri: process.env.DISCORD_REDIRECT_URI || "",

  appUrl: cleanUrl(
    process.env.APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.SITE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      ""
  ),

  siteUrl: cleanUrl(
    process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.SITE_URL ||
      process.env.APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      ""
  ),

  baseUrl: cleanUrl(
    process.env.BASE_URL ||
      process.env.APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.SITE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      ""
  ),

  publicUrl: cleanUrl(
    process.env.PUBLIC_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.SITE_URL ||
      process.env.APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      ""
  ),

  guildId: cleanId(
    process.env.DISCORD_GUILD_ID ||
      process.env.GUILD_ID ||
      ""
  ),

  discordGuildId: cleanId(
    process.env.DISCORD_GUILD_ID ||
      process.env.GUILD_ID ||
      ""
  ),

  staffRoleIds: cleanStringList(process.env.STAFF_ROLE_IDS).map((value) =>
    cleanId(value)
  ),

  staffRoleNames: cleanStringList(process.env.STAFF_ROLE_NAMES).map((value) =>
    cleanRoleName(value)
  ),

  defaultStaffName:
    process.env.DEFAULT_STAFF_NAME ||
    "Dashboard Staff",

  isProduction: process.env.NODE_ENV === "production",

  botAutoSyncEnabled: cleanBoolean(
    process.env.BOT_AUTO_SYNC_ENABLED,
    true
  ),

  botAutoSyncIntervalMinutes: cleanNumber(
    process.env.BOT_AUTO_SYNC_INTERVAL_MINUTES,
    30
  ),

  botAutoSyncBatchLimit: cleanNumber(
    process.env.BOT_AUTO_SYNC_BATCH_LIMIT,
    500
  ),
};

export function assertServerEnv(): true {
  required(
    "NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL",
    env.supabaseUrl
  );

  required(
    "SUPABASE_SERVICE_ROLE or SUPABASE_SERVICE_ROLE_KEY",
    env.supabaseServiceRole
  );

  required(
    "DISCORD_TOKEN",
    env.discordToken
  );

  required(
    "DISCORD_GUILD_ID or GUILD_ID",
    env.guildId
  );

  return true;
}

export function assertOAuthEnv(): true {
  required(
    "DISCORD_CLIENT_ID",
    env.discordClientId
  );

  required(
    "DISCORD_CLIENT_SECRET",
    env.discordClientSecret
  );

  required(
    "DISCORD_REDIRECT_URI",
    env.discordRedirectUri
  );

  required(
    "APP_URL or NEXT_PUBLIC_SITE_URL or SITE_URL",
    env.appUrl || env.siteUrl || env.baseUrl || env.publicUrl
  );

  required(
    "DISCORD_GUILD_ID or GUILD_ID",
    env.guildId
  );

  return true;
}

export function assertBrowserEnv(): true {
  required(
    "NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL",
    env.supabaseUrl
  );

  required(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    env.supabaseAnonKey
  );

  return true;
}

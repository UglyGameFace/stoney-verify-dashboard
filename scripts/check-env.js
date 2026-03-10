const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE",
  "DISCORD_TOKEN",
  "DISCORD_CLIENT_ID",
  "DISCORD_CLIENT_SECRET",
  "DISCORD_REDIRECT_URI",
  "APP_URL",
  "GUILD_ID"
]

const missing = required.filter((key) => !process.env[key])

if (missing.length) {
  console.error("Missing required environment variables:")
  for (const key of missing) console.error(`- ${key}`)
  process.exit(1)
}

console.log("Environment looks valid.")

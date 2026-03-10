# Deploying V3.8 to Vercel

Framework: Next.js

## Build
```bash
npm install
npm run build
```

## Required environment variables

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE
- SUPABASE_URL
- SUPABASE_DB_URL
- DISCORD_TOKEN
- DISCORD_CLIENT_ID
- DISCORD_CLIENT_SECRET
- DISCORD_REDIRECT_URI
- APP_URL
- GUILD_ID
- STAFF_ROLE_NAMES
- DEFAULT_STAFF_NAME
- BOT_AUTO_SYNC_ENABLED
- BOT_AUTO_SYNC_INTERVAL_MINUTES
- BOT_AUTO_SYNC_BATCH_LIMIT

## OAuth redirect
`https://your-domain.com/api/auth/callback`

## Suggested smoke test
- /api/health
- /api/auth/login
- /
- /api/discord/role-sync
- ticket claim / close / reply
- category add / edit / delete
- transcript export

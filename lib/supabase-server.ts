import { createClient } from "@supabase/supabase-js";
import { env, assertServerEnv } from "@/lib/env";

// The dashboard talks to a live Supabase schema that has evolved with the bot.
// Keep the server client runtime-safe but type-flexible so fallback inserts and
// migration-compatible payloads do not block Vercel builds when table shapes
// differ between deployments.
let supabase: any = null;

export function createServerSupabase(): any {
  assertServerEnv();

  if (supabase) {
    return supabase;
  }

  supabase = createClient(env.supabaseUrl, env.supabaseServiceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        "X-Client-Info": "stoney-verify-dashboard",
      },
    },
  });

  return supabase;
}

import { createClient } from "@supabase/supabase-js"
import { env, assertServerEnv } from "@/lib/env"

export function createServerSupabase() {
  assertServerEnv()
  return createClient(env.supabaseUrl, env.supabaseServiceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  })
}

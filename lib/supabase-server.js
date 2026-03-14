import { createClient } from "@supabase/supabase-js";
import { env, assertServerEnv } from "@/lib/env";

let supabase = null;

export function createServerSupabase() {
  assertServerEnv();

  if (supabase) {
    return supabase;
  }

  supabase = createClient(env.supabaseUrl, env.supabaseServiceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    global: {
      headers: {
        "X-Client-Info": "stoney-verify-dashboard"
      }
    }
  });

  return supabase;
}

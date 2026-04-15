"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, assertBrowserEnv } from "@/lib/env";

let browserClient: SupabaseClient | null = null;

export function getBrowserSupabase(): SupabaseClient {
  if (browserClient) {
    return browserClient;
  }

  assertBrowserEnv();

  browserClient = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: {
      headers: {
        "X-Client-Info": "stoney-verify-dashboard-browser",
      },
    },
  });

  return browserClient;
}

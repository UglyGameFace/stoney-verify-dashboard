"use client"

import { createClient } from "@supabase/supabase-js"
import { env, assertBrowserEnv } from "@/lib/env"

let browserClient = null

export function getBrowserSupabase() {
  if (browserClient) return browserClient
  assertBrowserEnv()
  browserClient = createClient(env.supabaseUrl, env.supabaseAnonKey)
  return browserClient
}

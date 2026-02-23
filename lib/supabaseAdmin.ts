import "server-only";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (_client) return _client;

  const url = (process.env.SUPABASE_URL || "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  // Service role must NEVER be used client-side; this module is server-only.
  if (!url || !key) return null;

  _client = createClient(url, key, {
    auth: { persistSession: false },
    global: { headers: { "X-Client-Info": "stoney-verify-dashboard-admin" } },
  });

  return _client;
}

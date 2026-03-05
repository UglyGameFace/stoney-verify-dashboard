import "server-only";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

/**
 * Returns the Supabase admin client or null if env vars are missing.
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (_client) return _client;

  const url = (process.env.SUPABASE_URL || "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  if (!url || !key) return null;

  _client = createClient(url, key, {
    auth: { persistSession: false },
    global: {
      headers: { "X-Client-Info": "stoney-verify-dashboard-admin" },
    },
  });

  return _client;
}

/**
 * Strict version used by API routes.
 */
export function requireSupabaseAdmin(): SupabaseClient {
  const sb = getSupabaseAdmin();

  if (!sb) {
    throw new Error(
      "Supabase admin not configured. Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return sb;
}

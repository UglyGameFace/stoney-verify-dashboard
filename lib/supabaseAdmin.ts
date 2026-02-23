import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase Admin client.
 * Uses SERVICE_ROLE key to bypass RLS for the dashboard backend.
 *
 * Required env vars on Vercel:
 *  - SUPABASE_URL
 *  - SUPABASE_SERVICE_ROLE_KEY
 */
export function getSupabaseAdmin() {
  const url = (process.env.SUPABASE_URL || "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  // If not configured, return null so the app can still run without audit logging.
  if (!url || !key) return null;

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

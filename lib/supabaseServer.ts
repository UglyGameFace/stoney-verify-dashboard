import { createClient } from "@supabase/supabase-js";
import { mustGet } from "@/lib/env";

export function supabaseServer() {
  const url = mustGet("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = mustGet("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

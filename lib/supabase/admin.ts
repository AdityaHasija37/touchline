import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { supabaseUrl } from "./env";

/**
 * Service-role client. Used for exactly one thing: the public briefing lookup RPC, which anon
 * can't call directly (so the rate limit can't be bypassed). Never import this anywhere else.
 */
export function createBriefingLookupClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient<Database>(supabaseUrl(), key, { auth: { persistSession: false, autoRefreshToken: false } });
}

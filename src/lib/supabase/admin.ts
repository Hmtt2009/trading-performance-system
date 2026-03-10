import { createClient } from '@supabase/supabase-js';

/**
 * Supabase admin client using service role key.
 * Use ONLY in server-side code (API routes, server actions).
 * Bypasses RLS — handle auth checks manually.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

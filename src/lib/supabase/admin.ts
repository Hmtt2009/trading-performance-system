import { createClient } from '@supabase/supabase-js';

/**
 * Supabase admin client using service role key.
 * Use ONLY in server-side code (API routes, server actions).
 * Bypasses RLS — handle auth checks manually.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase admin environment variables not configured');
  return createClient(url, key, { auth: { persistSession: false } });
}

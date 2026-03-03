import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Service-role client — bypasses RLS. Use for admin writes
 * (e.g. upserting contacts from enrichment).
 */
export function createServiceClient() {
  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(url, key);
}

/**
 * User-scoped client — respects RLS via the caller's JWT.
 * Use for reads that should honour row-level security.
 */
export function createUserClient(authHeader: string) {
  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  return createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
}

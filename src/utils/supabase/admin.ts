import { createClient } from '@supabase/supabase-js';

// The Service Role key completely bypasses Row Level Security (RLS).
// NEVER expose this key to the frontend browser. It is strictly for backend APIs.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // You must add this to your .env.local file
  );
}
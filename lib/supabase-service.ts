import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export function getSupabaseServiceClient(): SupabaseClient {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL

  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

  if (!url) {
    throw new Error(
      'Supabase URL is not configured. Set SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL.'
    )
  }
  if (!serviceKey) {
    throw new Error('Supabase service role key is not configured. Set SUPABASE_SERVICE_ROLE_KEY.')
  }

  return createClient(url, serviceKey)
}

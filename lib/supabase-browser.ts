'use client'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let browserClient: SupabaseClient | null = null

/** Browser anon Supabase client for Next dashboard (login + session for apiFetch). */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) return browserClient

  // Must be literal property reads: Next.js only inlines NEXT_PUBLIC_* into browser bundles
  // for static `process.env.NAME` references (next.config.mjs maps VITE_* onto these).
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

  if (!url || !anonKey) {
    throw new Error(
      'Supabase browser client: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or VITE_* equivalents).'
    )
  }

  browserClient = createClient(url, anonKey)
  return browserClient
}

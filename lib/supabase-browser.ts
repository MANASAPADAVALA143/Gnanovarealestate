'use client'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let browserClient: SupabaseClient | null = null

function readPublicEnv(key: string): string | undefined {
  if (typeof process !== 'undefined' && process.env?.[key]) {
    return process.env[key]
  }
  return undefined
}

/** Browser anon Supabase client for Next dashboard (login + session for apiFetch). */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) return browserClient

  const url =
    readPublicEnv('NEXT_PUBLIC_SUPABASE_URL') ||
    readPublicEnv('VITE_SUPABASE_URL') ||
    readPublicEnv('SUPABASE_URL') ||
    ''
  const anonKey =
    readPublicEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY') ||
    readPublicEnv('VITE_SUPABASE_ANON_KEY') ||
    readPublicEnv('SUPABASE_ANON_KEY') ||
    ''

  if (!url || !anonKey) {
    throw new Error(
      'Supabase browser client: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or VITE_* equivalents).'
    )
  }

  browserClient = createClient(url, anonKey)
  return browserClient
}

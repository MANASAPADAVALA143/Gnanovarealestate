'use client'

import { getSupabaseBrowserClient } from './supabase-browser'

/**
 * fetch() wrapper that attaches the Supabase session access_token as Bearer.
 * Use for all Next dashboard → /api/* calls after login.
 */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const supabase = getSupabaseBrowserClient()
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token

  const headers = new Headers(init?.headers)
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  return fetch(input, {
    ...init,
    headers,
  })
}

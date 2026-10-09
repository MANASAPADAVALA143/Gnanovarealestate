'use client'

import { getSupabaseBrowserClient } from './supabase-browser'
import { getSelectedWorkspaceSlug } from './workspace-client'
import { WORKSPACE_HEADER } from './workspaces'

/**
 * fetch() wrapper that attaches the Supabase session access_token as Bearer
 * and the selected workspace slug.
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
  if (!headers.has(WORKSPACE_HEADER)) {
    headers.set(WORKSPACE_HEADER, getSelectedWorkspaceSlug())
  }

  return fetch(input, {
    ...init,
    headers,
  })
}

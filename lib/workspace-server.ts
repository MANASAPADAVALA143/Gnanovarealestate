import type { SupabaseClient } from '@supabase/supabase-js'
import {
  DEFAULT_WORKSPACE_SLUG,
  WORKSPACE_HEADER,
  getWorkspaceConfig,
  isWorkspaceSlug,
  type WorkspaceConfig,
  type WorkspaceSlug,
} from './workspaces'

export type ResolvedWorkspace = WorkspaceConfig & { id: string }

const idCache = new Map<WorkspaceSlug, string>()
const slugCache = new Map<string, WorkspaceSlug>()

async function loadWorkspaceIds(supabase: SupabaseClient): Promise<void> {
  const { data, error } = await supabase.from('workspaces').select('id, slug')
  if (error) {
    throw new Error(
      `Workspaces are not set up (${error.message}). Run supabase/migrations/20261008000000_viseshta_avenues_workspace.sql.`
    )
  }
  for (const row of (data || []) as { id: string; slug: string }[]) {
    if (!isWorkspaceSlug(row.slug)) continue
    idCache.set(row.slug, row.id)
    slugCache.set(row.id, row.slug)
  }
}

export async function getWorkspaceBySlug(
  supabase: SupabaseClient,
  slug: string | null | undefined
): Promise<ResolvedWorkspace> {
  const config = getWorkspaceConfig(slug)
  if (!idCache.has(config.slug)) await loadWorkspaceIds(supabase)
  const id = idCache.get(config.slug)
  if (!id) throw new Error(`Workspace "${config.slug}" is missing from the workspaces table`)
  return { ...config, id }
}

export async function getWorkspaceById(
  supabase: SupabaseClient,
  workspaceId: string | null | undefined
): Promise<ResolvedWorkspace> {
  if (!workspaceId) return getWorkspaceBySlug(supabase, DEFAULT_WORKSPACE_SLUG)
  if (!slugCache.has(workspaceId)) await loadWorkspaceIds(supabase)
  return getWorkspaceBySlug(supabase, slugCache.get(workspaceId) ?? DEFAULT_WORKSPACE_SLUG)
}

/** Workspace selected in the dashboard (sent by apiFetch as the x-workspace header). */
export function getRequestWorkspace(supabase: SupabaseClient, req: Request): Promise<ResolvedWorkspace> {
  const fromHeader = req.headers.get(WORKSPACE_HEADER)
  const fromQuery = new URL(req.url).searchParams.get('workspace')
  return getWorkspaceBySlug(supabase, fromHeader || fromQuery)
}

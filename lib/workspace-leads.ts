import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizePhone } from './bulk-import-helpers'
import { getWorkspaceById, type ResolvedWorkspace } from './workspace-server'

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : v != null ? String(v).trim() : '')

export type NewLeadInput = {
  name: string
  phone: string
  email: string | null
  location: string | null
  source: string
  custom_fields: Record<string, string | number>
}

/** Validate a lead payload against the workspace's field definitions and source tags. */
export function parseLeadInput(
  workspace: ResolvedWorkspace,
  body: Record<string, unknown>,
  defaultSource = 'manual'
): NewLeadInput | { error: string } {
  const name = str(body.name)
  const phone = normalizePhone(str(body.phone))
  if (!name) return { error: 'Name is required' }
  if (!phone || phone.length < 8) return { error: 'A valid phone number is required' }

  let source = str(body.source)
  if (workspace.sourceTags && source) {
    const tag = workspace.sourceTags.find((t) => t.toLowerCase() === source.toLowerCase())
    if (!tag) return { error: `Source must be one of: ${workspace.sourceTags.join(', ')}` }
    source = tag
  }

  const rawCustom = (body.custom_fields ?? {}) as Record<string, unknown>
  const custom_fields: Record<string, string | number> = {}
  for (const field of workspace.leadFields) {
    if (!field.customKey) continue
    const value = str(rawCustom[field.customKey])
    if (!value) continue
    if (field.type === 'number') {
      const n = Number(value)
      if (!Number.isFinite(n) || n < 0) return { error: `${field.label} must be a number` }
      custom_fields[field.customKey] = n
    } else {
      custom_fields[field.customKey] = value
    }
  }

  return {
    name,
    phone,
    email: str(body.email) || null,
    location: str(body.location) || null,
    source: source || defaultSource,
    custom_fields,
  }
}

export type InsertLeadResult =
  | { lead: { id: string; agent_id: string | null } }
  | { conflict: { leadId: string; workspaceName: string } }

/** Insert a new lead into a workspace. `leads.phone` is globally unique, so an existing phone is a conflict. */
export async function insertWorkspaceLead(
  supabase: SupabaseClient,
  workspace: ResolvedWorkspace,
  input: NewLeadInput,
  agentId: string | null
): Promise<InsertLeadResult> {
  const { data: existing } = await supabase
    .from('leads')
    .select('id, workspace_id')
    .eq('phone', input.phone)
    .maybeSingle()
  if (existing) {
    const row = existing as { id: string; workspace_id: string | null }
    const owner = await getWorkspaceById(supabase, row.workspace_id)
    return { conflict: { leadId: row.id, workspaceName: owner.name } }
  }

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('leads')
    .insert({
      ...input,
      workspace_id: workspace.id,
      agent_id: agentId,
      status: 'new',
      pipeline_stage: 'new',
      created_at: now,
      updated_at: now,
    })
    .select('id, agent_id')
    .single()

  if (error) throw new Error(error.message)
  return { lead: data as { id: string; agent_id: string | null } }
}

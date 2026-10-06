import type { SupabaseClient } from '@supabase/supabase-js'
import { applyAgentClaimPoolFilter } from './campaign-query'

export async function findAccessibleLead(
  supabase: SupabaseClient,
  leadId: string,
  agentId: string,
  columns = '*'
) {
  let q = supabase.from('leads').select(columns).eq('id', leadId)
  q = applyAgentClaimPoolFilter(q, agentId)
  const { data, error } = await q.maybeSingle()
  if (error) throw new Error(error.message)
  return data as Record<string, unknown> | null
}

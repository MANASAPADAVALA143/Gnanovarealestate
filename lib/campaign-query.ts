import type { SupabaseClient } from '@supabase/supabase-js'

export type CampaignScoreFilter =
  | 'all'
  | 'unscored'
  | 'hot'
  | 'warm'
  | 'cold'

export type CampaignFilters = {
  location: string
  scoreFilter: CampaignScoreFilter
  maxContacts: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyLeadFilters(q: any, filters: CampaignFilters): any {
  let query = q
  const loc = filters.location?.trim()
  if (loc) {
    // Dropdown uses distinct `leads.location` values — exact match keeps filters predictable.
    query = query.eq('location', loc)
  }

  switch (filters.scoreFilter) {
    case 'unscored':
      query = query.is('lead_score', null)
      break
    case 'hot':
      query = query.gte('lead_score', 80)
      break
    case 'warm':
      query = query.gte('lead_score', 50).lt('lead_score', 80)
      break
    case 'cold':
      query = query.not('lead_score', 'is', null).lt('lead_score', 50)
      break
    default:
      break
  }
  return query
}

export async function fetchMatchingLeadIds(
  supabase: SupabaseClient,
  filters: CampaignFilters
): Promise<string[]> {
  const cap = Math.min(Math.max(1, filters.maxContacts), 100_000)
  let q = supabase.from('leads').select('id').order('created_at', { ascending: false }).limit(cap)
  q = applyLeadFilters(q, filters)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data || []).map((r: { id: string }) => r.id)
}

export async function countMatchingLeads(
  supabase: SupabaseClient,
  filters: CampaignFilters
): Promise<number> {
  const cap = Math.min(Math.max(1, filters.maxContacts), 100_000)
  let q = supabase.from('leads').select('id', { count: 'exact', head: true })
  q = applyLeadFilters(q, filters)
  const { count, error } = await q
  if (error) throw new Error(error.message)
  const raw = count ?? 0
  return Math.min(raw, cap)
}

export async function previewMatchingLeads(
  supabase: SupabaseClient,
  filters: CampaignFilters,
  previewLimit: number
): Promise<
  {
    id: string
    name: string
    phone: string
    location: string | null
    lead_score: number | null
    score_label: string | null
  }[]
> {
  const cap = Math.min(Math.max(1, filters.maxContacts), 100_000)
  let q = supabase
    .from('leads')
    .select('id,name,phone,location,lead_score,score_label')
    .order('created_at', { ascending: false })
    .limit(Math.min(cap, previewLimit))
  q = applyLeadFilters(q, filters)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data || []) as {
    id: string
    name: string
    phone: string
    location: string | null
    lead_score: number | null
    score_label: string | null
  }[]
}

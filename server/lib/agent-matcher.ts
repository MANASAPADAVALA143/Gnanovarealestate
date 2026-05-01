import type { SupabaseClient } from '@supabase/supabase-js'

export interface MatchInput {
  zip_code?: string
  specialty_tags?: string[]
}

type WorkloadRow = {
  id: string
  full_name: string | null
  zip_codes: string[] | null
  specialty_tags: string[] | null
  max_leads: number | null
  is_available: boolean | null
  active_lead_count: number
}

function normaliseZip(z: string): string {
  return String(z || '').replace(/\D/g, '')
}

function zipMatches(agentZips: string[] | null | undefined, needle: string): boolean {
  const n = normaliseZip(needle)
  if (!n) return false
  if (!agentZips || !Array.isArray(agentZips)) return false
  return agentZips.some((z) => {
    const zd = normaliseZip(String(z))
    return zd === n || zd.endsWith(n) || n.endsWith(zd)
  })
}

function tagMatches(agentTags: string[] | null | undefined, wanted: string[]): boolean {
  if (!agentTags?.length || !wanted.length) return false
  const lower = agentTags.map((t) => String(t).toLowerCase())
  return wanted.some((t) => lower.includes(String(t).toLowerCase()))
}

export function extractZip(location?: string): string | undefined {
  if (!location) return undefined
  const match = location.match(/\b\d{5,6}\b/)
  return match ? match[0] : undefined
}

export async function matchAgent(supabase: SupabaseClient, input: MatchInput): Promise<string | null> {
  const { data: agents, error } = await supabase.from('agent_workload').select('*').eq('is_available', true)

  if (error) {
    console.error('[agent-matcher] agent_workload query failed:', error.message)
    return null
  }
  if (!agents?.length) return null

  const rows = agents as WorkloadRow[]
  const eligible = rows.filter((a) => (a.active_lead_count ?? 0) < (a.max_leads ?? 50))
  if (eligible.length === 0) return null

  if (input.zip_code) {
    const zipMatch = eligible.filter((a) => zipMatches(a.zip_codes, input.zip_code!))
    if (zipMatch.length > 0) {
      zipMatch.sort((a, b) => (a.active_lead_count ?? 0) - (b.active_lead_count ?? 0))
      return zipMatch[0].id
    }
  }

  if (input.specialty_tags && input.specialty_tags.length > 0) {
    const tagMatch = eligible.filter((a) => tagMatches(a.specialty_tags, input.specialty_tags!))
    if (tagMatch.length > 0) {
      tagMatch.sort((a, b) => (a.active_lead_count ?? 0) - (b.active_lead_count ?? 0))
      return tagMatch[0].id
    }
  }

  eligible.sort((a, b) => (a.active_lead_count ?? 0) - (b.active_lead_count ?? 0))
  const lowest = eligible[0].active_lead_count ?? 0
  const tied = eligible.filter((a) => (a.active_lead_count ?? 0) === lowest)
  if (tied.length === 1) return tied[0].id

  const { data: rr } = await supabase.from('agent_round_robin').select('last_index').eq('id', 1).maybeSingle()
  const last = typeof rr?.last_index === 'number' ? rr.last_index : 0
  const nextIndex = (last + 1) % tied.length

  await supabase.from('agent_round_robin').update({ last_index: nextIndex }).eq('id', 1)

  return tied[nextIndex].id
}

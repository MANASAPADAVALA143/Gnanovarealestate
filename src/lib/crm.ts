import { supabase } from './supabase'

export const PIPELINE_STAGES = [
  'new',
  'contacted',
  'qualified',
  'viewing_scheduled',
  'viewing_done',
  'negotiation',
  'booked',
  'closed',
  'lost',
] as const

export type PipelineStage = (typeof PIPELINE_STAGES)[number]

export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  viewing_scheduled: 'Viewing Scheduled',
  viewing_done: 'Viewing Done',
  negotiation: 'Negotiation',
  booked: 'Booked',
  closed: 'Closed',
  lost: 'Lost',
}

export type LeadActivityType =
  | 'call'
  | 'whatsapp'
  | 'email'
  | 'note'
  | 'stage_change'
  | 'viewing'
  | 'task'

export type LeadActivity = {
  id: string
  lead_id: string
  type: LeadActivityType
  content: string
  created_at: string
  created_by: string | null
}

export type LeadTask = {
  id: string
  lead_id: string
  agent_id: string | null
  due_at: string
  type: string
  status: 'pending' | 'completed' | 'cancelled'
  created_at: string
  leads?: {
    id: string
    name: string
    phone: string
    source: string | null
    interested_in: string | null
    property_address: string | null
  } | null
}

export type LeadConsent = {
  id: string
  lead_id: string
  source: string
  channel: string
  consent_text: string
  opted_in: boolean
  timestamp: string
  ip_address: string | null
}

export type PipelineLead = {
  id: string
  name: string
  source: string | null
  agent_id: string | null
  pipeline_stage: PipelineStage
  interested_in: string | null
  property_address: string | null
  updated_at: string
  agents?: { full_name: string | null } | null
  last_activity_at?: string | null
}

export async function fetchPipelineLeads(agentId: string): Promise<PipelineLead[]> {
  const { data, error } = await supabase
    .from('leads')
    .select(
      'id, name, source, agent_id, pipeline_stage, interested_in, property_address, updated_at, agents(full_name)'
    )
    .eq('agent_id', agentId)
    .order('updated_at', { ascending: false })

  if (error) throw error

  const leads = (data || []) as PipelineLead[]
  if (leads.length === 0) return []

  const leadIds = leads.map((l) => l.id)
  const { data: activities } = await supabase
    .from('lead_activities')
    .select('lead_id, created_at')
    .in('lead_id', leadIds)
    .order('created_at', { ascending: false })

  const lastByLead = new Map<string, string>()
  for (const row of activities || []) {
    const r = row as { lead_id: string; created_at: string }
    if (!lastByLead.has(r.lead_id)) {
      lastByLead.set(r.lead_id, r.created_at)
    }
  }

  return leads.map((l) => ({
    ...l,
    pipeline_stage: (l.pipeline_stage || 'new') as PipelineStage,
    last_activity_at: lastByLead.get(l.id) || l.updated_at,
  }))
}

export async function updateLeadPipelineStage(
  leadId: string,
  stage: PipelineStage
): Promise<void> {
  const { error } = await supabase
    .from('leads')
    .update({ pipeline_stage: stage, updated_at: new Date().toISOString() } as never)
    .eq('id', leadId)

  if (error) throw error
}

export async function fetchLeadActivities(leadId: string): Promise<LeadActivity[]> {
  const { data, error } = await supabase
    .from('lead_activities')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []) as LeadActivity[]
}

export async function addLeadNote(
  leadId: string,
  content: string,
  agentId?: string | null
): Promise<void> {
  const { error } = await supabase.from('lead_activities').insert({
    lead_id: leadId,
    type: 'note',
    content,
    created_by: agentId ?? null,
  } as never)

  if (error) throw error
}

export async function fetchLeadConsent(leadId: string): Promise<LeadConsent | null> {
  const { data, error } = await supabase
    .from('lead_consent')
    .select('*')
    .eq('lead_id', leadId)
    .order('timestamp', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data as LeadConsent | null
}

export async function fetchLeadTasks(
  agentId: string,
  filterAgentId?: string | null
): Promise<LeadTask[]> {
  let q = supabase
    .from('lead_tasks')
    .select(
      'id, lead_id, agent_id, due_at, type, status, created_at, leads(id, name, phone, source, interested_in, property_address)'
    )
    .eq('status', 'pending')
    .order('due_at', { ascending: true })

  const targetAgent = filterAgentId || agentId
  if (targetAgent) {
    q = q.eq('agent_id', targetAgent)
  }

  const { data, error } = await q
  if (error) throw error
  return (data || []) as LeadTask[]
}

export async function completeLeadTask(
  taskId: string,
  leadId: string,
  agentId?: string | null
): Promise<void> {
  const { error: taskError } = await supabase
    .from('lead_tasks')
    .update({ status: 'completed' } as never)
    .eq('id', taskId)

  if (taskError) throw taskError

  const { error: activityError } = await supabase.from('lead_activities').insert({
    lead_id: leadId,
    type: 'task',
    content: 'Follow-up task marked complete',
    created_by: agentId ?? null,
  } as never)

  if (activityError) throw activityError
}

export type AgentOverdueCount = {
  agent_id: string
  full_name: string | null
  overdue_count: number
}

export async function fetchOverdueFollowUpsByAgent(): Promise<AgentOverdueCount[]> {
  const now = new Date().toISOString()

  const { data: tasks, error } = await supabase
    .from('lead_tasks')
    .select('agent_id, agents(full_name)')
    .eq('status', 'pending')
    .lt('due_at', now)

  if (error) throw error

  const counts = new Map<string, { full_name: string | null; count: number }>()
  for (const row of tasks || []) {
    const r = row as { agent_id: string | null; agents: { full_name: string | null } | null }
    if (!r.agent_id) continue
    const existing = counts.get(r.agent_id)
    if (existing) {
      existing.count += 1
    } else {
      counts.set(r.agent_id, { full_name: r.agents?.full_name ?? null, count: 1 })
    }
  }

  return Array.from(counts.entries())
    .map(([agent_id, { full_name, count }]) => ({
      agent_id,
      full_name,
      overdue_count: count,
    }))
    .sort((a, b) => b.overdue_count - a.overdue_count)
}

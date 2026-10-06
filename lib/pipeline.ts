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

export function isPipelineStage(value: string): value is PipelineStage {
  return (PIPELINE_STAGES as readonly string[]).includes(value)
}

export const TASK_TYPES = ['follow_up_24h', 'follow_up_48h', 'viewing_reminder', 'custom'] as const
export type LeadTaskType = (typeof TASK_TYPES)[number]

export const TASK_TYPE_LABELS: Record<LeadTaskType, string> = {
  follow_up_24h: 'Follow-up 24h',
  follow_up_48h: 'Follow-up 48h',
  viewing_reminder: 'Viewing reminder',
  custom: 'Custom',
}

export function isLeadTaskType(value: string): value is LeadTaskType {
  return (TASK_TYPES as readonly string[]).includes(value)
}

export function formatAed(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(Number(amount))) return '—'
  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: 'AED',
    maximumFractionDigits: 0,
  }).format(Number(amount))
}

export const DEAL_STAGES = [
  'viewing',
  'offer',
  'booking',
  'mou_signed',
  'spa_signed',
  'closed_won',
  'closed_lost',
] as const

export type DealStage = (typeof DEAL_STAGES)[number]

export const DEAL_STAGE_LABELS: Record<DealStage, string> = {
  viewing: 'Viewing',
  offer: 'Offer',
  booking: 'Booking',
  mou_signed: 'MOU Signed',
  spa_signed: 'SPA Signed',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
}

export function isDealStage(value: string): value is DealStage {
  return (DEAL_STAGES as readonly string[]).includes(value)
}

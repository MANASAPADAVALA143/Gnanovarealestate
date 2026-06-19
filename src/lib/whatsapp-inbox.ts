function webhookBaseUrl(): string {
  if (typeof import.meta !== 'undefined') {
    const env = (import.meta as ImportMeta & { env?: Record<string, string> }).env
    const fromEnv = env?.VITE_WEBHOOK_URL?.replace(/\/$/, '')
    if (fromEnv) return fromEnv
  }
  return 'http://localhost:3001'
}

const WEBHOOK_BASE = webhookBaseUrl()

export const WHATSAPP_THREAD_STATUSES = [
  'unassigned',
  'bot_handling',
  'agent_handling',
  'closed',
] as const

export type WhatsAppThreadStatus = (typeof WHATSAPP_THREAD_STATUSES)[number]

export const WHATSAPP_THREAD_STATUS_LABELS: Record<WhatsAppThreadStatus, string> = {
  unassigned: 'Unassigned',
  bot_handling: 'Bot',
  agent_handling: 'Agent',
  closed: 'Closed',
}

export const WHATSAPP_THREAD_STATUS_BADGE: Record<
  WhatsAppThreadStatus,
  { bg: string; text: string; border: string }
> = {
  unassigned: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
  bot_handling: { bg: 'bg-sky-50', text: 'text-sky-800', border: 'border-sky-200' },
  agent_handling: { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' },
  closed: { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' },
}

export type WhatsAppThreadRow = {
  id: string
  lead_id: string | null
  phone_number: string
  assigned_agent_id: string | null
  status: WhatsAppThreadStatus
  last_message_at: string | null
  last_message_preview: string | null
  unread_count: number
  created_at: string
  updated_at: string
  leads?: { name: string; phone: string | null } | null
  agents?: { full_name: string | null } | null
}

export type WhatsAppThreadMessageRow = {
  id: string
  thread_id: string
  direction: 'inbound' | 'outbound'
  sender_type: 'lead' | 'bot' | 'agent'
  sender_agent_id: string | null
  body: string
  media_url: string | null
  twilio_message_sid: string | null
  created_at: string
}

export type WhatsAppInternalNoteRow = {
  id: string
  thread_id: string
  agent_id: string
  note_text: string
  created_at: string
  agents?: { full_name: string | null } | null
}

export function threadDisplayName(thread: WhatsAppThreadRow): string {
  return thread.leads?.name?.trim() || thread.phone_number
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${WEBHOOK_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(json.error || `Request failed (${res.status})`)
  }
  return json as T
}

export async function fetchWhatsAppThreads(params?: {
  status?: WhatsAppThreadStatus
  assigned_agent_id?: string
}): Promise<WhatsAppThreadRow[]> {
  const q = new URLSearchParams()
  if (params?.status) q.set('status', params.status)
  if (params?.assigned_agent_id) q.set('assigned_agent_id', params.assigned_agent_id)
  const suffix = q.toString()
  const data = await apiFetch<{ threads: WhatsAppThreadRow[] }>(
    `/api/whatsapp/threads${suffix ? `?${suffix}` : ''}`
  )
  return data.threads
}

export async function fetchWhatsAppThread(id: string): Promise<{
  thread: WhatsAppThreadRow
  messages: WhatsAppThreadMessageRow[]
  notes: WhatsAppInternalNoteRow[]
}> {
  return apiFetch(`/api/whatsapp/threads/${id}`)
}

export async function assignWhatsAppThread(
  id: string,
  agentId: string,
  actingAgentId?: string
): Promise<WhatsAppThreadRow> {
  const data = await apiFetch<{ thread: WhatsAppThreadRow }>(`/api/whatsapp/threads/${id}/assign`, {
    method: 'POST',
    body: JSON.stringify({
      agent_id: agentId,
      acting_agent_id: actingAgentId ?? agentId,
    }),
  })
  return data.thread
}

export async function replyWhatsAppThread(
  id: string,
  agentId: string,
  body: string
): Promise<{ thread: WhatsAppThreadRow; message: WhatsAppThreadMessageRow }> {
  return apiFetch(`/api/whatsapp/threads/${id}/reply`, {
    method: 'POST',
    body: JSON.stringify({ agent_id: agentId, body }),
  })
}

export async function addWhatsAppThreadNote(
  id: string,
  agentId: string,
  noteText: string
): Promise<WhatsAppInternalNoteRow> {
  const data = await apiFetch<{ note: WhatsAppInternalNoteRow }>(`/api/whatsapp/threads/${id}/notes`, {
    method: 'POST',
    body: JSON.stringify({ agent_id: agentId, note_text: noteText }),
  })
  return data.note
}

export async function closeWhatsAppThread(id: string): Promise<WhatsAppThreadRow> {
  const data = await apiFetch<{ thread: WhatsAppThreadRow }>(`/api/whatsapp/threads/${id}/close`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
  return data.thread
}

import { supabase } from './supabase'

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

export async function fetchWhatsAppThreads(params?: {
  status?: WhatsAppThreadStatus
  assigned_agent_id?: string
}): Promise<WhatsAppThreadRow[]> {
  let q = supabase
    .from('whatsapp_threads')
    .select('*, leads(name, phone), agents(full_name)')
    .order('last_message_at', { ascending: false })

  if (params?.status) q = q.eq('status', params.status) as typeof q
  if (params?.assigned_agent_id) q = q.eq('assigned_agent_id', params.assigned_agent_id) as typeof q

  const { data, error } = await q
  if (error) throw error
  return (data || []) as WhatsAppThreadRow[]
}

export async function fetchWhatsAppThread(id: string): Promise<{
  thread: WhatsAppThreadRow
  messages: WhatsAppThreadMessageRow[]
  notes: WhatsAppInternalNoteRow[]
}> {
  const [threadRes, messagesRes, notesRes] = await Promise.all([
    supabase
      .from('whatsapp_threads')
      .select('*, leads(name, phone), agents(full_name)')
      .eq('id', id)
      .single(),
    supabase
      .from('whatsapp_thread_messages')
      .select('*')
      .eq('thread_id', id)
      .order('created_at', { ascending: true }),
    supabase
      .from('whatsapp_internal_notes')
      .select('*, agents(full_name)')
      .eq('thread_id', id)
      .order('created_at', { ascending: true }),
  ])

  if (threadRes.error) throw threadRes.error
  return {
    thread: threadRes.data as WhatsAppThreadRow,
    messages: (messagesRes.data || []) as WhatsAppThreadMessageRow[],
    notes: (notesRes.data || []) as WhatsAppInternalNoteRow[],
  }
}

export async function assignWhatsAppThread(
  id: string,
  agentId: string,
): Promise<WhatsAppThreadRow> {
  const { data, error } = await supabase
    .from('whatsapp_threads')
    .update({ assigned_agent_id: agentId, status: 'agent_handling', updated_at: new Date().toISOString() } as never)
    .eq('id', id)
    .select('*, leads(name, phone), agents(full_name)')
    .single()

  if (error) throw error
  return data as WhatsAppThreadRow
}

export async function replyWhatsAppThread(
  id: string,
  agentId: string,
  body: string
): Promise<{ thread: WhatsAppThreadRow; message: WhatsAppThreadMessageRow }> {
  const now = new Date().toISOString()

  // Get thread phone number for WhatsApp delivery
  const { data: threadData } = await supabase
    .from('whatsapp_threads')
    .select('phone_number')
    .eq('id', id)
    .single()

  const { data: msg, error: msgError } = await supabase
    .from('whatsapp_thread_messages')
    .insert({
      thread_id: id,
      direction: 'outbound',
      sender_type: 'agent',
      sender_agent_id: agentId,
      body,
    } as never)
    .select('*')
    .single()

  if (msgError) throw msgError

  const { data: thread, error: threadError } = await supabase
    .from('whatsapp_threads')
    .update({ last_message_at: now, last_message_preview: body, updated_at: now } as never)
    .eq('id', id)
    .select('*, leads(name, phone), agents(full_name)')
    .single()

  if (threadError) throw threadError

  // Deliver via WhatsApp Cloud API through Edge Function
  if (threadData?.phone_number) {
    const to = threadData.phone_number.replace('+', '')
    try {
      await fetch('https://mhdnoufdloigblgcypjl.supabase.co/functions/v1/whatsapp-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, message: body }),
      })
    } catch {
      // Non-fatal: message saved to CRM even if WhatsApp delivery fails
    }
  }

  return { thread: thread as WhatsAppThreadRow, message: msg as WhatsAppThreadMessageRow }
}

export async function addWhatsAppThreadNote(
  id: string,
  agentId: string,
  noteText: string
): Promise<WhatsAppInternalNoteRow> {
  const { data, error } = await supabase
    .from('whatsapp_internal_notes')
    .insert({ thread_id: id, agent_id: agentId, note_text: noteText } as never)
    .select('*, agents(full_name)')
    .single()

  if (error) throw error
  return data as WhatsAppInternalNoteRow
}

export async function closeWhatsAppThread(id: string): Promise<WhatsAppThreadRow> {
  const { data, error } = await supabase
    .from('whatsapp_threads')
    .update({ status: 'closed', updated_at: new Date().toISOString() } as never)
    .eq('id', id)
    .select('*, leads(name, phone), agents(full_name)')
    .single()

  if (error) throw error
  return data as WhatsAppThreadRow
}

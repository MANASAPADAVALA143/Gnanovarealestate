import twilio from 'twilio'
import type { Request, Response } from 'express'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { MatchedLead } from './whatsapp-inbound.ts'

function stripWhatsAppPrefix(from: string): string {
  return from.replace(/^whatsapp:/i, '').trim()
}

export const WHATSAPP_THREAD_STATUSES = [
  'unassigned',
  'bot_handling',
  'agent_handling',
  'closed',
] as const

export type WhatsAppThreadStatus = (typeof WHATSAPP_THREAD_STATUSES)[number]

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

let twilioClient: ReturnType<typeof twilio> | null | undefined

function getTwilioClient(): ReturnType<typeof twilio> | null {
  if (twilioClient === undefined) {
    const sid = process.env.TWILIO_ACCOUNT_SID
    const token = process.env.TWILIO_AUTH_TOKEN
    twilioClient = sid && token ? twilio(sid, token) : null
  }
  return twilioClient
}

function whatsappAddress(phone: string): string {
  return phone.startsWith('whatsapp:') ? phone : `whatsapp:${phone}`
}

function normalizeFromAddress(fromEnv: string | undefined): string | null {
  if (!fromEnv?.trim()) return null
  const t = fromEnv.trim()
  return t.startsWith('whatsapp:') ? t : `whatsapp:${t}`
}

function isThreadStatus(value: string): value is WhatsAppThreadStatus {
  return (WHATSAPP_THREAD_STATUSES as readonly string[]).includes(value)
}

export function shouldAutoReply(status: WhatsAppThreadStatus): boolean {
  return status === 'unassigned' || status === 'bot_handling'
}

async function isManager(supabase: SupabaseClient, agentId: string | null): Promise<boolean> {
  if (!agentId) return false
  const { data } = await supabase
    .from('agents')
    .select('is_manager')
    .eq('id', agentId)
    .maybeSingle()
  return Boolean((data as { is_manager?: boolean } | null)?.is_manager)
}

export async function sendWhatsAppOutbound(toRaw: string, body: string): Promise<string | null> {
  const client = getTwilioClient()
  const from = normalizeFromAddress(process.env.TWILIO_WHATSAPP_FROM)
  if (!client || !from) {
    console.warn('[whatsapp-inbox] Twilio not configured — cannot send outbound message')
    return null
  }

  const to = whatsappAddress(stripWhatsAppPrefix(toRaw))
  try {
    const msg = await client.messages.create({ body, from, to })
    return msg.sid
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[whatsapp-inbox] Twilio send failed:', message)
    throw new Error(message)
  }
}

async function findThreadByPhone(
  supabase: SupabaseClient,
  phoneNumber: string
): Promise<WhatsAppThreadRow | null> {
  const { data, error } = await supabase
    .from('whatsapp_threads')
    .select('*')
    .eq('phone_number', phoneNumber)
    .maybeSingle()

  if (error) {
    console.error('[whatsapp-inbox] thread lookup error:', error.message)
    return null
  }
  return data as WhatsAppThreadRow | null
}

async function findThreadById(
  supabase: SupabaseClient,
  threadId: string
): Promise<WhatsAppThreadRow | null> {
  const { data, error } = await supabase
    .from('whatsapp_threads')
    .select('*')
    .eq('id', threadId)
    .maybeSingle()

  if (error) {
    console.error('[whatsapp-inbox] thread fetch error:', error.message)
    return null
  }
  return data as WhatsAppThreadRow | null
}

async function messageExistsBySid(
  supabase: SupabaseClient,
  messageSid: string
): Promise<boolean> {
  if (!messageSid) return false
  const { data } = await supabase
    .from('whatsapp_thread_messages')
    .select('id')
    .eq('twilio_message_sid', messageSid)
    .maybeSingle()
  return Boolean(data)
}

export type InboxInboundParams = {
  phoneNumber: string
  body: string
  messageSid: string
  mediaUrl?: string | null
  lead: MatchedLead | null
}

export type InboxInboundResult = {
  thread: WhatsAppThreadRow
  duplicate: boolean
}

/** Find-or-create thread and log inbound lead message (deduped by Twilio SID). */
export async function recordInboundToInbox(
  supabase: SupabaseClient,
  params: InboxInboundParams
): Promise<InboxInboundResult> {
  const phoneNumber = stripWhatsAppPrefix(params.phoneNumber)
  if (!phoneNumber) {
    throw new Error('phone_number is required')
  }

  if (params.messageSid && (await messageExistsBySid(supabase, params.messageSid))) {
    const existingThread = await findThreadByPhone(supabase, phoneNumber)
    if (!existingThread) {
      throw new Error('Duplicate message SID but thread missing')
    }
    return { thread: existingThread, duplicate: true }
  }

  let thread = await findThreadByPhone(supabase, phoneNumber)

  if (!thread) {
    const { data: created, error } = await supabase
      .from('whatsapp_threads')
      .insert({
        phone_number: phoneNumber,
        lead_id: params.lead?.id ?? null,
        assigned_agent_id: params.lead?.agent_id ?? null,
        status: 'unassigned',
      } as never)
      .select('*')
      .single()

    if (error || !created) {
      throw new Error(error?.message ?? 'Failed to create WhatsApp thread')
    }
    thread = created as WhatsAppThreadRow
  } else {
    const patch: Record<string, unknown> = {}
    if (!thread.lead_id && params.lead?.id) patch.lead_id = params.lead.id
    if (!thread.assigned_agent_id && params.lead?.agent_id) {
      patch.assigned_agent_id = params.lead.agent_id
    }
    if (Object.keys(patch).length > 0) {
      const { data: updated, error } = await supabase
        .from('whatsapp_threads')
        .update(patch as never)
        .eq('id', thread.id)
        .select('*')
        .single()
      if (!error && updated) thread = updated as WhatsAppThreadRow
    }
  }

  const { error: msgError } = await supabase.from('whatsapp_thread_messages').insert({
    thread_id: thread.id,
    direction: 'inbound',
    sender_type: 'lead',
    body: params.body || '',
    media_url: params.mediaUrl ?? null,
    twilio_message_sid: params.messageSid || null,
  } as never)

  if (msgError) {
    if (msgError.code === '23505' && params.messageSid) {
      return { thread, duplicate: true }
    }
    throw new Error(msgError.message)
  }

  const { data: refreshed } = await supabase
    .from('whatsapp_threads')
    .select('*')
    .eq('id', thread.id)
    .single()

  return { thread: (refreshed as WhatsAppThreadRow) || thread, duplicate: false }
}

export async function recordBotReplyToInbox(
  supabase: SupabaseClient,
  threadId: string,
  body: string,
  twilioSid: string | null
): Promise<void> {
  const { error: msgError } = await supabase.from('whatsapp_thread_messages').insert({
    thread_id: threadId,
    direction: 'outbound',
    sender_type: 'bot',
    body,
    twilio_message_sid: twilioSid,
  } as never)

  if (msgError) {
    console.error('[whatsapp-inbox] bot message insert failed:', msgError.message)
  }

  const { error: statusError } = await supabase
    .from('whatsapp_threads')
    .update({ status: 'bot_handling' } as never)
    .eq('id', threadId)
    .in('status', ['unassigned', 'bot_handling'])

  if (statusError) {
    console.error('[whatsapp-inbox] bot_handling status update failed:', statusError.message)
  }
}

export async function listThreadsHandler(
  supabase: SupabaseClient,
  req: Request,
  res: Response
): Promise<void> {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined
    const assignedAgentId =
      typeof req.query.assigned_agent_id === 'string' ? req.query.assigned_agent_id : undefined

    if (status && !isThreadStatus(status)) {
      res.status(400).json({ error: 'Invalid status filter' })
      return
    }

    let query = supabase
      .from('whatsapp_threads')
      .select('*, leads(name, phone), agents:assigned_agent_id(full_name)')
      .order('last_message_at', { ascending: false, nullsFirst: false })

    if (status) query = query.eq('status', status)
    if (assignedAgentId) query = query.eq('assigned_agent_id', assignedAgentId)

    const { data, error } = await query

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.json({ threads: (data as WhatsAppThreadRow[]) || [] })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[whatsapp-inbox] listThreads:', err)
    res.status(500).json({ error: message })
  }
}

export async function getThreadHandler(
  supabase: SupabaseClient,
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params
    const markRead = req.query.mark_read !== 'false'

    const { data: thread, error: threadError } = await supabase
      .from('whatsapp_threads')
      .select('*, leads(name, phone), agents:assigned_agent_id(full_name)')
      .eq('id', id)
      .maybeSingle()

    if (threadError) {
      res.status(500).json({ error: threadError.message })
      return
    }
    if (!thread) {
      res.status(404).json({ error: 'Thread not found' })
      return
    }

    const { data: messages, error: msgError } = await supabase
      .from('whatsapp_thread_messages')
      .select('*')
      .eq('thread_id', id)
      .order('created_at', { ascending: true })

    if (msgError) {
      res.status(500).json({ error: msgError.message })
      return
    }

    const { data: notes, error: notesError } = await supabase
      .from('whatsapp_internal_notes')
      .select('*, agents(full_name)')
      .eq('thread_id', id)
      .order('created_at', { ascending: true })

    if (notesError) {
      res.status(500).json({ error: notesError.message })
      return
    }

    if (markRead && (thread as WhatsAppThreadRow).unread_count > 0) {
      await supabase.from('whatsapp_threads').update({ unread_count: 0 } as never).eq('id', id)
      ;(thread as WhatsAppThreadRow).unread_count = 0
    }

    res.json({
      thread: thread as WhatsAppThreadRow,
      messages: (messages as WhatsAppThreadMessageRow[]) || [],
      notes: (notes as WhatsAppInternalNoteRow[]) || [],
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[whatsapp-inbox] getThread:', err)
    res.status(500).json({ error: message })
  }
}

export async function assignThreadHandler(
  supabase: SupabaseClient,
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params
    const body = req.body || {}
    const targetAgentId = String(body.agent_id || '').trim()
    const actingAgentId = String(body.acting_agent_id || body.agent_id || '').trim()

    if (!targetAgentId) {
      res.status(400).json({ error: 'agent_id is required' })
      return
    }

    const thread = await findThreadById(supabase, id)
    if (!thread) {
      res.status(404).json({ error: 'Thread not found' })
      return
    }

    const reassigning =
      thread.assigned_agent_id != null && thread.assigned_agent_id !== targetAgentId

    if (reassigning) {
      const allowed =
        actingAgentId === targetAgentId ||
        (await isManager(supabase, actingAgentId)) ||
        thread.assigned_agent_id === actingAgentId
      if (!allowed) {
        res.status(403).json({ error: 'Only managers or the current assignee can reassign threads' })
        return
      }
      if (targetAgentId !== actingAgentId && !(await isManager(supabase, actingAgentId))) {
        res.status(403).json({ error: 'Reassigning to another agent requires manager access' })
        return
      }
    }

    const { data: updated, error } = await supabase
      .from('whatsapp_threads')
      .update({ assigned_agent_id: targetAgentId } as never)
      .eq('id', id)
      .select('*, leads(name, phone), agents:assigned_agent_id(full_name)')
      .single()

    if (error || !updated) {
      res.status(500).json({ error: error?.message ?? 'Assign failed' })
      return
    }

    res.json({ thread: updated as WhatsAppThreadRow })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[whatsapp-inbox] assignThread:', err)
    res.status(500).json({ error: message })
  }
}

export async function replyThreadHandler(
  supabase: SupabaseClient,
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params
    const body = req.body || {}
    const agentId = String(body.agent_id || '').trim()
    const text = String(body.body || '').trim()

    if (!agentId) {
      res.status(400).json({ error: 'agent_id is required' })
      return
    }
    if (!text) {
      res.status(400).json({ error: 'body is required' })
      return
    }

    const thread = await findThreadById(supabase, id)
    if (!thread) {
      res.status(404).json({ error: 'Thread not found' })
      return
    }

    if (
      thread.assigned_agent_id &&
      thread.assigned_agent_id !== agentId &&
      !(await isManager(supabase, agentId))
    ) {
      res.status(403).json({ error: 'Thread is assigned to another agent' })
      return
    }

    const twilioSid = await sendWhatsAppOutbound(thread.phone_number, text)

    const { data: message, error: msgError } = await supabase
      .from('whatsapp_thread_messages')
      .insert({
        thread_id: id,
        direction: 'outbound',
        sender_type: 'agent',
        sender_agent_id: agentId,
        body: text,
        twilio_message_sid: twilioSid,
      } as never)
      .select('*')
      .single()

    if (msgError || !message) {
      res.status(500).json({ error: msgError?.message ?? 'Failed to save reply' })
      return
    }

    const patch: Record<string, unknown> = {
      status: 'agent_handling',
      assigned_agent_id: thread.assigned_agent_id ?? agentId,
    }

    const { data: updatedThread, error: threadError } = await supabase
      .from('whatsapp_threads')
      .update(patch as never)
      .eq('id', id)
      .select('*, leads(name, phone), agents:assigned_agent_id(full_name)')
      .single()

    if (threadError) {
      res.status(500).json({ error: threadError.message })
      return
    }

    res.json({
      thread: updatedThread as WhatsAppThreadRow,
      message: message as WhatsAppThreadMessageRow,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[whatsapp-inbox] replyThread:', err)
    res.status(500).json({ error: message })
  }
}

export async function addThreadNoteHandler(
  supabase: SupabaseClient,
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params
    const body = req.body || {}
    const agentId = String(body.agent_id || '').trim()
    const noteText = String(body.note_text || '').trim()

    if (!agentId) {
      res.status(400).json({ error: 'agent_id is required' })
      return
    }
    if (!noteText) {
      res.status(400).json({ error: 'note_text is required' })
      return
    }

    const thread = await findThreadById(supabase, id)
    if (!thread) {
      res.status(404).json({ error: 'Thread not found' })
      return
    }

    const { data: note, error } = await supabase
      .from('whatsapp_internal_notes')
      .insert({
        thread_id: id,
        agent_id: agentId,
        note_text: noteText,
      } as never)
      .select('*, agents(full_name)')
      .single()

    if (error || !note) {
      res.status(500).json({ error: error?.message ?? 'Failed to add note' })
      return
    }

    res.json({ note: note as WhatsAppInternalNoteRow })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[whatsapp-inbox] addThreadNote:', err)
    res.status(500).json({ error: message })
  }
}

export async function closeThreadHandler(
  supabase: SupabaseClient,
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params

    const thread = await findThreadById(supabase, id)
    if (!thread) {
      res.status(404).json({ error: 'Thread not found' })
      return
    }

    const { data: updated, error } = await supabase
      .from('whatsapp_threads')
      .update({ status: 'closed' } as never)
      .eq('id', id)
      .select('*, leads(name, phone), agents:assigned_agent_id(full_name)')
      .single()

    if (error || !updated) {
      res.status(500).json({ error: error?.message ?? 'Failed to close thread' })
      return
    }

    res.json({ thread: updated as WhatsAppThreadRow })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[whatsapp-inbox] closeThread:', err)
    res.status(500).json({ error: message })
  }
}

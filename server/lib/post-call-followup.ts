import type { SupabaseClient } from '@supabase/supabase-js'
import {
  sendPostCallFollowUp,
  type FollowUpCallSummary,
  type FollowUpLead,
} from './email-sender'

type EmailLogStatus =
  | 'sent'
  | 'failed'
  | 'skipped_no_email'
  | 'skipped_disabled'
  | 'skipped_already_sent'

async function writeEmailLog(
  supabase: SupabaseClient,
  row: {
    lead_id: string | null
    recipient_email: string | null
    subject: string | null
    status: EmailLogStatus
    error_text?: string | null
  }
): Promise<void> {
  const { error } = await supabase.from('email_logs').insert({
    lead_id: row.lead_id,
    email_type: 'post_call_followup',
    recipient_email: row.recipient_email,
    subject: row.subject,
    status: row.status,
    error_text: row.error_text || null,
  } as never)
  if (error) {
    console.warn('[post-call-followup] email_logs insert failed:', error.message)
  }
}

function startOfUtcDayIso(): string {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

async function agentAllowsPostCallEmail(
  supabase: SupabaseClient,
  agentId: string | null
): Promise<boolean> {
  if (!agentId) return true
  const { data } = await supabase
    .from('agent_settings')
    .select('notify_post_call_email')
    .eq('agent_id', agentId)
    .maybeSingle()

  if (!data) return true
  const flag = (data as { notify_post_call_email?: boolean | null }).notify_post_call_email
  return flag !== false
}

async function alreadySentToday(
  supabase: SupabaseClient,
  leadId: string | null
): Promise<boolean> {
  if (!leadId) return false

  const { data: lead } = await supabase
    .from('leads')
    .select('follow_up_email_sent, follow_up_email_sent_at')
    .eq('id', leadId)
    .maybeSingle()

  const row = lead as {
    follow_up_email_sent?: boolean
    follow_up_email_sent_at?: string | null
  } | null

  if (row?.follow_up_email_sent && row.follow_up_email_sent_at) {
    if (row.follow_up_email_sent_at >= startOfUtcDayIso()) return true
  }

  const { data: logs } = await supabase
    .from('email_logs')
    .select('id')
    .eq('lead_id', leadId)
    .eq('email_type', 'post_call_followup')
    .eq('status', 'sent')
    .gte('sent_at', startOfUtcDayIso())
    .limit(1)

  return Boolean(logs && logs.length > 0)
}

/**
 * Core send + logging. Safe to call fire-and-forget.
 */
export async function processPostCallFollowUp(
  supabase: SupabaseClient,
  input: {
    lead: FollowUpLead
    callSummary: FollowUpCallSummary
    agentId?: string | null
  }
): Promise<void> {
  const leadId = input.lead.id || null
  const email = String(input.lead.email || '').trim()
  const agentId = input.agentId ?? null

  try {
    if (!(await agentAllowsPostCallEmail(supabase, agentId))) {
      await writeEmailLog(supabase, {
        lead_id: leadId,
        recipient_email: email || null,
        subject: null,
        status: 'skipped_disabled',
        error_text: 'Agent disabled post-call follow-up emails',
      })
      return
    }

    if (!email) {
      await writeEmailLog(supabase, {
        lead_id: leadId,
        recipient_email: null,
        subject: null,
        status: 'skipped_no_email',
      })
      return
    }

    if (await alreadySentToday(supabase, leadId)) {
      await writeEmailLog(supabase, {
        lead_id: leadId,
        recipient_email: email,
        subject: null,
        status: 'skipped_already_sent',
        error_text: 'Follow-up already sent today',
      })
      return
    }

    const result = await sendPostCallFollowUp(
      { ...input.lead, email },
      input.callSummary
    )

    if (result.success) {
      await writeEmailLog(supabase, {
        lead_id: leadId,
        recipient_email: result.recipient,
        subject: result.subject,
        status: 'sent',
      })
      if (leadId) {
        const { error } = await supabase
          .from('leads')
          .update({
            follow_up_email_sent: true,
            follow_up_email_sent_at: new Date().toISOString(),
          } as never)
          .eq('id', leadId)
        if (error) {
          console.warn('[post-call-followup] lead flag update failed:', error.message)
        }
      }
      return
    }

    await writeEmailLog(supabase, {
      lead_id: leadId,
      recipient_email: result.recipient || email,
      subject: result.subject,
      status: result.error === 'no_email' ? 'skipped_no_email' : 'failed',
      error_text: result.error || 'send_failed',
    })
  } catch (e) {
    console.error('[post-call-followup] unexpected', e)
    await writeEmailLog(supabase, {
      lead_id: leadId,
      recipient_email: email || null,
      subject: null,
      status: 'failed',
      error_text: e instanceof Error ? e.message : 'unexpected_error',
    })
  }
}

/**
 * Resolve lead context from Express VAPI `call.ended` payload + handler result,
 * then send follow-up. Does not modify call scoring / insert logic.
 */
export async function schedulePostCallFollowUpFromVapiPayload(
  supabase: SupabaseClient,
  payload: Record<string, unknown>,
  handlerResult?: { success?: boolean; callId?: string; leadStatus?: string; score?: number }
): Promise<void> {
  const type = String(payload.type || (payload.message as { type?: string } | undefined)?.type || '')
  if (type !== 'call.ended' && type !== 'end-of-call-report') {
    return
  }

  const call =
    (payload.call as Record<string, unknown> | undefined) ||
    ((payload.message as { call?: Record<string, unknown> } | undefined)?.call)

  const meta = (call?.metadata || {}) as Record<string, unknown>
  let leadId =
    (typeof meta.leadId === 'string' && meta.leadId) ||
    (typeof meta.lead_id === 'string' && meta.lead_id) ||
    null

  const phoneRaw =
    (typeof call?.phoneNumber === 'string' && call.phoneNumber) ||
    (typeof call?.customer === 'object' &&
      call.customer &&
      typeof (call.customer as { number?: string }).number === 'string' &&
      (call.customer as { number: string }).number) ||
    ''
  const phone = String(phoneRaw).trim() || null

  let leadRow: {
    id: string
    name: string | null
    email: string | null
    phone: string | null
    source: string | null
    score_label: string | null
    agent_id: string | null
  } | null = null

  if (leadId) {
    const { data } = await supabase
      .from('leads')
      .select('id, name, email, phone, source, score_label, agent_id')
      .eq('id', leadId)
      .maybeSingle()
    leadRow = data as typeof leadRow
  }

  if (!leadRow && phone) {
    const { data } = await supabase
      .from('leads')
      .select('id, name, email, phone, source, score_label, agent_id')
      .eq('phone', phone)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    leadRow = data as typeof leadRow
    if (leadRow) leadId = leadRow.id
  }

  const agentId =
    leadRow?.agent_id ||
    (typeof meta.agentId === 'string' ? meta.agentId : null) ||
    null

  const emailFromCall =
    leadRow?.email ||
    (typeof meta.email === 'string' ? meta.email : null) ||
    null

  // Fallback: email stored on the calls row just inserted
  let email = emailFromCall
  let name = leadRow?.name || null
  if ((!email || !name) && handlerResult?.callId) {
    const { data: callRow } = await supabase
      .from('calls')
      .select('lead_email, lead_name, ai_summary, call_outcome, call_duration, agent_id')
      .eq('id', handlerResult.callId)
      .maybeSingle()
    const cr = callRow as {
      lead_email?: string | null
      lead_name?: string | null
      ai_summary?: string | null
      call_outcome?: string | null
      call_duration?: number | null
      agent_id?: string | null
    } | null
    if (cr) {
      email = email || cr.lead_email || null
      name = name || cr.lead_name || null
    }
  }

  const scoreLabel =
    leadRow?.score_label ||
    handlerResult?.leadStatus ||
    null

  await processPostCallFollowUp(supabase, {
    agentId: agentId || null,
    lead: {
      id: leadId,
      name,
      email,
      phone: leadRow?.phone || phone,
      lead_source: leadRow?.source || 'vapi_call',
      score_label: scoreLabel,
    },
    callSummary: {
      duration_seconds: typeof call?.duration === 'number' ? call.duration : null,
      outcome: handlerResult?.leadStatus || null,
      transcript_summary: null,
    },
  })
}

/** Convenience for Next speed/outbound webhooks that already have a lead id. */
export async function schedulePostCallFollowUpForLead(
  supabase: SupabaseClient,
  leadId: string,
  callSummary: FollowUpCallSummary
): Promise<void> {
  const { data } = await supabase
    .from('leads')
    .select('id, name, email, phone, source, score_label, agent_id')
    .eq('id', leadId)
    .maybeSingle()

  if (!data) {
    await writeEmailLog(supabase, {
      lead_id: leadId,
      recipient_email: null,
      subject: null,
      status: 'failed',
      error_text: 'lead_not_found',
    })
    return
  }

  const lead = data as {
    id: string
    name: string | null
    email: string | null
    phone: string | null
    source: string | null
    score_label: string | null
    agent_id: string | null
  }

  await processPostCallFollowUp(supabase, {
    agentId: lead.agent_id,
    lead: {
      id: lead.id,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      lead_source: lead.source,
      score_label: lead.score_label,
    },
    callSummary,
  })
}

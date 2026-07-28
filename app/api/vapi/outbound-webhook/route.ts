import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { requireVapiSecret } from '../../../../lib/require-vapi-secret'
import { getSupabaseServiceClient } from '../../../../lib/supabase-service'
import { toE164 } from '../../../../lib/phone-e164'
import { inferLeadTypeAndUrgencyFromTranscript } from '../../../../lib/lead-transcript-signals'
import {
  PRIYA_BRANCHING_SYSTEM_PROMPT,
  PRIYA_CAMPAIGN_FIRST_MESSAGE,
} from '../../../../lib/vapi-priya-branching-prompt'
import { sendAgentSMSAlert } from '../../../../server/lib/sms-alert'

export const runtime = 'nodejs'
export const maxDuration = 120

function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
    'http://localhost:3002'
  ).replace(/\/$/, '')
}

function anthropicClient(): Anthropic | null {
  const key =
    process.env.ANTHROPIC_API_KEY ||
    process.env.VITE_ANTHROPIC_API_KEY
  if (!key) return null
  return new Anthropic({ apiKey: key })
}

function extractTranscript(message: Record<string, unknown>): string {
  const m = message as Record<string, unknown>
  if (typeof m.transcript === 'string' && m.transcript.trim()) return m.transcript.trim()
  const art = m.artifact as Record<string, unknown> | undefined
  if (art && typeof art.transcript === 'string' && String(art.transcript).trim()) {
    return String(art.transcript).trim()
  }
  const msgs = art?.messages as Array<{ role?: string; message?: string }> | undefined
  if (Array.isArray(msgs) && msgs.length) {
    return msgs
      .map((x) => `${x.role || 'unknown'}: ${x.message || ''}`)
      .join('\n')
      .trim()
  }
  const call = m.call as Record<string, unknown> | undefined
  if (call && typeof call.transcript === 'string') return String(call.transcript).trim()
  return ''
}

function num(v: unknown): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isNaN(n) ? 0 : n
  }
  return 0
}

function extractDurationSeconds(
  message: Record<string, unknown>,
  call: Record<string, unknown> | undefined
): number {
  const m = message as Record<string, unknown>
  const art = m.artifact as Record<string, unknown> | undefined
  let d = num(m.durationSeconds)
  if (d > 0) return Math.round(d)
  d = num(art?.durationSeconds)
  if (d > 0) return Math.round(d)
  if (call) {
    d = num(call.durationSeconds)
    if (d > 0) return Math.round(d)
    d = num(call.duration)
    if (d > 0) return Math.round(d)
  }
  return 0
}

function parseJsonFromClaudeText(text: string): Record<string, unknown> {
  let t = text.trim()
  const fence = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/im.exec(t)
  if (fence) t = fence[1].trim()
  return JSON.parse(t) as Record<string, unknown>
}

async function startNextVapiCall(params: {
  campaignLeadId: string
  leadName: string
  leadPhone: string
}): Promise<{ callId: string }> {
  const apiKey = process.env.VAPI_API_KEY || process.env.VITE_VAPI_API_KEY
  const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID || process.env.VITE_VAPI_PHONE_NUMBER_ID
  if (!apiKey) throw new Error('VAPI_API_KEY is not configured')
  if (!phoneNumberId) throw new Error('VAPI_PHONE_NUMBER_ID is not configured')

  const number = toE164(params.leadPhone)
  const serverUrl = `${appBaseUrl()}/api/vapi/outbound-webhook`

  const payload = {
    phoneNumberId,
    customer: {
      number,
      name: params.leadName || 'there',
    },
    assistant: {
      name: 'Priya',
      firstMessage: PRIYA_CAMPAIGN_FIRST_MESSAGE,
      model: {
        provider: 'openai',
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: PRIYA_BRANCHING_SYSTEM_PROMPT,
          },
        ],
      },
      voice: {
        provider: '11labs',
        voiceId: '21m00Tcm4TlvDq8ikWAM',
      },
      recordingEnabled: true,
      maxDurationSeconds: 240,
      serverUrl,
      metadata: {
        campaignLeadId: params.campaignLeadId,
      },
    },
  }

  const res = await fetch('https://api.vapi.ai/call/phone', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const data = (await res.json()) as { id?: string; message?: string }
  if (!res.ok) {
    throw new Error(data.message || `VAPI error (${res.status})`)
  }
  if (!data.id) throw new Error('VAPI did not return call id')
  return { callId: data.id }
}

export async function POST(req: NextRequest) {
  const auth = await requireVapiSecret(req)
  if (auth !== true) return auth

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const message = body.message as Record<string, unknown> | undefined
  if (!message || message.type !== 'end-of-call-report') {
    return NextResponse.json({ received: true })
  }

  const call = message.call as Record<string, unknown> | undefined
  const campaignLeadIdRaw = call?.metadata as Record<string, unknown> | undefined
  const campaignLeadId =
    (typeof campaignLeadIdRaw?.campaignLeadId === 'string' && campaignLeadIdRaw.campaignLeadId) ||
    (typeof (call as { campaignLeadId?: string } | undefined)?.campaignLeadId === 'string' &&
      (call as { campaignLeadId?: string }).campaignLeadId) ||
    ''

  if (!campaignLeadId) {
    return NextResponse.json({ error: 'No campaignLeadId in metadata' }, { status: 400 })
  }

  const supabase = getSupabaseServiceClient()
  const now = new Date().toISOString()

  const { data: row0, error: rowErr } = await supabase
    .from('campaign_leads')
    .select('id,status,campaign_id,lead_id,vapi_call_id')
    .eq('id', campaignLeadId)
    .maybeSingle()

  if (rowErr || !row0) {
    return NextResponse.json({ error: 'Campaign lead not found' }, { status: 400 })
  }

  const row = row0 as {
    id: string
    status: string | null
    campaign_id: string
    lead_id: string
    vapi_call_id: string | null
  }

  if (row.status !== 'calling') {
    return NextResponse.json({ received: true, duplicate: true, reason: 'not_in_calling_state' })
  }

  const vapiCallId = typeof call?.id === 'string' ? call.id : null
  if (vapiCallId && row.vapi_call_id && row.vapi_call_id !== vapiCallId) {
    return NextResponse.json({ received: true, duplicate: true, reason: 'call_id_mismatch' })
  }

  const transcript = extractTranscript(message)
  const durationSeconds = extractDurationSeconds(message, call)

  let score = 0
  let scoreLabel = 'Cold'
  let sentiment = 'neutral'

  if (transcript.length > 50) {
    const scoringPrompt = `You are a real estate lead qualification expert.

Analyze this phone call transcript and score the lead from 0 to 100 
based on their interest in buying a plot/property.

Scoring criteria:
- 80-100 (Hot): Expressed clear interest, gave budget, asked follow-up 
  questions, wants to meet or see plots
- 50-79 (Warm): Somewhat interested, asked questions but no commitment, 
  open to more info
- 20-49 (Cold): Politely listened but not interested right now, 
  no budget discussed
- 0-19 (Dead): Hung up early, rude, wrong number, DND, not interested 
  at all

Transcript:
"""
${transcript}
"""

Respond ONLY with valid JSON, no extra text:
{
  "score": <number 0-100>,
  "score_label": "<Hot|Warm|Cold|Dead>",
  "sentiment": "<positive|neutral|negative>",
  "reason": "<one sentence explanation>",
  "interested_in": "<what they said they want, or null>",
  "budget_mentioned": "<budget they mentioned, or null>",
  "follow_up_action": "<what to do next, or null>"
}`

    const anthropic = anthropicClient()
    if (anthropic) {
      try {
        const model =
          process.env.ANTHROPIC_SCORING_MODEL || 'claude-sonnet-4-20250514'
        const response = await anthropic.messages.create({
          model,
          max_tokens: 300,
          messages: [{ role: 'user', content: scoringPrompt }],
        })

        const block = response.content[0]
        const raw = block && block.type === 'text' ? block.text : ''
        const parsed = parseJsonFromClaudeText(raw)

        score = typeof parsed.score === 'number' ? Math.min(100, Math.max(0, parsed.score)) : 0
        scoreLabel =
          typeof parsed.score_label === 'string' ? String(parsed.score_label) : 'Cold'
        sentiment =
          typeof parsed.sentiment === 'string' ? String(parsed.sentiment) : 'neutral'

        await supabase
          .from('campaign_leads')
          .update({
            status: 'completed',
            lead_score: score,
            score_label: scoreLabel,
            transcript,
            duration_seconds: durationSeconds,
            updated_at: now,
          })
          .eq('id', campaignLeadId)

        const budgetMentioned =
          typeof parsed.budget_mentioned === 'string' ? parsed.budget_mentioned : null
        const followUp =
          typeof parsed.follow_up_action === 'string' ? parsed.follow_up_action : null
        const interestedIn =
          typeof parsed.interested_in === 'string' ? parsed.interested_in : null

        const { lead_type, urgency } = inferLeadTypeAndUrgencyFromTranscript(transcript)

        await supabase
          .from('leads')
          .update({
            lead_score: score,
            score_label: scoreLabel,
            call_transcript: transcript,
            sentiment,
            last_outbound_at: now,
            updated_at: now,
            budget_mentioned: budgetMentioned,
            follow_up_action: followUp,
            interested_in: interestedIn,
            lead_type,
            urgency,
          })
          .eq('id', row.lead_id)

        const { data: leadForSms } = await supabase
          .from('leads')
          .select('id, name, phone, agent_id, location, budget_mentioned')
          .eq('id', row.lead_id)
          .maybeSingle()

        const lr = leadForSms as {
          name: string
          phone: string
          agent_id: string | null
          location: string | null
          budget_mentioned: string | null
        } | null

        if (lr?.agent_id) {
          const { data: agentRow } = await supabase.from('agents').select('phone').eq('id', lr.agent_id).maybeSingle()
          const aphone = (agentRow as { phone: string | null } | null)?.phone
          if (aphone) {
            const budgetStr = lr.budget_mentioned?.trim() || undefined
            await sendAgentSMSAlert({
              agentPhone: aphone,
              leadName: lr.name || 'Lead',
              leadPhone: lr.phone,
              score,
              scoreLabel,
              leadType: lead_type,
              urgency,
              location: lr.location,
              budget: budgetStr,
            })
          }
        }
      } catch (err) {
        console.error('[outbound-webhook] Claude scoring failed:', err)
        await supabase
          .from('campaign_leads')
          .update({
            status: 'completed',
            transcript,
            duration_seconds: durationSeconds,
            updated_at: now,
          })
          .eq('id', campaignLeadId)

        const { lead_type, urgency } = inferLeadTypeAndUrgencyFromTranscript(transcript)
        await supabase
          .from('leads')
          .update({
            call_transcript: transcript,
            last_outbound_at: now,
            updated_at: now,
            lead_type,
            urgency,
          })
          .eq('id', row.lead_id)
      }
    } else {
      console.warn('[outbound-webhook] ANTHROPIC_API_KEY missing; skipping Claude score')
      await supabase
        .from('campaign_leads')
        .update({
          status: 'completed',
          transcript,
          duration_seconds: durationSeconds,
          updated_at: now,
        })
        .eq('id', campaignLeadId)

      const { lead_type, urgency } = inferLeadTypeAndUrgencyFromTranscript(transcript)
      await supabase
        .from('leads')
        .update({
          call_transcript: transcript,
          last_outbound_at: now,
          updated_at: now,
          lead_type,
          urgency,
        })
        .eq('id', row.lead_id)
    }
  } else {
    await supabase
      .from('campaign_leads')
      .update({
        status: 'no-answer',
        duration_seconds: durationSeconds,
        lead_score: 0,
        score_label: 'Dead',
        transcript: transcript || null,
        updated_at: now,
      })
      .eq('id', campaignLeadId)

    if (transcript.trim().length > 0) {
      const { lead_type, urgency } = inferLeadTypeAndUrgencyFromTranscript(transcript)
      await supabase
        .from('leads')
        .update({
          call_transcript: transcript,
          last_outbound_at: now,
          updated_at: now,
          lead_type,
          urgency,
        })
        .eq('id', row.lead_id)
    }
  }

  const wasConnected = durationSeconds > 15
  const { error: rpcErr } = await supabase.rpc('increment_campaign_calls', {
    campaign_id: row.campaign_id,
    was_connected: wasConnected,
  })
  if (rpcErr) {
    console.error('[outbound-webhook] increment_campaign_calls failed:', rpcErr.message)
  }

  const campaignId = row.campaign_id

  const { data: campaign, error: cErr } = await supabase
    .from('outbound_campaigns')
    .select('status')
    .eq('id', campaignId)
    .single()

  if (cErr || !campaign) {
    return NextResponse.json({ scored: true, score, scoreLabel, nextCall: false })
  }

  if ((campaign as { status: string | null }).status !== 'running') {
    return NextResponse.json({ scored: true, score, scoreLabel, nextCall: false })
  }

  const { data: nextCl, error: nextErr } = await supabase
    .from('campaign_leads')
    .select('id,lead_id')
    .eq('campaign_id', campaignId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (nextErr || !nextCl) {
    await supabase
      .from('outbound_campaigns')
      .update({
        status: 'completed',
        completed_at: now,
        updated_at: now,
      })
      .eq('id', campaignId)

    return NextResponse.json({ scored: true, score, scoreLabel, nextCall: false, campaignCompleted: true })
  }

  const nextRow = nextCl as { id: string; lead_id: string }
  const { data: leadRow, error: leadErr } = await supabase
    .from('leads')
    .select('name,phone')
    .eq('id', nextRow.lead_id)
    .single()

  if (leadErr || !leadRow) {
    console.error('[outbound-webhook] Next lead not found:', leadErr?.message)
    return NextResponse.json({ scored: true, score, scoreLabel, nextCall: false })
  }

  const lead = leadRow as { name: string; phone: string }

  await new Promise((r) => setTimeout(r, 3000))

  try {
    const { callId } = await startNextVapiCall({
      campaignLeadId: nextRow.id,
      leadName: lead.name,
      leadPhone: lead.phone,
    })

    await supabase
      .from('campaign_leads')
      .update({
        status: 'calling',
        vapi_call_id: callId,
        called_at: now,
        updated_at: now,
      })
      .eq('id', nextRow.id)
  } catch (e) {
    console.error('[outbound-webhook] Next VAPI call failed:', e)
    await supabase
      .from('campaign_leads')
      .update({
        status: 'failed',
        result: e instanceof Error ? e.message : 'VAPI failed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', nextRow.id)
  }

  return NextResponse.json({ scored: true, score, scoreLabel, nextCall: true })
}

import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { requireVapiSecret } from '../../../../lib/require-vapi-secret'
import { getSupabaseServiceClient } from '../../../../lib/supabase-service'
import { inferLeadTypeAndUrgencyFromTranscript } from '../../../../lib/lead-transcript-signals'
import { sendAgentSMSAlert } from '../../../../server/lib/sms-alert'

export const runtime = 'nodejs'
export const maxDuration = 120

function anthropicClient(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY
  if (!key) return null
  return new Anthropic({ apiKey: key })
}

function extractTranscript(message: Record<string, unknown>): string {
  const m = message
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
  const m = message
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
  const meta = call?.metadata as Record<string, unknown> | undefined
  const leadId = typeof meta?.leadId === 'string' ? meta.leadId : ''
  const speedLogId = typeof meta?.speedLogId === 'string' ? meta.speedLogId : ''
  const vapiCallId = typeof call?.id === 'string' ? call.id : ''

  if (!leadId) {
    return NextResponse.json({ received: true })
  }

  const supabase = getSupabaseServiceClient()
  const now = new Date().toISOString()

  let logQuery = supabase
    .from('speed_to_lead_log')
    .select('id, received_at, call_triggered_at, call_status, vapi_call_id')
    .eq('lead_id', leadId)

  if (speedLogId) {
    logQuery = logQuery.eq('id', speedLogId)
  } else if (vapiCallId) {
    logQuery = logQuery.eq('vapi_call_id', vapiCallId)
  } else {
    logQuery = logQuery.order('received_at', { ascending: false }).limit(1)
  }

  const { data: logRow, error: logErr } = await logQuery.maybeSingle()

  if (logErr || !logRow) {
    return NextResponse.json({ received: true, reason: 'no_log_row' })
  }

  const log = logRow as {
    id: string
    received_at: string | null
    call_triggered_at: string | null
    call_status: string | null
    vapi_call_id: string | null
  }

  if (log.call_status === 'completed') {
    return NextResponse.json({ received: true, duplicate: true })
  }

  let responseSeconds: number | null = null
  if (log.received_at && log.call_triggered_at) {
    responseSeconds = Math.round(
      (new Date(log.call_triggered_at).getTime() - new Date(log.received_at).getTime()) / 1000
    )
  }

  const transcript = extractTranscript(message)
  const durationSeconds = extractDurationSeconds(message, call)

  let score = 0
  let scoreLabel = 'Cold'

  if (transcript.length > 50) {
    const anthropic = anthropicClient()
    if (anthropic) {
      try {
        const model = process.env.ANTHROPIC_SCORING_MODEL || 'claude-sonnet-4-20250514'
        const response = await anthropic.messages.create({
          model,
          max_tokens: 300,
          messages: [
            {
              role: 'user',
              content: `Score this real estate lead call 0-100.
80-100=Hot (clear interest, gave budget, wants visit)
50-79=Warm (interested but no commitment)
20-49=Cold (polite but not interested now)
0-19=Dead (hung up, wrong number, rude)

Transcript: """${transcript}"""

Respond ONLY with valid JSON (no markdown), for example:
{"score": 75, "score_label": "Warm", "reason": "one sentence"}`,
            },
          ],
        })

        const block = response.content[0]
        const raw = block && block.type === 'text' ? block.text : '{}'
        const parsed = parseJsonFromClaudeText(raw)
        const s = parsed.score
        score = typeof s === 'number' ? Math.min(100, Math.max(0, s)) : typeof s === 'string' ? Math.min(100, Math.max(0, num(s))) : 0
        scoreLabel =
          typeof parsed.score_label === 'string' ? String(parsed.score_label) : 'Cold'
      } catch (e) {
        console.error('[speed-webhook] Scoring error:', e)
      }
    } else {
      console.warn('[speed-webhook] ANTHROPIC_API_KEY missing; skipping Claude score')
    }
  }

  const callDurationSeconds =
    typeof durationSeconds === 'number' && durationSeconds > 0 ? durationSeconds : null

  await supabase
    .from('speed_to_lead_log')
    .update({
      call_status: 'completed',
      response_seconds: responseSeconds,
      call_duration_seconds: callDurationSeconds,
      lead_score: score,
      score_label: scoreLabel,
    })
    .eq('id', log.id)

  const { lead_type, urgency } = inferLeadTypeAndUrgencyFromTranscript(transcript)

  await supabase
    .from('leads')
    .update({
      lead_score: score,
      score_label: scoreLabel,
      call_transcript: transcript,
      last_outbound_at: now,
      updated_at: now,
      lead_type,
      urgency,
    })
    .eq('id', leadId)

  const { data: leadRow } = await supabase
    .from('leads')
    .select('id, name, phone, agent_id, location, budget_mentioned')
    .eq('id', leadId)
    .maybeSingle()

  const lr = leadRow as {
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

  return NextResponse.json({
    scored: true,
    score,
    scoreLabel,
    durationSeconds,
  })
}

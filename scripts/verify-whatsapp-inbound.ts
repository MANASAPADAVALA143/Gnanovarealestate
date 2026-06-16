#!/usr/bin/env tsx
/**
 * WhatsApp inbound handler verification (no live Twilio required).
 */
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import {
  buildAutoReplyText,
  matchLeadByPhone,
  processInboundWhatsApp,
  stripWhatsAppPrefix,
} from '../server/lib/whatsapp-inbound.ts'

dotenv.config({ path: '.env' })
dotenv.config({ path: '.env.local', override: true })

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
}

function log(msg: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`)
}

async function main() {
  console.log('\n' + '='.repeat(60))
  log('WhatsApp Inbound Verification', 'cyan')
  console.log('='.repeat(60))

  let pass = 0
  let fail = 0

  // 1. stripWhatsAppPrefix
  const stripped = stripWhatsAppPrefix('whatsapp:+971501234567')
  if (stripped === '+971501234567') {
    log('1. stripWhatsAppPrefix: PASS', 'green')
    pass++
  } else {
    log(`1. stripWhatsAppPrefix: FAIL (got ${stripped})`, 'red')
    fail++
  }

  // 2. buildAutoReplyText stages
  const newReply = buildAutoReplyText({ id: 'x', name: 'Ali', agent_id: null, pipeline_stage: 'new' })
  const viewingReply = buildAutoReplyText({
    id: 'x',
    name: 'Ali',
    agent_id: null,
    pipeline_stage: 'viewing_scheduled',
  })
  const unmatchedReply = buildAutoReplyText(null)
  if (
    newReply.includes('Ali') &&
    newReply.includes('follow up') &&
    viewingReply.includes('viewing is confirmed') &&
    unmatchedReply.includes('Thanks for reaching out')
  ) {
    log('2. buildAutoReplyText (stages): PASS', 'green')
    pass++
  } else {
    log('2. buildAutoReplyText (stages): FAIL', 'red')
    fail++
  }

  if (!url || !key) {
    log('3. matchLeadByPhone: SKIP (no Supabase)', 'yellow')
    log('4. processInboundWhatsApp (DB): SKIP (no Supabase)', 'yellow')
  } else {
    const supabase = createClient(url, key)

    const { data: sampleLead } = await supabase
      .from('leads')
      .select('id, name, phone, agent_id, pipeline_stage')
      .not('phone', 'is', null)
      .limit(1)
      .maybeSingle()

    if (sampleLead?.phone) {
      const matched = await matchLeadByPhone(supabase, sampleLead.phone as string)
      if (matched?.id === sampleLead.id) {
        log(`3. matchLeadByPhone: PASS (${matched.name})`, 'green')
        pass++
      } else {
        log('3. matchLeadByPhone: FAIL', 'red')
        fail++
      }

      const testPhone = `+1555${String(Date.now()).slice(-7)}`
      const testName = `WA Inbound Test ${Date.now()}`
      const { data: testLead, error: insertErr } = await supabase
        .from('leads')
        .insert({
          name: testName,
          phone: testPhone,
          source: 'website',
          status: 'new',
          pipeline_stage: 'new',
        } as never)
        .select('id')
        .single()

      if (insertErr || !testLead) {
        log(`4. processInboundWhatsApp: FAIL (lead insert: ${insertErr?.message})`, 'red')
        fail++
      } else {
        const leadId = (testLead as { id: string }).id
        const inboundBody = 'Hello from verify script'
        process.env.TWILIO_SKIP_SIGNATURE = 'true'

        await processInboundWhatsApp({
          from: `whatsapp:${testPhone}`,
          body: inboundBody,
          messageSid: `SM_VERIFY_${Date.now()}`,
        })

        const { data: activity } = await supabase
          .from('lead_activities')
          .select('content')
          .eq('lead_id', leadId)
          .eq('type', 'whatsapp')
          .ilike('content', `Inbound: ${inboundBody}%`)
          .maybeSingle()

        const { data: waMsg } = await supabase
          .from('whatsapp_messages')
          .select('status, raw_payload')
          .eq('phone', testPhone)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        const payload = waMsg?.raw_payload as { direction?: string; body?: string } | null
        if (activity && waMsg?.status === 'inbound' && payload?.direction === 'inbound') {
          log('4. processInboundWhatsApp (activity + message log): PASS', 'green')
          pass++
        } else {
          log('4. processInboundWhatsApp (activity + message log): FAIL', 'red')
          if (!activity) log('   - missing lead_activities whatsapp row', 'red')
          if (!waMsg) log('   - missing whatsapp_messages row', 'red')
          fail++
        }
      }
    } else {
      log('3. matchLeadByPhone: SKIP (no leads with phone)', 'yellow')
      log('4. processInboundWhatsApp: SKIP (no sample lead)', 'yellow')
    }
  }

  console.log('\n' + '='.repeat(60))
  log(`Passed: ${pass}  Failed: ${fail}`, fail ? 'red' : 'green')
  console.log('='.repeat(60) + '\n')

  if (fail > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

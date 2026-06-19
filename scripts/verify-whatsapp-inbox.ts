#!/usr/bin/env tsx
/**
 * WhatsApp inbox verification (migration 021 + API + inbound dual-write).
 */
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { processInboundWhatsApp } from '../server/lib/whatsapp-inbound.ts'
import { shouldAutoReply } from '../server/lib/whatsapp-inbox.ts'

dotenv.config({ path: '.env' })
dotenv.config({ path: '.env.local', override: true })

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const webhookBase =
  process.env.EXPRESS_BASE_URL?.replace(/\/$/, '') ||
  process.env.VITE_WEBHOOK_URL?.replace(/\/$/, '') ||
  'http://localhost:3001'

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

async function apiJson<T>(
  path: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; body: T }> {
  const res = await fetch(`${webhookBase}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
    signal: AbortSignal.timeout(12000),
  })
  const body = (await res.json().catch(() => ({}))) as T
  return { ok: res.ok, status: res.status, body }
}

async function main() {
  console.log('\n' + '='.repeat(60))
  log('WhatsApp Inbox Verification', 'cyan')
  console.log('='.repeat(60))

  let pass = 0
  let fail = 0

  if (shouldAutoReply('unassigned') && shouldAutoReply('bot_handling') && !shouldAutoReply('agent_handling')) {
    log('1. shouldAutoReply rules: PASS', 'green')
    pass++
  } else {
    log('1. shouldAutoReply rules: FAIL', 'red')
    fail++
  }

  if (!url || !key) {
    log('2–6. DB/API checks: SKIP (no Supabase)', 'yellow')
  } else {
    const supabase = createClient(url, key)

    const { error: schemaErr } = await supabase.from('whatsapp_threads').select('id').limit(1)
    if (schemaErr) {
      log(`2. Migration 021 schema: FAIL — ${schemaErr.message}`, 'red')
      log('   Run supabase/migrations/021_whatsapp_inbox.sql in SQL Editor', 'yellow')
      fail++
    } else {
      log('2. Migration 021 schema: PASS', 'green')
      pass++

      const testPhone = `+1555${String(Date.now()).slice(-7)}`
      const testSid = `SM_INBOX_${Date.now()}`
      let threadId: string | undefined

      try {
        await processInboundWhatsApp({
          from: `whatsapp:${testPhone}`,
          body: 'Inbox verify inbound',
          messageSid: testSid,
        })

        const { data: thread } = await supabase
          .from('whatsapp_threads')
          .select('id, status, unread_count, phone_number')
          .eq('phone_number', testPhone)
          .maybeSingle()

        const { data: messages } = await supabase
          .from('whatsapp_thread_messages')
          .select('direction, sender_type')
          .eq('thread_id', (thread as { id: string } | null)?.id || 'none')

        const hasInbound = (messages || []).some(
          (m) => m.direction === 'inbound' && m.sender_type === 'lead'
        )
        const hasBot =
          (messages || []).some((m) => m.sender_type === 'bot') ||
          (thread as { status?: string } | null)?.status === 'bot_handling'

        if (thread && hasInbound) {
          log('3. Inbound dual-write (thread + lead message): PASS', 'green')
          pass++
        } else {
          log('3. Inbound dual-write: FAIL', 'red')
          fail++
        }

        if (hasBot || !process.env.TWILIO_ACCOUNT_SID) {
          log('4. Bot reply path: PASS (bot message or Twilio not configured)', 'green')
          pass++
        } else {
          log('4. Bot reply path: FAIL (expected bot outbound message)', 'red')
          fail++
        }

        threadId = (thread as { id: string } | null)?.id
        const { data: agent } = await supabase.from('agents').select('id').limit(1).maybeSingle()
        const agentId = (agent as { id?: string } | null)?.id

        if (agentId && threadId) {
          const list = await apiJson<{ threads?: unknown[] }>('/api/whatsapp/threads')
          const detail = await apiJson<{ messages?: unknown[] }>(`/api/whatsapp/threads/${threadId}`)
          const assign = await apiJson<{ thread?: { assigned_agent_id?: string } }>(
            `/api/whatsapp/threads/${threadId}/assign`,
            { method: 'POST', body: JSON.stringify({ agent_id: agentId }) }
          )
          const note = await apiJson<{ note?: { note_text?: string } }>(
            `/api/whatsapp/threads/${threadId}/notes`,
            {
              method: 'POST',
              body: JSON.stringify({ agent_id: agentId, note_text: 'Verify internal note' }),
            }
          )

          if (list.ok && detail.ok && assign.ok && note.ok) {
            log('5. Inbox API (list, detail, assign, note): PASS', 'green')
            pass++
          } else {
            log('5. Inbox API: FAIL (is webhook server running on 3001?)', 'red')
            fail++
          }

          await supabase
            .from('whatsapp_threads')
            .update({ status: 'agent_handling' } as never)
            .eq('id', threadId)

          const sid2 = `SM_INBOX_AGENT_${Date.now()}`
          await processInboundWhatsApp({
            from: `whatsapp:${testPhone}`,
            body: 'Should not get bot reply',
            messageSid: sid2,
          })

          const { count: botCount } = await supabase
            .from('whatsapp_thread_messages')
            .select('id', { count: 'exact', head: true })
            .eq('thread_id', threadId)
            .eq('sender_type', 'bot')

          const { count: msgCount } = await supabase
            .from('whatsapp_thread_messages')
            .select('id', { count: 'exact', head: true })
            .eq('thread_id', threadId)

          if ((msgCount || 0) >= 2 && (botCount || 0) <= 1) {
            log('6. Bot suppressed on agent_handling: PASS', 'green')
            pass++
          } else {
            log('6. Bot suppressed on agent_handling: FAIL', 'red')
            fail++
          }
        } else {
          log('5–6. API/agent tests: SKIP (no agents row)', 'yellow')
        }

        if (threadId) {
          await supabase.from('whatsapp_threads').delete().eq('id', threadId)
          log(`\n🧹 Cleaned up test thread ${threadId}`, 'yellow')
        }
      } catch (e) {
        log(`3+. Inbound/API test error: ${e instanceof Error ? e.message : String(e)}`, 'red')
        fail++
      }
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

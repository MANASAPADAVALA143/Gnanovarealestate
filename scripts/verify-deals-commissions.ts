#!/usr/bin/env tsx
/**
 * Deals + Commission layer verification:
 * 1. Check migrations 019/020 schema
 * 2. Create deal via POST /api/deals
 * 3. Reject commission advance when stage != closed_won
 * 4. Advance commission pending → submitted → approved → paid on closed_won deal
 * 5. Reject skip transition (pending → paid)
 */
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: '.env' })
dotenv.config({ path: '.env.local', override: true })

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const webhookBase =
  process.env.EXPRESS_BASE_URL?.replace(/\/$/, '') ||
  process.env.VITE_WEBHOOK_URL?.replace(/\/$/, '') ||
  'http://localhost:3001'

if (!url || !key) {
  console.error('❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required')
  process.exit(1)
}

const supabase = createClient(url, key)

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

async function checkSchema(): Promise<boolean> {
  const { error: dealsErr } = await supabase.from('deals').select('id').limit(1)
  if (dealsErr) {
    log(`❌ deals table missing — run 019_deals_module.sql — ${dealsErr.message}`, 'red')
    return false
  }

  const { error: colErr } = await supabase
    .from('deals')
    .select(
      'commission_status, commission_submitted_at, commission_approved_at, commission_paid_at, commission_payment_reference'
    )
    .limit(1)

  if (colErr) {
    log(`❌ commission columns missing — run 020_commission_status.sql — ${colErr.message}`, 'red')
    return false
  }

  const { error: actErr } = await supabase.from('deal_activities').select('id').limit(1)
  if (actErr) {
    log(`❌ deal_activities table missing — ${actErr.message}`, 'red')
    return false
  }

  log('✅ Migrations 019/020 schema present', 'green')
  return true
}

async function getAnyAgentId(): Promise<string | null> {
  const { data } = await supabase.from('agents').select('id').limit(1).maybeSingle()
  return (data as { id?: string } | null)?.id ?? null
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

async function testCreateDeal(agentId: string | null): Promise<string | null> {
  log('\n📝 Creating test deal via POST /api/deals…', 'cyan')

  const { ok, body } = await apiJson<{ deal?: { id: string }; error?: string }>('/api/deals', {
    method: 'POST',
    body: JSON.stringify({
      client_name: `Verify Deal ${Date.now()}`,
      agent_id: agentId,
      unit_number: '1204',
      project_name: 'Marina Gate',
      sale_value: 2500000,
      commission_percent: 2,
      stage: 'viewing',
    }),
  })

  if (!ok || !body.deal?.id) {
    log(`❌ Create deal failed: ${body.error || 'unknown'}`, 'red')
    log('   Is webhook server running? npm run webhook', 'yellow')
    return null
  }

  log(`✅ Deal created: ${body.deal.id}`, 'green')
  return body.deal.id
}

async function testCommissionBlockedBeforeClose(dealId: string): Promise<boolean> {
  log('\n🚫 Expect 400 when advancing commission on non-closed_won deal…', 'cyan')

  const { status, body } = await apiJson<{ error?: string }>(`/api/deals/${dealId}/commission`, {
    method: 'PATCH',
    body: JSON.stringify({ commission_status: 'submitted' }),
  })

  if (status !== 400) {
    log(`❌ Expected 400, got ${status}`, 'red')
    return false
  }

  if (!body.error?.includes('closed_won')) {
    log(`❌ Unexpected error message: ${body.error}`, 'red')
    return false
  }

  log(`✅ Blocked correctly: ${body.error}`, 'green')
  return true
}

async function closeDeal(dealId: string): Promise<boolean> {
  log('\n🏁 Setting deal stage → closed_won…', 'cyan')

  const { ok, body } = await apiJson<{ deal?: { stage: string }; error?: string }>(
    `/api/deals/${dealId}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ stage: 'closed_won' }),
    }
  )

  if (!ok || body.deal?.stage !== 'closed_won') {
    log(`❌ Failed to close deal: ${body.error || 'unknown'}`, 'red')
    return false
  }

  log('✅ Deal closed_won', 'green')
  return true
}

async function testCommissionWorkflow(dealId: string): Promise<boolean> {
  log('\n💰 Commission workflow pending → submitted → approved → paid…', 'cyan')

  for (const status of ['submitted', 'approved'] as const) {
    const { ok, body } = await apiJson<{ deal?: { commission_status: string }; error?: string }>(
      `/api/deals/${dealId}/commission`,
      {
        method: 'PATCH',
        body: JSON.stringify({ commission_status: status }),
      }
    )
    if (!ok || body.deal?.commission_status !== status) {
      log(`❌ Failed at ${status}: ${body.error || 'unknown'}`, 'red')
      return false
    }
    log(`   ✓ ${status}`, 'green')
  }

  const paidAttempt = await apiJson<{ error?: string; code?: string }>(
    `/api/deals/${dealId}/commission`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        commission_status: 'paid',
        commission_payment_reference: 'INV-VERIFY-001',
      }),
    }
  )

  if (!paidAttempt.ok) {
    log(`❌ paid step failed: ${paidAttempt.body.error}`, 'red')
    return false
  }
  log('   ✓ paid (with payment reference)', 'green')

  const skipAttempt = await apiJson<{ error?: string }>(`/api/deals/${dealId}/commission`, {
    method: 'PATCH',
    body: JSON.stringify({ commission_status: 'pending' }),
  })

  if (!skipAttempt.ok) {
    log(`❌ reset to pending failed: ${skipAttempt.body.error}`, 'red')
    return false
  }

  const skipToPaid = await apiJson<{ error?: string }>(`/api/deals/${dealId}/commission`, {
    method: 'PATCH',
    body: JSON.stringify({ commission_status: 'paid' }),
  })

  if (skipToPaid.status !== 400 && skipToPaid.status !== 422) {
    log(`❌ Expected block on pending→paid skip, got ${skipToPaid.status}`, 'red')
    return false
  }
  log('✅ Skip transition blocked after reset', 'green')

  return true
}

async function testCommissionsList(): Promise<boolean> {
  log('\n📋 GET /api/commissions + /api/commissions/summary…', 'cyan')

  const list = await apiJson<{ commissions?: unknown[] }>('/api/commissions')
  if (!list.ok) {
    log('❌ List commissions failed', 'red')
    return false
  }

  const summary = await apiJson<{ all_time?: { total_paid: number } }>('/api/commissions/summary')
  if (!summary.ok || summary.body.all_time == null) {
    log('❌ Commissions summary failed', 'red')
    return false
  }

  log(`✅ List: ${list.body.commissions?.length ?? 0} row(s), summary OK`, 'green')
  return true
}

async function cleanup(dealId: string) {
  await supabase.from('deal_activities').delete().eq('deal_id', dealId)
  await supabase.from('deals').delete().eq('id', dealId)
  log(`\n🧹 Cleaned up test deal ${dealId}`, 'yellow')
}

async function main() {
  console.log('\n' + '='.repeat(60))
  log('Deals + Commission Verification', 'cyan')
  console.log('='.repeat(60))

  if (!(await checkSchema())) {
    log('\nApply migrations in Supabase SQL Editor:', 'yellow')
    log('  supabase/migrations/019_deals_module.sql', 'yellow')
    log('  supabase/migrations/020_commission_status.sql', 'yellow')
    process.exit(1)
  }

  const agentId = await getAnyAgentId()
  const dealId = await testCreateDeal(agentId)
  if (!dealId) process.exit(1)

  let ok = true
  ok = (await testCommissionBlockedBeforeClose(dealId)) && ok
  ok = (await closeDeal(dealId)) && ok
  ok = (await testCommissionWorkflow(dealId)) && ok
  ok = (await testCommissionsList()) && ok

  await cleanup(dealId)

  console.log('\n' + '='.repeat(60))
  if (ok) {
    log('All deals + commission checks passed ✓', 'green')
  } else {
    log('Some checks failed — see above', 'red')
    process.exit(1)
  }
  console.log('='.repeat(60) + '\n')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

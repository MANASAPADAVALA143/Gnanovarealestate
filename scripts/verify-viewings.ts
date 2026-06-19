#!/usr/bin/env tsx
/**
 * Viewing Management verification (migration 022 + API).
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
  log('Viewing Management Verification', 'cyan')
  console.log('='.repeat(60))

  let pass = 0
  let fail = 0

  const { error: schemaErr } = await supabase.from('viewings').select('id').limit(1)
  if (schemaErr) {
    log(`❌ Migration 022 schema: FAIL — ${schemaErr.message}`, 'red')
    log('   Run supabase/migrations/022_viewing_management.sql in SQL Editor', 'yellow')
    process.exit(1)
  }
  log('✅ Migration 022 schema present', 'green')
  pass++

  const { data: agent } = await supabase.from('agents').select('id').limit(1).maybeSingle()
  const agentId = (agent as { id?: string } | null)?.id
  if (!agentId) {
    log('❌ No agent row — cannot run API tests', 'red')
    process.exit(1)
  }

  const { data: property } = await supabase.from('properties').select('id').limit(1).maybeSingle()
  const propertyId = (property as { id?: string } | null)?.id
  if (!propertyId) {
    log('⚠️  No property row — skipping create/update tests', 'yellow')
    process.exit(0)
  }

  const scheduledAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
  const clientName = `Verify Viewing ${Date.now()}`

  const create = await apiJson<{ viewing?: { id: string }; error?: string }>('/api/viewings', {
    method: 'POST',
    body: JSON.stringify({
      property_id: propertyId,
      agent_id: agentId,
      scheduled_at: scheduledAt,
      client_name: clientName,
      client_phone: '+15550001111',
      status: 'scheduled',
    }),
  })

  if (!create.ok || !create.body.viewing?.id) {
    log(`❌ POST /api/viewings: FAIL — ${create.body.error || create.status}`, 'red')
    fail++
    process.exit(1)
  }
  log('✅ POST /api/viewings', 'green')
  pass++

  const viewingId = create.body.viewing.id

  const list = await apiJson<{ viewings?: unknown[] }>(`/api/viewings?agent_id=${agentId}`)
  const upcoming = await apiJson<{ viewings?: unknown[]; today_count?: number }>(
    `/api/viewings/upcoming?agent_id=${agentId}`
  )

  if (list.ok && upcoming.ok) {
    log('✅ GET /api/viewings + /api/viewings/upcoming', 'green')
    pass++
  } else {
    log('❌ List/upcoming endpoints: FAIL (is webhook server on 3001?)', 'red')
    fail++
  }

  const complete = await apiJson<{ viewing?: { status?: string }; error?: string }>(
    `/api/viewings/${viewingId}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'completed',
        feedback: 'Liked the layout',
        interest_level: 'high',
      }),
    }
  )

  if (complete.ok && complete.body.viewing?.status === 'completed') {
    log('✅ PATCH /api/viewings/:id (completed + feedback)', 'green')
    pass++
  } else {
    log(`❌ PATCH complete: FAIL — ${complete.body.error || complete.status}`, 'red')
    fail++
  }

  const { data: lead } = await supabase
    .from('leads')
    .select('id')
    .eq('agent_id', agentId)
    .limit(1)
    .maybeSingle()

  if (lead?.id) {
    const withLead = await apiJson<{ viewing?: { id: string } }>('/api/viewings', {
      method: 'POST',
      body: JSON.stringify({
        property_id: propertyId,
        agent_id: agentId,
        lead_id: lead.id,
        scheduled_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    })

    if (withLead.ok && withLead.body.viewing?.id) {
      await apiJson(`/api/viewings/${withLead.body.viewing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'completed', interest_level: 'medium' }),
      })

      const { data: activity } = await supabase
        .from('lead_activities')
        .select('content, type')
        .eq('lead_id', lead.id)
        .eq('type', 'viewing')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (activity?.content?.includes('Viewing completed')) {
        log('✅ Completed trigger → lead_activities', 'green')
        pass++
      } else {
        log('❌ lead_activities viewing row missing after completed', 'red')
        fail++
      }

      await supabase.from('viewings').delete().eq('id', withLead.body.viewing.id)
    }
  } else {
    log('⚠️  No lead for activity trigger test — skipped', 'yellow')
  }

  await supabase.from('viewings').delete().eq('id', viewingId)
  log(`\n🧹 Cleaned up test viewing ${viewingId}`, 'yellow')

  console.log('\n' + '='.repeat(60))
  log(`Passed: ${pass}  Failed: ${fail}`, fail ? 'red' : 'green')
  console.log('='.repeat(60) + '\n')

  if (fail > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

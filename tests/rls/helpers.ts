import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export type TestAgent = {
  id: string
  email: string
  password: string
  label: 'A' | 'B'
}

export function env(name: string, ...aliases: string[]): string | undefined {
  for (const key of [name, ...aliases]) {
    const v = process.env[key]?.trim()
    if (v) return v
  }
  return undefined
}

export function getSupabaseConfig() {
  const url = env('SUPABASE_URL', 'VITE_SUPABASE_URL')
  const anonKey = env('VITE_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY')
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY')
  return { url, anonKey, serviceKey }
}

export function supabaseReady(): boolean {
  const { url, anonKey, serviceKey } = getSupabaseConfig()
  return Boolean(url && anonKey && serviceKey)
}

export function createServiceClient(): SupabaseClient {
  const { url, anonKey, serviceKey } = getSupabaseConfig()
  if (!url || !serviceKey) {
    throw new Error('SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required for RLS tests')
  }
  void anonKey
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export function createAnonClient(): SupabaseClient {
  const { url, anonKey } = getSupabaseConfig()
  if (!url || !anonKey) {
    throw new Error('SUPABASE_URL + VITE_SUPABASE_ANON_KEY required')
  }
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/** Sign in with anon key — RLS applies as this user (never use service role for isolation asserts). */
export async function signInAs(agent: TestAgent): Promise<SupabaseClient> {
  const client = createAnonClient()
  const { error } = await client.auth.signInWithPassword({
    email: agent.email,
    password: agent.password,
  })
  if (error) throw new Error(`signIn ${agent.label} failed: ${error.message}`)
  return client
}

export async function tableExists(
  service: SupabaseClient,
  table: string
): Promise<boolean> {
  const { error } = await service.from(table).select('*').limit(1)
  if (!error) return true
  // 42P01 / PGRST205 = missing relation
  const msg = error.message.toLowerCase()
  if (msg.includes('does not exist') || msg.includes('could not find') || error.code === '42P01') {
    return false
  }
  // Other errors (RLS empty, etc.) still mean the table exists
  return true
}

/**
 * Create auth user + matching agents row (agents.id = auth.users.id).
 * Uses service role — bypasses RLS for fixture setup only.
 */
export async function createTestAgent(
  service: SupabaseClient,
  label: 'A' | 'B'
): Promise<TestAgent> {
  const stamp = Date.now()
  const email = `rls-test-${label.toLowerCase()}-${stamp}@gnanova.test`
  const password = `RlsTest-${label}-${stamp}!Aa1`

  const { data: created, error: createErr } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `RLS Test Agent ${label}` },
  })
  if (createErr || !created.user) {
    throw new Error(`createUser ${label}: ${createErr?.message ?? 'no user'}`)
  }

  const id = created.user.id
  const { error: agentErr } = await service.from('agents').upsert(
    {
      id,
      email,
      full_name: `RLS Test Agent ${label}`,
      phone: null,
      company_name: 'Gnanova RLS Tests',
      location: 'Test',
      is_manager: false,
      subscription_tier: 'trial',
      subscription_status: 'trialing',
    },
    { onConflict: 'id' }
  )
  if (agentErr) {
    await service.auth.admin.deleteUser(id)
    throw new Error(`agents upsert ${label}: ${agentErr.message}`)
  }

  return { id, email, password, label }
}

export async function destroyTestAgent(
  service: SupabaseClient,
  agent: TestAgent
): Promise<void> {
  // Best-effort cleanup of seeded rows owned by this agent
  const ownedTables: Array<{ table: string; column: string }> = [
    { table: 'open_house_attendees', column: '_via_events_' },
    { table: 'open_house_events', column: 'agent_id' },
    { table: 'deal_activities', column: '_via_deals_' },
    { table: 'deals', column: 'agent_id' },
    { table: 'calls', column: 'agent_id' },
    { table: 'viewings', column: 'agent_id' },
    { table: 'bookings', column: 'agent_id' },
    { table: 'whatsapp_threads', column: 'assigned_agent_id' },
    { table: 'outbound_campaigns', column: 'agent_id' },
    { table: 'lead_tasks', column: 'agent_id' },
    { table: 'leads', column: 'agent_id' },
    { table: 'properties', column: 'agent_id' },
  ]

  // Delete attendees for this agent's events first
  if (await tableExists(service, 'open_house_events')) {
    const { data: events } = await service
      .from('open_house_events')
      .select('id')
      .eq('agent_id', agent.id)
    const eventIds = (events ?? []).map((e) => e.id)
    if (eventIds.length && (await tableExists(service, 'open_house_attendees'))) {
      await service.from('open_house_attendees').delete().in('open_house_id', eventIds)
    }
  }

  if (await tableExists(service, 'deals')) {
    const { data: deals } = await service.from('deals').select('id').eq('agent_id', agent.id)
    const dealIds = (deals ?? []).map((d) => d.id)
    if (dealIds.length && (await tableExists(service, 'deal_activities'))) {
      await service.from('deal_activities').delete().in('deal_id', dealIds)
    }
  }

  for (const { table, column } of ownedTables) {
    if (column.startsWith('_')) continue
    if (!(await tableExists(service, table))) continue
    await service.from(table).delete().eq(column, agent.id)
  }

  await service.from('agents').delete().eq('id', agent.id)
  await service.auth.admin.deleteUser(agent.id)
}

export function skipMessage(): string {
  return (
    'Skipping live RLS tests — set SUPABASE_URL (or VITE_SUPABASE_URL), ' +
    'VITE_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY'
  )
}

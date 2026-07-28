import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export type AgentAuth = { agentId: string }

function supabaseUrl(): string | undefined {
  return (
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL
  )?.trim()
}

function anonKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY
  )?.trim()
}

/**
 * Authenticate a dashboard API caller via Authorization: Bearer <access_token>.
 * agents.id === auth.uid() — never trust client-supplied agent_id.
 */
export async function requireAgent(
  req: NextRequest
): Promise<AgentAuth | NextResponse> {
  const header = req.headers.get('authorization') || req.headers.get('Authorization')
  const match = header?.match(/^Bearer\s+(.+)$/i)
  const token = match?.[1]?.trim()

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = supabaseUrl()
  const key = anonKey()
  if (!url || !key) {
    console.error('[requireAgent] Supabase URL / anon key not configured')
    return NextResponse.json({ error: 'Auth not configured' }, { status: 500 })
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return { agentId: data.user.id }
}

export function isAgentAuth(value: AgentAuth | NextResponse): value is AgentAuth {
  return !(value instanceof NextResponse) && typeof (value as AgentAuth).agentId === 'string'
}

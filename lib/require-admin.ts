import { NextRequest, NextResponse } from 'next/server'
import { isAgentAuth, requireAgent } from './require-agent'
import { getSupabaseServiceClient } from './supabase-service'

export type AdminAuth = {
  agentId: string
  isManager: boolean
  isOwner: boolean
  fullName: string | null
}

export function isAdminAuth(value: AdminAuth | NextResponse): value is AdminAuth {
  return !(value instanceof NextResponse) && typeof (value as AdminAuth).agentId === 'string'
}

async function loadAdminAuth(agentId: string): Promise<AdminAuth | null> {
  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('agents')
    .select('id, full_name, is_manager, is_owner')
    .eq('id', agentId)
    .maybeSingle()

  if (error || !data) return null

  const row = data as {
    id: string
    full_name: string | null
    is_manager?: boolean | null
    is_owner?: boolean | null
  }

  const isOwner = Boolean(row.is_owner)
  const isManager = Boolean(row.is_manager) || isOwner

  if (!isManager && !isOwner) return null

  return {
    agentId: row.id,
    isManager,
    isOwner,
    fullName: row.full_name,
  }
}

/** Manager or owner (same as Integrations / is_deal_manager after 030). */
export async function requireManagerOrOwner(
  req: NextRequest
): Promise<AdminAuth | NextResponse> {
  const agent = await requireAgent(req)
  if (!isAgentAuth(agent)) return agent

  try {
    const admin = await loadAdminAuth(agent.agentId)
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return admin
  } catch (e) {
    console.error('[requireManagerOrOwner]', e)
    return NextResponse.json({ error: 'Auth check failed' }, { status: 500 })
  }
}

/** Owner only — rank override, promote/demote, availability toggle. */
export async function requireOwner(
  req: NextRequest
): Promise<AdminAuth | NextResponse> {
  const admin = await requireManagerOrOwner(req)
  if (!isAdminAuth(admin)) return admin
  if (!admin.isOwner) {
    return NextResponse.json({ error: 'Owner only' }, { status: 403 })
  }
  return admin
}

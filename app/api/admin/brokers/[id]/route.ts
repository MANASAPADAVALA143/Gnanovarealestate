import { NextRequest, NextResponse } from 'next/server'
import { writeAdminAudit } from '../../../../../lib/admin-audit'
import { isAdminAuth, requireOwner } from '../../../../../lib/require-admin'
import { getSupabaseServiceClient } from '../../../../../lib/supabase-service'

export const runtime = 'nodejs'

type PatchBody = {
  broker_rank_score?: number
  is_available?: boolean
  is_manager?: boolean
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  const auth = await requireOwner(req)
  if (!isAdminAuth(auth)) return auth

  const params = await Promise.resolve(context.params)
  const targetId = params.id?.trim()
  if (!targetId) {
    return NextResponse.json({ error: 'Missing broker id' }, { status: 400 })
  }

  let body: PatchBody
  try {
    body = (await req.json()) as PatchBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const hasRank = typeof body.broker_rank_score === 'number'
  const hasAvail = typeof body.is_available === 'boolean'
  const hasManager = typeof body.is_manager === 'boolean'
  const changeCount = [hasRank, hasAvail, hasManager].filter(Boolean).length

  if (changeCount !== 1) {
    return NextResponse.json(
      {
        error:
          'Send exactly one of: broker_rank_score, is_available, or is_manager',
      },
      { status: 400 }
    )
  }

  if (hasManager && targetId === auth.agentId) {
    return NextResponse.json({ error: 'Cannot change your own manager flag' }, { status: 400 })
  }

  try {
    const supabase = getSupabaseServiceClient()

    const { data: existing, error: fetchErr } = await supabase
      .from('agents')
      .select(
        'id, full_name, is_available, is_manager, is_owner, broker_rank_score, rank_factors, rank_updated_at'
      )
      .eq('id', targetId)
      .maybeSingle()

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    }
    if (!existing) {
      return NextResponse.json({ error: 'Broker not found' }, { status: 404 })
    }

    const row = existing as {
      id: string
      full_name: string | null
      is_available: boolean | null
      is_manager: boolean | null
      is_owner: boolean | null
      broker_rank_score: number | null
      rank_factors: Record<string, unknown> | null
      rank_updated_at: string | null
    }

    if (hasManager && row.is_owner && body.is_manager === false) {
      return NextResponse.json(
        { error: 'Cannot demote an owner from manager; clear is_owner in SQL first' },
        { status: 400 }
      )
    }

    const update: Record<string, unknown> = {}
    let action = ''
    let oldValue: Record<string, unknown> = {}
    let newValue: Record<string, unknown> = {}

    if (hasRank) {
      const score = Number(body.broker_rank_score)
      if (!Number.isFinite(score) || score < 0 || score > 100) {
        return NextResponse.json(
          { error: 'broker_rank_score must be between 0 and 100' },
          { status: 400 }
        )
      }
      const prevFactors =
        row.rank_factors && typeof row.rank_factors === 'object' ? { ...row.rank_factors } : {}
      const nextFactors = {
        ...prevFactors,
        manual_override: true,
        overridden_by: auth.agentId,
        overridden_at: new Date().toISOString(),
      }
      update.broker_rank_score = Math.round(score * 100) / 100
      update.rank_factors = nextFactors
      update.rank_updated_at = new Date().toISOString()
      action = 'rank_override'
      oldValue = {
        broker_rank_score: row.broker_rank_score,
        rank_factors: row.rank_factors,
      }
      newValue = {
        broker_rank_score: update.broker_rank_score,
        rank_factors: nextFactors,
      }
    } else if (hasAvail) {
      update.is_available = body.is_available
      action = body.is_available ? 'set_available' : 'set_blocked'
      oldValue = { is_available: row.is_available !== false }
      newValue = { is_available: body.is_available }
    } else if (hasManager) {
      update.is_manager = body.is_manager
      action = body.is_manager ? 'promote_manager' : 'demote_manager'
      oldValue = { is_manager: Boolean(row.is_manager) }
      newValue = { is_manager: body.is_manager }
    }

    const { data: updated, error: updErr } = await supabase
      .from('agents')
      .update(update as never)
      .eq('id', targetId)
      .select(
        'id, full_name, email, is_available, is_manager, is_owner, broker_rank_score, rank_factors, rank_updated_at'
      )
      .single()

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 })
    }

    await writeAdminAudit(supabase, {
      action,
      performedBy: auth.agentId,
      targetAgentId: targetId,
      oldValue,
      newValue,
    })

    return NextResponse.json({ broker: updated, action })
  } catch (e) {
    console.error('[admin/brokers PATCH]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Update failed' },
      { status: 500 }
    )
  }
}

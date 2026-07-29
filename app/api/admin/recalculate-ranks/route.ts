import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuth, requireManagerOrOwner } from '../../../../lib/require-admin'
import { getSupabaseServiceClient } from '../../../../lib/supabase-service'
import { calculateBrokerRankForAll } from '../../../../server/lib/broker-rank'

export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * Fire-and-forget recalculation. Returns 202 immediately.
 * Work continues on the Node process (local / long-lived); on short serverless
 * hosts the job may be cut short — operators can re-run if needed.
 */
export async function POST(req: NextRequest) {
  const auth = await requireManagerOrOwner(req)
  if (!isAdminAuth(auth)) return auth

  try {
    const supabase = getSupabaseServiceClient()

    void calculateBrokerRankForAll(supabase)
      .then((results) => {
        console.log(
          `[admin/recalculate-ranks] done by ${auth.agentId}: ${results.length} agent(s)`
        )
      })
      .catch((err) => {
        console.error('[admin/recalculate-ranks] background failure', err)
      })

    return NextResponse.json(
      {
        ok: true,
        message: 'Recalculation started',
        started_by: auth.agentId,
      },
      { status: 202 }
    )
  } catch (e) {
    console.error('[admin/recalculate-ranks]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to start recalculation' },
      { status: 500 }
    )
  }
}

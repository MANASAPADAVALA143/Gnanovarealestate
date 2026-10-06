import { NextRequest, NextResponse } from 'next/server'
import { isAgentAuth, requireAgent } from '../../../../lib/require-agent'
import { getSupabaseServiceClient } from '../../../../lib/supabase-service'
import { syncSuiteBalance } from '../../../../lib/suite-balance'

export const runtime = 'nodejs'

const PAYMENT_STATUSES = new Set(['Pending', 'Paid', 'Overdue'])

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAgent(req)
    if (!isAgentAuth(auth)) return auth

    const id = params.id?.trim()
    if (!id) return NextResponse.json({ error: 'Payment id required' }, { status: 400 })

    const body = (await req.json()) as Record<string, unknown>
    const supabase = getSupabaseServiceClient()
    const { data: existing, error: findErr } = await supabase
      .from('payments')
      .select('id, suite_id, status')
      .eq('id', id)
      .maybeSingle()
    if (findErr) throw new Error(findErr.message)
    if (!existing) return NextResponse.json({ error: 'Payment not found' }, { status: 404 })

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (typeof body.status === 'string') {
      if (!PAYMENT_STATUSES.has(body.status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
      }
      patch.status = body.status
      if (body.status === 'Paid' && !body.paid_date) {
        patch.paid_date = new Date().toISOString()
      }
    }
    if (body.paid_date !== undefined) patch.paid_date = body.paid_date || null
    if (body.payment_method !== undefined) patch.payment_method = body.payment_method || null
    if (body.utr_number !== undefined) patch.utr_number = body.utr_number || null
    if (typeof body.receipt_sent === 'boolean') patch.receipt_sent = body.receipt_sent

    const { data, error } = await supabase.from('payments').update(patch).eq('id', id).select('*').single()
    if (error) throw new Error(error.message)

    if (existing.suite_id) {
      await syncSuiteBalance(supabase, existing.suite_id)
    }

    return NextResponse.json({ payment: data })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Request failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { isAgentAuth, requireAgent } from '../../../../lib/require-agent'
import { getSupabaseServiceClient } from '../../../../lib/supabase-service'

export const runtime = 'nodejs'

const SUITE_STATUSES = new Set(['Available', 'Booked', 'Blocked', 'Sold'])

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAgent(req)
    if (!isAgentAuth(auth)) return auth

    const id = params.id?.trim()
    if (!id) return NextResponse.json({ error: 'Suite id required' }, { status: 400 })

    const supabase = getSupabaseServiceClient()
    const { data: suite, error } = await supabase.from('suites').select('*').eq('id', id).maybeSingle()
    if (error) throw new Error(error.message)
    if (!suite) return NextResponse.json({ error: 'Suite not found' }, { status: 404 })

    const { data: payments, error: payErr } = await supabase
      .from('payments')
      .select(
        'id, installment_number, installment_amount, due_date, paid_date, status, payment_method, utr_number, receipt_sent, customer_name, customer_phone, booking_amount, total_price, suite_number'
      )
      .eq('suite_id', id)
      .order('installment_number', { ascending: true })

    if (payErr) throw new Error(payErr.message)

    return NextResponse.json({ suite, payments: payments || [] })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Request failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAgent(req)
    if (!isAgentAuth(auth)) return auth

    const id = params.id?.trim()
    if (!id) return NextResponse.json({ error: 'Suite id required' }, { status: 400 })

    const body = (await req.json()) as Record<string, unknown>
    const supabase = getSupabaseServiceClient()
    const { data: existing, error: findErr } = await supabase
      .from('suites')
      .select('id, price, payment_received')
      .eq('id', id)
      .maybeSingle()
    if (findErr) throw new Error(findErr.message)
    if (!existing) return NextResponse.json({ error: 'Suite not found' }, { status: 404 })

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (typeof body.status === 'string') {
      if (!SUITE_STATUSES.has(body.status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
      }
      patch.status = body.status
    }
    if (body.customer_name !== undefined) patch.customer_name = body.customer_name || null
    if (body.customer_id !== undefined) patch.customer_id = body.customer_id || null
    if (body.booking_date !== undefined) patch.booking_date = body.booking_date || null
    if (body.notes !== undefined) patch.notes = body.notes || null
    if (body.payment_received !== undefined) {
      const received = Number(body.payment_received)
      if (!Number.isFinite(received)) {
        return NextResponse.json({ error: 'Invalid payment_received' }, { status: 400 })
      }
      patch.payment_received = received
    }

    const received = Number(patch.payment_received ?? existing.payment_received ?? 0)
    const price = Number(existing.price ?? 0)
    patch.payment_received = received
    patch.balance_amount = price - received

    const { data, error } = await supabase.from('suites').update(patch).eq('id', id).select('*').single()
    if (error) throw new Error(error.message)
    return NextResponse.json({ suite: data })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Request failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}

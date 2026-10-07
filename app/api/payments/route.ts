import { NextRequest, NextResponse } from 'next/server'
import { isAgentAuth, requireAgent } from '@/lib/require-agent'
import { getSupabaseServiceClient } from '@/lib/supabase-service'
import { syncSuiteBalance } from '@/lib/suite-balance'

export const runtime = 'nodejs'

const PAYMENT_STATUSES = new Set(['Pending', 'Paid', 'Overdue'])

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAgent(req)
    if (!isAgentAuth(auth)) return auth

    const { searchParams } = new URL(req.url)
    const status = (searchParams.get('status') || '').trim()
    const suiteId = (searchParams.get('suite_id') || '').trim()
    const limit = Math.min(500, Math.max(1, Number(searchParams.get('limit') ?? 200)))

    if (status && !PAYMENT_STATUSES.has(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const supabase = getSupabaseServiceClient()
    let query = supabase
      .from('payments')
      .select(
        'id, customer_name, customer_phone, suite_id, suite_number, total_price, booking_amount, installment_number, installment_amount, due_date, paid_date, payment_method, utr_number, status, receipt_sent, created_at, suites ( suite_number )'
      )
      .order('suite_number', { ascending: true })
      .order('installment_number', { ascending: true })
      .limit(limit)

    if (status) query = query.eq('status', status)
    if (suiteId) query = query.eq('suite_id', suiteId)

    const { data, error } = await query
    if (error) throw new Error(error.message)

    const payments = (data || []).map((row) => {
      const suiteEmbed = (row as { suites?: { suite_number?: string } | { suite_number?: string }[] | null }).suites
      const suite = Array.isArray(suiteEmbed) ? suiteEmbed[0] : suiteEmbed
      const { suites: _s, ...payment } = row as Record<string, unknown>
      return {
        ...payment,
        suite_number: suite?.suite_number || payment.suite_number || null,
      }
    })

    return NextResponse.json({ payments })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Request failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAgent(req)
    if (!isAgentAuth(auth)) return auth

    const body = (await req.json()) as Record<string, unknown>
    const suite_id = String(body.suite_id || '').trim()
    const customer_name = String(body.customer_name || '').trim()
    const total_price = Number(body.total_price)
    const installment_number = Number(body.installment_number)
    const installment_amount = Number(body.installment_amount)
    const due_date = String(body.due_date || '').trim()
    const booking_amount = Number(body.booking_amount ?? 0)
    const status = String(body.status || 'Pending')

    if (!suite_id) return NextResponse.json({ error: 'suite_id is required' }, { status: 400 })
    if (!customer_name) return NextResponse.json({ error: 'customer_name is required' }, { status: 400 })
    if (!Number.isFinite(total_price)) return NextResponse.json({ error: 'total_price is required' }, { status: 400 })
    if (!Number.isFinite(installment_number)) {
      return NextResponse.json({ error: 'installment_number is required' }, { status: 400 })
    }
    if (!Number.isFinite(installment_amount)) {
      return NextResponse.json({ error: 'installment_amount is required' }, { status: 400 })
    }
    if (!due_date) return NextResponse.json({ error: 'due_date is required' }, { status: 400 })
    if (!PAYMENT_STATUSES.has(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })

    const supabase = getSupabaseServiceClient()
    const { data, error } = await supabase
      .from('payments')
      .insert({
        suite_id,
        customer_name,
        customer_phone: typeof body.customer_phone === 'string' ? body.customer_phone : null,
        suite_number: typeof body.suite_number === 'string' ? body.suite_number : null,
        total_price,
        booking_amount: Number.isFinite(booking_amount) ? booking_amount : 0,
        installment_number,
        installment_amount,
        due_date,
        payment_method: typeof body.payment_method === 'string' ? body.payment_method : null,
        utr_number: typeof body.utr_number === 'string' ? body.utr_number : null,
        status,
      })
      .select('*')
      .single()

    if (error) throw new Error(error.message)
    await syncSuiteBalance(supabase, suite_id)
    return NextResponse.json({ payment: data }, { status: 201 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Request failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}

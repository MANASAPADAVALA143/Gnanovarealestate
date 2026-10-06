import { NextRequest, NextResponse } from 'next/server'
import { isAgentAuth, requireAgent } from '../../../lib/require-agent'
import { getSupabaseServiceClient } from '../../../lib/supabase-service'

export const runtime = 'nodejs'

const SUITE_STATUSES = new Set(['Available', 'Booked', 'Blocked', 'Sold'])

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAgent(req)
    if (!isAgentAuth(auth)) return auth

    const { searchParams } = new URL(req.url)
    const status = (searchParams.get('status') || '').trim()
    const q = (searchParams.get('q') || '').trim()

    if (status && !SUITE_STATUSES.has(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const supabase = getSupabaseServiceClient()
    const columns =
      'id, suite_number, floor, size_sqft, status, price, customer_name, customer_id, booking_date, payment_received, balance_amount, notes, created_at'

    const withFilters = (select: string) => {
      let query = supabase
        .from('suites')
        .select(select)
        .order('floor', { ascending: true })
        .order('suite_number', { ascending: true })
        .limit(500)
      if (status) query = query.eq('status', status)
      if (q) {
        const escaped = q.replace(/[%_,]/g, '')
        query = query.or(`suite_number.ilike.%${escaped}%,customer_name.ilike.%${escaped}%`)
      }
      return query
    }

    let { data, error } = await withFilters(`${columns}, leads ( name )`)
    if (error) {
      const retry = await withFilters(columns)
      if (retry.error) throw new Error(retry.error.message)
      data = retry.data
    }

    const suites = (data || []).map((row) => {
      const leadEmbed = (row as { leads?: { name?: string } | { name?: string }[] | null }).leads
      const lead = Array.isArray(leadEmbed) ? leadEmbed[0] : leadEmbed
      const { leads: _leads, ...suite } = row as Record<string, unknown>
      return {
        ...suite,
        lead_name: lead?.name || suite.customer_name || null,
      }
    })

    return NextResponse.json({ suites })
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
    const suite_number = String(body.suite_number || '').trim()
    const floor = Number(body.floor)
    const size_sqft = Number(body.size_sqft)
    const price = Number(body.price)
    const status = String(body.status || 'Available')

    if (!suite_number) return NextResponse.json({ error: 'suite_number is required' }, { status: 400 })
    if (!Number.isFinite(floor)) return NextResponse.json({ error: 'floor is required' }, { status: 400 })
    if (!Number.isFinite(size_sqft)) return NextResponse.json({ error: 'size_sqft is required' }, { status: 400 })
    if (!Number.isFinite(price)) return NextResponse.json({ error: 'price is required' }, { status: 400 })
    if (!SUITE_STATUSES.has(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })

    const supabase = getSupabaseServiceClient()
    const { data, error } = await supabase
      .from('suites')
      .insert({
        suite_number,
        floor,
        size_sqft,
        price,
        status,
        notes: typeof body.notes === 'string' ? body.notes : null,
        payment_received: 0,
        balance_amount: price,
      })
      .select('*')
      .single()

    if (error) throw new Error(error.message)
    return NextResponse.json({ suite: data }, { status: 201 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Request failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}

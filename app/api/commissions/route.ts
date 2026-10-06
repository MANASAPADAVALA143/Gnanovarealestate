import { NextRequest, NextResponse } from 'next/server'
import { isAgentAuth, requireAgent } from '../../../lib/require-agent'
import { getSupabaseServiceClient } from '../../../lib/supabase-service'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAgent(req)
    if (!isAgentAuth(auth)) return auth
    const { searchParams } = new URL(req.url)
    const status = (searchParams.get('status') || '').trim()
    const supabase = getSupabaseServiceClient()

    const { data: deals, error: dealErr } = await supabase
      .from('deals')
      .select('sale_value, commission_percent, agent_commission, brokerage_commission, agent_id')
      .eq('agent_id', auth.agentId)
    if (dealErr) throw new Error(dealErr.message)

    let totalSales = 0
    let gross = 0
    let agentComm = 0
    let brokerage = 0
    for (const d of deals || []) {
      const sale = Number(d.sale_value) || 0
      const pct = Number(d.commission_percent) || 0
      totalSales += sale
      gross += (sale * pct) / 100
      agentComm += Number(d.agent_commission) || 0
      brokerage += Number(d.brokerage_commission) || 0
    }

    let invQ = supabase
      .from('broker_invoices')
      .select(
        'id, broker_id, commission_id, invoice_number, amount, status, due_date, pdf_url, amount_paid, agents ( full_name ), deals ( project_name, unit_number, client_name )'
      )
      .eq('broker_id', auth.agentId)
      .order('created_at', { ascending: false })
    if (status) invQ = invQ.eq('status', status)
    const { data: invoices, error: invErr } = await invQ
    if (invErr) throw new Error(invErr.message)

    const pending = (invoices || [])
      .filter((i) => ['draft', 'sent', 'overdue', 'partial'].includes(String(i.status)))
      .reduce((s, i) => s + (Number(i.amount) - Number(i.amount_paid || 0)), 0)
    const paid = (invoices || [])
      .filter((i) => i.status === 'paid')
      .reduce((s, i) => s + Number(i.amount || 0), 0)

    return NextResponse.json({
      kpis: {
        totalSales,
        gross,
        agentComm,
        brokerage,
        pending,
        paid,
      },
      invoices: invoices || [],
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Request failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAgent(req)
    if (!isAgentAuth(auth)) return auth
    const body = (await req.json()) as { invoiceId?: string; status?: string }
    const invoiceId = body.invoiceId?.trim()
    if (!invoiceId) return NextResponse.json({ error: 'invoiceId required' }, { status: 400 })
    const status = body.status === 'paid' ? 'paid' : null
    if (!status) return NextResponse.json({ error: 'Only mark paid is supported' }, { status: 400 })

    const supabase = getSupabaseServiceClient()
    const { data, error } = await supabase
      .from('broker_invoices')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', invoiceId)
      .eq('broker_id', auth.agentId)
      .select('id, status')
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    return NextResponse.json({ invoice: data })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Request failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}

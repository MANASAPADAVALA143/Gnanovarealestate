import { supabase } from './supabase'

export type DateRange = 'today' | 'week' | 'month'

export function getDateBounds(range: DateRange): { from: string; to: string } {
  const now = new Date()
  const to = now.toISOString().split('T')[0]
  let from = to
  if (range === 'week') {
    const d = new Date(now)
    d.setDate(d.getDate() - 6)
    from = d.toISOString().split('T')[0]
  } else if (range === 'month') {
    const d = new Date(now)
    d.setDate(d.getDate() - 29)
    from = d.toISOString().split('T')[0]
  }
  return { from, to }
}

export async function fetchKpis(range: DateRange) {
  const { from, to } = getDateBounds(range)

  const [leadsRes, visitsRes, paymentsRes, suitesRes] = await Promise.all([
    supabase.from('leads').select('id', { count: 'exact', head: true })
      .gte('created_at', from).lte('created_at', to + 'T23:59:59'),
    supabase.from('bookings').select('id', { count: 'exact', head: true })
      .gte('scheduled_date', from).lte('scheduled_date', to),
    supabase.from('payments').select('installment_amount')
      .eq('status', 'Paid').gte('paid_date', from).lte('paid_date', to),
    supabase.from('payments').select('installment_amount').eq('status', 'Pending'),
  ])

  const collected = (paymentsRes.data ?? []).reduce((s: number, p: { installment_amount: number }) => s + p.installment_amount, 0)
  const outstanding = (suitesRes.data ?? []).reduce((s: number, p: { installment_amount: number }) => s + p.installment_amount, 0)

  return {
    totalLeads: leadsRes.count ?? 0,
    siteVisits: visitsRes.count ?? 0,
    paymentsCollected: collected,
    outstanding,
  }
}

export async function fetchSuiteStats() {
  const { data } = await supabase.from('suite_inventory').select('status')
  const counts: Record<string, number> = { Available: 0, Booked: 0, Sold: 0, Blocked: 0 }
  ;(data ?? []).forEach((s: { status: string }) => {
    const k = s.status as string
    counts[k] = (counts[k] ?? 0) + 1
  })
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  return { counts, total }
}

export async function fetchLeadSourceData(range: DateRange) {
  const { from, to } = getDateBounds(range)
  const { data } = await supabase.from('leads').select('source')
    .gte('created_at', from).lte('created_at', to + 'T23:59:59')
  const map: Record<string, number> = {}
  ;(data ?? []).forEach((l: { source: string | null }) => {
    const k = l.source || 'Other'
    map[k] = (map[k] ?? 0) + 1
  })
  return Object.entries(map).map(([name, value]) => ({ name, value }))
}

export async function fetchDailyLeads(days = 30) {
  const from = new Date()
  from.setDate(from.getDate() - (days - 1))
  const fromStr = from.toISOString().split('T')[0]
  const { data } = await supabase.from('leads').select('created_at')
    .gte('created_at', fromStr)
  const map: Record<string, number> = {}
  for (let i = 0; i < days; i++) {
    const d = new Date(from)
    d.setDate(d.getDate() + i)
    map[d.toISOString().split('T')[0]] = 0
  }
  ;(data ?? []).forEach((l: { created_at: string }) => {
    const day = l.created_at.split('T')[0]
    if (day in map) map[day]++
  })
  return Object.entries(map).map(([date, count]) => ({ date: date.slice(5), count }))
}

export async function fetchMonthlyRevenue() {
  const { data } = await supabase.from('payments').select('paid_date, installment_amount').eq('status', 'Paid')
  const map: Record<string, number> = {}
  ;(data ?? []).forEach((p: { paid_date: string | null; installment_amount: number }) => {
    if (!p.paid_date) return
    const m = p.paid_date.slice(0, 7)
    map[m] = (map[m] ?? 0) + p.installment_amount
  })
  const sorted = Object.entries(map).sort((a, b) => a[0].localeCompare(b[0])).slice(-6)
  return sorted.map(([month, revenue]) => ({ month: month.slice(5), revenue, target: revenue * 1.2 }))
}

export async function fetchHotLeads(limit = 10) {
  const today = new Date().toISOString().split('T')[0]
  const { data } = await supabase.from('leads')
    .select('id, name, phone, source, ai_score, lead_status, created_at')
    .gte('created_at', today)
    .order('ai_score', { ascending: false })
    .limit(limit)
  return data ?? []
}

export async function fetchOverduePayments(limit = 10) {
  const { data } = await supabase.from('payments')
    .select('id, customer_name, customer_phone, suite_number, installment_amount, due_date, installment_number')
    .eq('status', 'Overdue')
    .order('due_date', { ascending: true })
    .limit(limit)
  return data ?? []
}

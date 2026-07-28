import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from 'recharts'
import {
  format,
  subDays,
  eachDayOfInterval,
  startOfDay,
  endOfDay,
  parseISO,
  differenceInSeconds,
} from 'date-fns'
import { TrendingUp, TrendingDown, Download } from 'lucide-react'

type RangeDays = 30 | 60 | 90

type LeadRow = {
  id: string
  name: string | null
  phone: string
  email: string | null
  source: string | null
  status: string
  agent_id: string | null
  created_at: string
  lead_score: number | null
}

type CallRow = {
  id: string
  lead_id: string | null
  agent_id: string | null
  created_at: string
  started_at?: string | null
}

type BookingRow = {
  id: string
  lead_id: string | null
  agent_id: string | null
  scheduled_date: string
  created_at?: string | null
}

type AgentRow = { id: string; full_name: string | null }

const SOURCE_KEYS = ['Zillow', 'Realtor.com', 'Web', 'Open House', 'Manual', 'Referral'] as const

const BAR_COLORS = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#64748b']

function sourceBucket(raw: string | null | undefined): (typeof SOURCE_KEYS)[number] {
  if (!raw) return 'Manual'
  const s = raw.toLowerCase()
  if (s.includes('zillow')) return 'Zillow'
  if (s.includes('realtor')) return 'Realtor.com'
  if (s.includes('open') && s.includes('house')) return 'Open House'
  if (s.includes('referral')) return 'Referral'
  if (s === 'web' || s === 'website' || s.includes('vapi') || s.includes('portal')) return 'Web'
  return 'Manual'
}

function isClosedStatus(status: string): boolean {
  const u = status.toLowerCase()
  return ['closed', 'won', 'sold', 'converted'].some((x) => u.includes(x))
}

function pctChange(curr: number, prev: number): { pct: number; up: boolean } {
  if (prev === 0 && curr === 0) return { pct: 0, up: true }
  if (prev === 0) return { pct: 100, up: true }
  const raw = ((curr - prev) / prev) * 100
  return { pct: Math.round(raw * 10) / 10, up: raw >= 0 }
}

function downloadCsv(filename: string, rows: string[][]) {
  const esc = (cell: string) => `"${String(cell).replace(/"/g, '""')}"`
  const body = rows.map((r) => r.map(esc).join(',')).join('\n')
  const blob = new Blob([body], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function AnalyticsPage() {
  const { agent } = useAuth()
  const [rangeDays, setRangeDays] = useState<RangeDays>(30)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [leads, setLeads] = useState<LeadRow[]>([])
  const [calls, setCalls] = useState<CallRow[]>([])
  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [agents, setAgents] = useState<AgentRow[]>([])

  const endCurr = endOfDay(new Date())
  const startCurr = startOfDay(subDays(endCurr, rangeDays - 1))
  const endPrev = endOfDay(subDays(startCurr, 1))
  const startPrev = startOfDay(subDays(endPrev, rangeDays - 1))

  const load = useCallback(async () => {
    if (!agent) return
    setLoading(true)
    setError(null)
    const end = endOfDay(new Date())
    const startC = startOfDay(subDays(end, rangeDays - 1))
    const endP = endOfDay(subDays(startC, 1))
    const startP = startOfDay(subDays(endP, rangeDays - 1))
    const fetchFrom = subDays(startP, 60).toISOString()
    try {
      const [leadsRes, callsRes, bookingsRes, agentsRes] = await Promise.all([
        supabase
          .from('leads')
          .select('id,name,phone,email,source,status,agent_id,created_at,lead_score')
          .gte('created_at', fetchFrom),
        supabase
          .from('calls')
          .select('id,lead_id,agent_id,created_at,started_at')
          .gte('created_at', fetchFrom),
        supabase
          .from('bookings')
          .select('id,lead_id,agent_id,scheduled_date,created_at')
          .gte('created_at', fetchFrom),
        supabase.from('agents_directory').select('id,full_name').order('full_name').limit(200),
      ])
      if (leadsRes.error) throw leadsRes.error
      if (callsRes.error) throw callsRes.error
      if (bookingsRes.error) throw bookingsRes.error
      setLeads((leadsRes.data as LeadRow[]) || [])
      setCalls((callsRes.data as CallRow[]) || [])
      setBookings((bookingsRes.data as BookingRow[]) || [])
      if (!agentsRes.error && agentsRes.data) setAgents(agentsRes.data as AgentRow[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }, [agent, rangeDays])

  useEffect(() => {
    load()
  }, [load])

  const agentScopedLeads = useMemo(
    () => leads.filter((l) => !l.agent_id || l.agent_id === agent?.id),
    [leads, agent?.id]
  )
  const agentScopedCalls = useMemo(
    () => calls.filter((c) => !c.agent_id || c.agent_id === agent?.id),
    [calls, agent?.id]
  )
  const agentScopedBookings = useMemo(
    () => bookings.filter((b) => !b.agent_id || b.agent_id === agent?.id),
    [bookings, agent?.id]
  )

  const firstCallByLead = useMemo(() => {
    const m = new Map<string, string>()
    agentScopedCalls.forEach((c) => {
      if (!c.lead_id) return
      const t = c.started_at || c.created_at
      const prev = m.get(c.lead_id)
      if (!prev || new Date(t) < new Date(prev)) m.set(c.lead_id, t)
    })
    return m
  }, [agentScopedCalls])

  const inWindow = (iso: string, start: Date, end: Date) => {
    const d = parseISO(iso)
    return d >= start && d <= end
  }

  const currMetrics = useMemo(() => {
    const start = startCurr
    const end = endCurr
    const L = agentScopedLeads.filter((l) => inWindow(l.created_at, start, end))
    const leadIds = new Set(L.map((l) => l.id))

    let speedSum = 0
    let speedN = 0
    L.forEach((l) => {
      const fc = firstCallByLead.get(l.id)
      if (fc) {
        const sec = differenceInSeconds(parseISO(fc), parseISO(l.created_at))
        if (sec >= 0 && sec < 86400 * 30) {
          speedSum += sec
          speedN += 1
        }
      }
    })
    const avgSpeedSec = speedN ? speedSum / speedN : 0

    const callsInWin = agentScopedCalls.filter((c) => inWindow(c.created_at, start, end))
    const contactedLeadIds = new Set<string>()
    callsInWin.forEach((c) => {
      if (c.lead_id) contactedLeadIds.add(c.lead_id)
    })
    const contacted = [...leadIds].filter((id) => contactedLeadIds.has(id)).length
    const contactRate = leadIds.size ? (contacted / leadIds.size) * 100 : 0

    const bookingsInWin = agentScopedBookings.filter((b) => {
      const d = parseISO(`${b.scheduled_date}T12:00:00`)
      return d >= start && d <= end
    })
    const bookedLeadIds = new Set(bookingsInWin.map((b) => b.lead_id).filter(Boolean) as string[])
    const withBooking = [...leadIds].filter((id) => bookedLeadIds.has(id)).length
    const leadToAppt = leadIds.size ? (withBooking / leadIds.size) * 100 : 0

    const closedWithBooking = [...leadIds].filter(
      (id) => bookedLeadIds.has(id) && isClosedStatus(L.find((x) => x.id === id)?.status || '')
    ).length
    const apptToClose = withBooking ? (closedWithBooking / withBooking) * 100 : 0

    return { leadCount: leadIds.size, avgSpeedSec, contactRate, leadToAppt, apptToClose }
  }, [agentScopedLeads, agentScopedCalls, agentScopedBookings, firstCallByLead, startCurr, endCurr])

  const prevMetrics = useMemo(() => {
    const start = startPrev
    const end = endPrev
    const L = agentScopedLeads.filter((l) => inWindow(l.created_at, start, end))
    const leadIds = new Set(L.map((l) => l.id))

    let speedSum = 0
    let speedN = 0
    L.forEach((l) => {
      const fc = firstCallByLead.get(l.id)
      if (fc) {
        const sec = differenceInSeconds(parseISO(fc), parseISO(l.created_at))
        if (sec >= 0 && sec < 86400 * 30) {
          speedSum += sec
          speedN += 1
        }
      }
    })
    const avgSpeedSec = speedN ? speedSum / speedN : 0

    const callsInWin = agentScopedCalls.filter((c) => inWindow(c.created_at, start, end))
    const contactedLeadIds = new Set<string>()
    callsInWin.forEach((c) => {
      if (c.lead_id) contactedLeadIds.add(c.lead_id)
    })
    const contacted = [...leadIds].filter((id) => contactedLeadIds.has(id)).length
    const contactRate = leadIds.size ? (contacted / leadIds.size) * 100 : 0

    const bookingsInWin = agentScopedBookings.filter((b) => {
      const d = parseISO(`${b.scheduled_date}T12:00:00`)
      return d >= start && d <= end
    })
    const bookedLeadIds = new Set(bookingsInWin.map((b) => b.lead_id).filter(Boolean) as string[])
    const withBooking = [...leadIds].filter((id) => bookedLeadIds.has(id)).length
    const leadToAppt = leadIds.size ? (withBooking / leadIds.size) * 100 : 0

    const closedWithBooking = [...leadIds].filter(
      (id) => bookedLeadIds.has(id) && isClosedStatus(L.find((x) => x.id === id)?.status || '')
    ).length
    const apptToClose = withBooking ? (closedWithBooking / withBooking) * 100 : 0

    return { leadCount: leadIds.size, avgSpeedSec, contactRate, leadToAppt, apptToClose }
  }, [agentScopedLeads, agentScopedCalls, agentScopedBookings, firstCallByLead, startPrev, endPrev])

  const pipelineSeries = useMemo(() => {
    const days = eachDayOfInterval({ start: startCurr, end: endCurr })
    return days.map((day) => {
      const key = format(day, 'yyyy-MM-dd')
      const leadsN = agentScopedLeads.filter((l) => format(parseISO(l.created_at), 'yyyy-MM-dd') === key).length
      const contactedN = agentScopedLeads.filter((l) => {
        const fc = firstCallByLead.get(l.id)
        return fc && format(parseISO(fc), 'yyyy-MM-dd') === key
      }).length
      const apptsN = agentScopedBookings.filter((b) => b.scheduled_date === key).length
      return {
        date: format(day, 'MMM d'),
        leads: leadsN,
        contacted: contactedN,
        appointments: apptsN,
      }
    })
  }, [agentScopedLeads, agentScopedBookings, firstCallByLead, startCurr, endCurr])

  const sourceBarData = useMemo(() => {
    const L = agentScopedLeads.filter((l) => inWindow(l.created_at, startCurr, endCurr))
    const counts: Record<string, number> = {}
    SOURCE_KEYS.forEach((k) => {
      counts[k] = 0
    })
    L.forEach((l) => {
      const b = sourceBucket(l.source)
      counts[b] = (counts[b] || 0) + 1
    })
    return SOURCE_KEYS.map((name) => ({ name, count: counts[name] || 0 }))
  }, [agentScopedLeads, startCurr, endCurr])

  const leaderboard = useMemo(() => {
    const byAgent = new Map<
      string,
      { calls: number; appts: number; hot: number; name: string }
    >()
    const ensure = (id: string, name: string) => {
      if (!byAgent.has(id)) byAgent.set(id, { calls: 0, appts: 0, hot: 0, name })
      const row = byAgent.get(id)!
      row.name = name
    }
    agents.forEach((a) => ensure(a.id, a.full_name || 'Agent'))

    agentScopedCalls
      .filter((c) => inWindow(c.created_at, startCurr, endCurr))
      .forEach((c) => {
        const id = c.agent_id || agent?.id || ''
        if (!id) return
        ensure(id, agents.find((x) => x.id === id)?.full_name || 'Agent')
        byAgent.get(id)!.calls += 1
      })

    agentScopedBookings
      .filter((b) => {
        const d = parseISO(`${b.scheduled_date}T12:00:00`)
        return d >= startCurr && d <= endCurr
      })
      .forEach((b) => {
        const id = b.agent_id || agent?.id || ''
        if (!id) return
        ensure(id, agents.find((x) => x.id === id)?.full_name || 'Agent')
        byAgent.get(id)!.appts += 1
      })

    agentScopedLeads
      .filter((l) => inWindow(l.created_at, startCurr, endCurr) && (l.lead_score ?? 0) >= 80)
      .forEach((l) => {
        const id = l.agent_id || agent?.id || ''
        if (!id) return
        ensure(id, agents.find((x) => x.id === id)?.full_name || 'Agent')
        byAgent.get(id)!.hot += 1
      })

    const rows = [...byAgent.entries()].map(([id, v]) => ({
      id,
      name: v.name,
      calls: v.calls,
      appts: v.appts,
      hot: v.hot,
      conversion: v.calls > 0 ? Math.round((v.appts / v.calls) * 1000) / 10 : 0,
    }))
    rows.sort((a, b) => b.conversion - a.conversion)
    const nonzero = rows.filter((r) => r.calls > 0 || r.appts > 0 || r.hot > 0)
    return (nonzero.length ? nonzero : rows).slice(0, 10)
  }, [agents, agentScopedCalls, agentScopedBookings, agentScopedLeads, startCurr, endCurr, agent?.id])

  const exportCsv = () => {
    const L = agentScopedLeads.filter((l) => inWindow(l.created_at, startCurr, endCurr))
    const agentName = (id: string | null) => agents.find((a) => a.id === id)?.full_name || ''
    const header = [
      'Lead Name',
      'Phone',
      'Source',
      'Score',
      'Status',
      'Agent',
      'Created At',
      'First Call At',
      'Appointment At',
    ]
    const rows: string[][] = [header]
    L.forEach((l) => {
      const fc = firstCallByLead.get(l.id) || ''
      const appt = agentScopedBookings
        .filter((b) => b.lead_id === l.id)
        .sort((a, b) => (a.scheduled_date > b.scheduled_date ? 1 : -1))[0]
      rows.push([
        l.name || '',
        l.phone,
        sourceBucket(l.source),
        l.lead_score != null ? String(l.lead_score) : '',
        l.status,
        agentName(l.agent_id),
        l.created_at,
        fc,
        appt ? appt.scheduled_date : '',
      ])
    })
    downloadCsv(`gnanova-leads-${format(new Date(), 'yyyy-MM-dd')}.csv`, rows)
  }

  const kpiCards = useMemo(() => {
    const fmtSpeed = (sec: number) => {
      if (!sec) return '—'
      if (sec < 120) return `${Math.round(sec)}s`
      return `${Math.round(sec / 60)}m`
    }
    const c1 = pctChange(currMetrics.avgSpeedSec, prevMetrics.avgSpeedSec)
    const c2 = pctChange(currMetrics.contactRate, prevMetrics.contactRate)
    const c3 = pctChange(currMetrics.leadToAppt, prevMetrics.leadToAppt)
    const c4 = pctChange(currMetrics.apptToClose, prevMetrics.apptToClose)
    return [
      {
        title: 'Avg speed-to-lead',
        value: fmtSpeed(currMetrics.avgSpeedSec),
        sub: 'Lead created → first call',
        change: c1,
        invert: true,
      },
      {
        title: 'Lead contact rate',
        value: `${Math.round(currMetrics.contactRate * 10) / 10}%`,
        sub: 'Leads created in range with a call in the same range',
        change: c2,
        invert: false,
      },
      {
        title: 'Lead → appointment',
        value: `${Math.round(currMetrics.leadToAppt * 10) / 10}%`,
        sub: 'Leads with a booking',
        change: c3,
        invert: false,
      },
      {
        title: 'Appointment → close',
        value: `${Math.round(currMetrics.apptToClose * 10) / 10}%`,
        sub: 'Closed / booked (in range)',
        change: c4,
        invert: false,
      },
    ]
  }, [currMetrics, prevMetrics])

  if (!agent) {
    return <div className="flex items-center justify-center h-64 text-slate-600">Sign in to view analytics.</div>
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-600">
        <div className="h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        Loading analytics…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
          <p className="text-slate-600 mt-1">Pipeline, sources, and agent performance</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            {([30, 60, 90] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setRangeDays(d)}
                className={`px-3 py-2 text-sm font-medium border-l border-slate-200 first:border-l-0 ${
                  rangeDays === d ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                Last {d} days
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800 text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpiCards.map((k) => {
          const good = k.invert ? !k.change.up : k.change.up
          const Icon = k.change.up ? TrendingUp : TrendingDown
          return (
            <div key={k.title} className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-sm font-medium text-slate-500">{k.title}</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{k.value}</p>
              <p className="text-xs text-slate-500 mt-1">{k.sub}</p>
              <div
                className={`mt-3 inline-flex items-center gap-1 text-sm font-medium ${
                  good ? 'text-emerald-600' : 'text-red-600'
                }`}
              >
                <Icon className="w-4 h-4" />
                {k.change.pct === 0 ? '0%' : `${k.change.pct > 0 ? '+' : ''}${k.change.pct}%`} vs prior period
              </div>
            </div>
          )
        })}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Lead pipeline over time</h2>
        <div className="h-80 w-full min-h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={pipelineSeries} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#64748b" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#64748b" />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="leads" name="Leads received" stroke="#2563eb" strokeWidth={2} dot={false} />
              <Line
                type="monotone"
                dataKey="contacted"
                name="Leads contacted"
                stroke="#7c3aed"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="appointments"
                name="Appointments booked"
                stroke="#059669"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Performance by lead source</h2>
        <div className="h-72 w-full min-h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sourceBarData} margin={{ top: 8, right: 16, left: 0, bottom: 32 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#64748b" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#64748b" />
              <Tooltip />
              <Bar dataKey="count" name="Leads" radius={[6, 6, 0, 0]}>
                {sourceBarData.map((_, i) => (
                  <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Agent leaderboard</h2>
          <p className="text-sm text-slate-500">Top 10 by appointment conversion (appointments / calls)</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="bg-slate-50 text-left text-xs font-medium text-slate-600 uppercase">
              <tr>
                <th className="px-4 py-3">Agent</th>
                <th className="px-4 py-3">Calls made</th>
                <th className="px-4 py-3">Appointments</th>
                <th className="px-4 py-3">Hot leads</th>
                <th className="px-4 py-3">Conversion %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {leaderboard.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                    No agent activity in this range.
                  </td>
                </tr>
              ) : (
                leaderboard.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{r.name}</td>
                    <td className="px-4 py-3 text-slate-700">{r.calls}</td>
                    <td className="px-4 py-3 text-slate-700">{r.appts}</td>
                    <td className="px-4 py-3 text-slate-700">{r.hot}</td>
                    <td className="px-4 py-3 text-slate-900 font-semibold">{r.conversion}%</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

import React, { useCallback, useEffect, useState } from 'react'
import {
  AlertCircle, Building2, CheckCircle2, Clock,
  DollarSign, Loader2, RefreshCw, TrendingUp, Users,
  Star, Phone, MessageCircle, Activity, Send,
} from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  fetchDailyLeads, fetchHotLeads, fetchKpis, fetchLeadSourceData,
  fetchMonthlyRevenue, fetchOverduePayments, fetchSuiteStats,
  type DateRange,
} from '../../lib/owner-dashboard'
import { supabase } from '../../lib/supabase'
import { whatsappLink } from '../../lib/payment-tracker'

const PIE_COLORS = ['#3b82f6', '#a855f7', '#10b981', '#f59e0b', '#ef4444', '#64748b']

function fmt(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function KpiCard({
  icon: Icon, label, value, sub, color,
}: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color: string
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
        <p className="text-xl font-bold text-slate-900">{value}</p>
        {sub && <p className="text-xs text-slate-400">{sub}</p>}
      </div>
    </div>
  )
}

export default function OwnerDashboard() {
  const [range, setRange] = useState<DateRange>('today')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [kpis, setKpis] = useState({ totalLeads: 0, siteVisits: 0, paymentsCollected: 0, outstanding: 0 })
  const [suiteStats, setSuiteStats] = useState<{ counts: Record<string, number>; total: number }>({ counts: {}, total: 0 })
  const [leadSources, setLeadSources] = useState<{ name: string; value: number }[]>([])
  const [dailyLeads, setDailyLeads] = useState<{ date: string; count: number }[]>([])
  const [monthlyRevenue, setMonthlyRevenue] = useState<{ month: string; revenue: number; target: number }[]>([])
  const [hotLeads, setHotLeads] = useState<any[]>([])
  const [overduePayments, setOverduePayments] = useState<any[]>([])
  const [membershipStats, setMembershipStats] = useState({ active: 0, silver: 0, gold: 0, platinum: 0, revenue: 0 })
  const [activityFeed, setActivityFeed] = useState<{ id: string; text: string; time: string; type: string }[]>([])
  const [todaySummary, setTodaySummary] = useState({ leads: 0, payments: 0, bookings: 0, followups: 0 })
  const [sendingReport, setSendingReport] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const days = range === 'today' ? 1 : range === 'week' ? 7 : 30
      const [k, ss, ls, dl, mr, hl, op] = await Promise.all([
        fetchKpis(range),
        fetchSuiteStats(),
        fetchLeadSourceData(range),
        fetchDailyLeads(days),
        fetchMonthlyRevenue(),
        fetchHotLeads(),
        fetchOverduePayments(),
      ])
      setKpis(k)
      setSuiteStats(ss)
      setLeadSources(ls)
      setDailyLeads(dl)
      setMonthlyRevenue(mr)
      setHotLeads(hl)
      setOverduePayments(op)

      // Membership stats
      const { data: members } = await supabase.from('memberships').select('membership_tier, amount_paid, status')
      if (members) {
        const active = members.filter(m => m.status === 'Active')
        setMembershipStats({
          active: active.length,
          silver: active.filter(m => m.membership_tier === 'Silver').length,
          gold: active.filter(m => m.membership_tier === 'Gold').length,
          platinum: active.filter(m => m.membership_tier === 'Platinum').length,
          revenue: members.reduce((s, m) => s + (m.amount_paid || 0), 0),
        })
      }

      // Today's summary
      const todayStr = new Date().toISOString().slice(0, 10)
      const [{ count: leadsToday }, { count: paymentsToday }, { count: bookingsToday }] = await Promise.all([
        supabase.from('leads').select('id', { count: 'exact', head: true }).gte('created_at', todayStr),
        supabase.from('payments').select('id', { count: 'exact', head: true }).gte('paid_date', todayStr).eq('status', 'Paid'),
        supabase.from('suites').select('id', { count: 'exact', head: true }).eq('status', 'Booked').gte('updated_at', todayStr),
      ])
      setTodaySummary({ leads: leadsToday || 0, payments: paymentsToday || 0, bookings: bookingsToday || 0, followups: hl.length })

      // Activity feed — last 10 events across leads + payments
      const [{ data: recentLeads }, { data: recentPmts }] = await Promise.all([
        supabase.from('leads').select('id, name, source, created_at').order('created_at', { ascending: false }).limit(5),
        supabase.from('payments').select('id, customer_name, installment_amount, paid_date, created_at').order('created_at', { ascending: false }).limit(5),
      ])
      const feed = [
        ...(recentLeads || []).map(l => ({ id: l.id, text: `New lead — ${l.name} via ${l.source || 'Unknown'}`, time: l.created_at, type: 'lead' })),
        ...(recentPmts || []).map(p => ({ id: p.id, text: `Payment received — ${p.customer_name} ₹${Number(p.installment_amount).toLocaleString()}`, time: p.created_at, type: 'payment' })),
      ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 10)
      setActivityFeed(feed)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }, [range])

  useEffect(() => { void load() }, [load])

  // Real-time subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('owner-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => void load())
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [load])

  const suiteTotal = suiteStats.total || 1
  const available = suiteStats.counts['Available'] ?? 0
  const booked = suiteStats.counts['Booked'] ?? 0
  const sold = suiteStats.counts['Sold'] ?? 0
  const blocked = suiteStats.counts['Blocked'] ?? 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-6 h-6" /> Owner Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Business overview — real-time</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 overflow-hidden text-sm font-medium">
            {(['today', 'week', 'month'] as DateRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-4 py-2 capitalize transition-colors ${range === r ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                {r === 'today' ? 'Today' : r === 'week' ? 'This Week' : 'This Month'}
              </button>
            ))}
          </div>
          <button
            onClick={() => void load()}
            className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            disabled={sendingReport}
            onClick={() => {
              setSendingReport(true)
              const available = suiteStats.counts['Available'] ?? 0
              const msg = `📊 *VSR Daily Report — ${new Date().toLocaleDateString('en-IN')}*\n\n` +
                `*Leads Today:* ${todaySummary.leads}\n` +
                `*Payments Today:* ${todaySummary.payments}\n` +
                `*Suites Available:* ${available} of ${suiteStats.total}\n` +
                `*Active Members:* ${membershipStats.active} (S:${membershipStats.silver} G:${membershipStats.gold} P:${membershipStats.platinum})\n` +
                `*Collected (period):* ₹${kpis.paymentsCollected.toLocaleString()}\n` +
                `*Outstanding:* ₹${kpis.outstanding.toLocaleString()}\n` +
                `*Overdue payments:* ${overduePayments.length}\n\n` +
                `_Sent from VSR CRM_`
              window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
              setTimeout(() => setSendingReport(false), 1500)
            }}
            className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {sendingReport ? 'Opening…' : 'WA Report'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-800 px-4 py-3 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…
        </div>
      ) : (
        <>
          {/* Row 1 — KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <KpiCard icon={Users} label="Total Leads" value={kpis.totalLeads} color="bg-blue-100 text-blue-600" />
            <KpiCard icon={Clock} label="Site Visits" value={kpis.siteVisits} color="bg-purple-100 text-purple-600" />
            <KpiCard icon={CheckCircle2} label="Collected" value={fmt(kpis.paymentsCollected)} color="bg-emerald-100 text-emerald-600" />
            <KpiCard icon={AlertCircle} label="Outstanding" value={fmt(kpis.outstanding)} color="bg-amber-100 text-amber-600" />
            <KpiCard icon={Building2} label="Suites Available" value={available} sub={`of ${suiteStats.total} total`} color="bg-slate-100 text-slate-600" />
          </div>

          {/* Row 2 — Suite Status */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Suite Inventory Status</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              {[
                { label: 'Available', count: available, color: 'text-emerald-600 bg-emerald-50' },
                { label: 'Booked', count: booked, color: 'text-blue-600 bg-blue-50' },
                { label: 'Sold', count: sold, color: 'text-purple-600 bg-purple-50' },
                { label: 'Blocked', count: blocked, color: 'text-red-600 bg-red-50' },
              ].map((s) => (
                <div key={s.label} className={`rounded-lg p-3 text-center ${s.color}`}>
                  <div className="text-2xl font-bold">{s.count}</div>
                  <div className="text-xs font-medium mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
            <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
              {[
                { pct: (available / suiteTotal) * 100, color: 'bg-emerald-500' },
                { pct: (booked / suiteTotal) * 100, color: 'bg-blue-500' },
                { pct: (sold / suiteTotal) * 100, color: 'bg-purple-500' },
                { pct: (blocked / suiteTotal) * 100, color: 'bg-red-400' },
              ].map((s, i) =>
                s.pct > 0 ? (
                  <div key={i} className={`${s.color} transition-all`} style={{ width: `${s.pct}%` }} />
                ) : null
              )}
            </div>
            <div className="flex gap-4 mt-2 text-xs text-slate-500">
              {[
                { label: 'Available', color: 'bg-emerald-500' },
                { label: 'Booked', color: 'bg-blue-500' },
                { label: 'Sold', color: 'bg-purple-500' },
                { label: 'Blocked', color: 'bg-red-400' },
              ].map((s) => (
                <span key={s.label} className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${s.color}`} /> {s.label}
                </span>
              ))}
            </div>
          </div>

          {/* Row 3 — Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Lead Source Pie */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-2">Lead Sources</h2>
              {leadSources.length === 0 ? (
                <p className="text-sm text-slate-400 py-8 text-center">No data</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={leadSources} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {leadSources.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Daily Leads Line */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-2">Daily Leads</h2>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={dailyLeads}>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Revenue vs Target Bar */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-2">Revenue vs Target</h2>
              {monthlyRevenue.length === 0 ? (
                <p className="text-sm text-slate-400 py-8 text-center">No payment data yet</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={monthlyRevenue} barSize={14}>
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="revenue" name="Collected" fill="#10b981" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="target" name="Target" fill="#e2e8f0" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Row 3.5 — Membership Stats + Today Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Membership KPIs */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-500" /> Club Memberships
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-slate-900">{membershipStats.active}</p>
                  <p className="text-xs text-slate-500">Active</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-700">₹{membershipStats.revenue.toLocaleString()}</p>
                  <p className="text-xs text-green-600">Revenue</p>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                {[
                  { label: 'Silver', count: membershipStats.silver, cls: 'bg-slate-100 text-slate-700' },
                  { label: 'Gold', count: membershipStats.gold, cls: 'bg-yellow-100 text-yellow-800' },
                  { label: 'Platinum', count: membershipStats.platinum, cls: 'bg-purple-100 text-purple-800' },
                ].map(t => (
                  <div key={t.label} className={`flex-1 rounded-lg p-2 text-center text-xs font-semibold ${t.cls}`}>
                    <p className="text-lg font-bold">{t.count}</p>{t.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Today's Summary */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-500" /> Today's Summary
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Leads Today', value: todaySummary.leads, icon: Users, cls: 'text-blue-600 bg-blue-50' },
                  { label: 'Payments Today', value: todaySummary.payments, icon: CheckCircle2, cls: 'text-green-600 bg-green-50' },
                  { label: 'New Bookings', value: todaySummary.bookings, icon: Building2, cls: 'text-purple-600 bg-purple-50' },
                  { label: 'Hot Leads', value: todaySummary.followups, icon: Phone, cls: 'text-red-600 bg-red-50' },
                ].map(({ label, value, icon: Icon, cls }) => (
                  <div key={label} className={`rounded-lg p-3 flex items-center gap-3 ${cls.split(' ')[1]}`}>
                    <Icon className={`w-5 h-5 ${cls.split(' ')[0]}`} />
                    <div>
                      <p className={`text-xl font-bold ${cls.split(' ')[0]}`}>{value}</p>
                      <p className="text-xs text-slate-500">{label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Row 4 — Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Hot Leads */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100">
                <h2 className="font-semibold text-slate-900">Today's Hot Leads</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">Name</th>
                      <th className="text-left px-4 py-2 font-medium">Source</th>
                      <th className="text-center px-4 py-2 font-medium">Score</th>
                      <th className="text-left px-4 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hotLeads.map((l: any) => (
                      <tr key={l.id} className="border-t border-slate-100">
                        <td className="px-4 py-2 font-medium text-slate-900">{l.name || '—'}</td>
                        <td className="px-4 py-2 text-slate-500">{l.source || '—'}</td>
                        <td className="px-4 py-2 text-center">
                          {l.ai_score != null ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${l.ai_score >= 70 ? 'bg-emerald-100 text-emerald-800' : l.ai_score >= 40 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
                              {l.ai_score}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-2 text-slate-600 capitalize">{l.lead_status || '—'}</td>
                      </tr>
                    ))}
                    {hotLeads.length === 0 && (
                      <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">No leads today</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Overdue Payments */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100">
                <h2 className="font-semibold text-slate-900">Overdue Payments ({overduePayments.length})</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">Customer</th>
                      <th className="text-left px-4 py-2 font-medium">Suite</th>
                      <th className="text-right px-4 py-2 font-medium">Amount</th>
                      <th className="text-left px-4 py-2 font-medium">Due</th>
                      <th className="text-center px-4 py-2 font-medium">WA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overduePayments.map((p: any) => (
                      <tr key={p.id} className="border-t border-slate-100 bg-red-50/40">
                        <td className="px-4 py-2 font-medium text-slate-900">{p.customer_name}</td>
                        <td className="px-4 py-2 text-slate-500">{p.suite_number || '—'}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-red-700 font-medium">
                          {fmt(p.installment_amount)}
                        </td>
                        <td className="px-4 py-2 text-slate-600">{p.due_date}</td>
                        <td className="px-4 py-2 text-center">
                          {p.customer_phone ? (
                            <a
                              href={whatsappLink(p.customer_phone, `Hi ${p.customer_name}, your installment #${p.installment_number} of ${fmt(p.installment_amount)} was due on ${p.due_date}. Please arrange payment.`)}
                              target="_blank" rel="noreferrer"
                              className="text-emerald-600 hover:text-emerald-800 text-xs font-medium"
                            >
                              Remind
                            </a>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                    {overduePayments.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No overdue payments 🎉</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          {/* Row 5 — Activity Feed */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-slate-500" /> Recent Activity
              </h2>
            </div>
            <div className="divide-y divide-slate-50">
              {activityFeed.length === 0 ? (
                <p className="px-5 py-8 text-sm text-slate-400 text-center">No recent activity</p>
              ) : activityFeed.map(ev => (
                <div key={ev.id + ev.time} className="flex items-center gap-3 px-5 py-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${ev.type === 'payment' ? 'bg-green-100' : 'bg-blue-100'}`}>
                    {ev.type === 'payment' ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Users className="w-4 h-4 text-blue-600" />}
                  </div>
                  <p className="text-sm text-slate-700 flex-1">{ev.text}</p>
                  <span className="text-xs text-slate-400 flex-shrink-0">
                    {new Date(ev.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase, type Call } from '../../lib/supabase'
import {
  Phone,
  Filter,
  X,
  CalendarRange,
  ChevronRight,
  Headphones,
  Clock,
  Percent,
  Activity,
  ChevronLeft,
  Flame,
} from 'lucide-react'
import {
  format,
  formatDistanceToNow,
  startOfWeek,
  endOfWeek,
  isWithinInterval,
  startOfDay,
  isToday,
  startOfMonth,
  endOfMonth,
} from 'date-fns'

type CallOutcome = 'qualified' | 'not_reached' | 'voicemail' | 'callback' | 'unknown'

type LeadsEmbed = {
  id: string
  name: string | null
  phone: string | null
  email: string | null
  location: string | null
  call_transcript: string | null
  lead_score: number | null
  source: string | null
  budget_mentioned: string | null
} | null

type CallLogRow = Call & {
  leads?: LeadsEmbed
}

type AgentOption = { id: string; full_name: string | null }

const SOURCE_PRESETS = [
  { value: 'all', label: 'All sources' },
  { value: 'zillow', label: 'Zillow' },
  { value: 'realtor', label: 'Realtor.com' },
  { value: 'web', label: 'Web' },
  { value: 'open_house', label: 'Open House' },
  { value: 'manual', label: 'Manual' },
  { value: 'referral', label: 'Referral' },
] as const

function callDurationSeconds(c: Call): number {
  const d = c.duration_seconds ?? c.call_duration ?? c.duration
  return typeof d === 'number' && !Number.isNaN(d) ? d : 0
}

function callTimestamp(c: CallLogRow): string {
  return (c.started_at || c.created_at) as string
}

/** Effective outcome for filters + stats when call_outcome is not set */
function getEffectiveCallOutcome(c: Call): CallOutcome {
  if (c.call_outcome) {
    const o = c.call_outcome as CallOutcome
    if (['qualified', 'not_reached', 'voicemail', 'callback'].includes(o)) return o
  }
  const ended = (c.outcome || '').toLowerCase()
  if (ended.includes('voicemail') || ended.includes('machine')) return 'voicemail'
  if (ended.includes('no-answer') || ended.includes('no_answer') || ended.includes('busy')) {
    return 'not_reached'
  }
  const sec = callDurationSeconds(c)
  if (sec > 0 && sec < 5 && !c.transcript) return 'not_reached'
  if (c.lead_status === 'hot' || c.lead_status === 'warm') return 'qualified'
  if (c.lead_status === 'cold') return 'callback'
  if (c.transcript && sec >= 5) return 'qualified'
  return 'unknown'
}

function normalizeSourceKey(raw: string | null | undefined): string {
  if (!raw) return 'manual'
  const s = raw.toLowerCase().replace(/[\s.-]/g, '_')
  if (s.includes('zillow')) return 'zillow'
  if (s.includes('realtor')) return 'realtor'
  if (s.includes('open') && s.includes('house')) return 'open_house'
  if (s === 'web' || s === 'website' || s === 'portal' || s.includes('vapi')) return 'web'
  if (s.includes('referral')) return 'referral'
  if (s.includes('manual') || s === 'import' || s === 'csv') return 'manual'
  return s || 'manual'
}

function formatSourceLabel(raw: string | null | undefined): string {
  const key = normalizeSourceKey(raw)
  const map: Record<string, string> = {
    zillow: 'Zillow',
    realtor: 'Realtor.com',
    web: 'Web',
    open_house: 'Open House',
    manual: 'Manual',
    referral: 'Referral',
    vapi_call: 'Web',
    website: 'Web',
    facebook: 'Web',
    inbound: 'Web',
  }
  return map[key] || (raw ? raw.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) : 'Manual')
}

function outcomeBadgeClass(outcome: CallOutcome): string {
  switch (outcome) {
    case 'qualified':
      return 'bg-emerald-100 text-emerald-800'
    case 'voicemail':
      return 'bg-amber-100 text-amber-800'
    case 'not_reached':
      return 'bg-red-100 text-red-800'
    case 'callback':
      return 'bg-blue-100 text-blue-800'
    default:
      return 'bg-slate-100 text-slate-600'
  }
}

function outcomeLabel(outcome: CallOutcome): string {
  const labels: Record<CallOutcome, string> = {
    qualified: 'Qualified',
    not_reached: 'Not Reached',
    voicemail: 'Voicemail',
    callback: 'Callback Requested',
    unknown: 'Unknown',
  }
  return labels[outcome]
}

function formatDuration(sec: number): string {
  if (sec <= 0) return '—'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function areaPreferenceText(c: Call): string {
  const lp = c.location_preference
  if (Array.isArray(lp) && lp.length) return lp.join(', ')
  if (typeof lp === 'string') return lp
  return 'Not specified'
}

const PAGE_SIZE = 20

export default function CallsPage() {
  const { agent } = useAuth()
  const [rows, setRows] = useState<CallLogRow[]>([])
  const [agents, setAgents] = useState<AgentOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<CallLogRow | null>(null)
  const [markingHot, setMarkingHot] = useState(false)
  const [hotError, setHotError] = useState<string | null>(null)

  const [datePreset, setDatePreset] = useState<'today' | 'week' | 'month' | 'custom'>('custom')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [outcomeFilter, setOutcomeFilter] = useState<string>('all')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [agentFilter, setAgentFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const applyDatePreset = (preset: typeof datePreset) => {
    setDatePreset(preset)
    const now = new Date()
    if (preset === 'today') {
      const d = format(now, 'yyyy-MM-dd')
      setDateFrom(d)
      setDateTo(d)
    } else if (preset === 'week') {
      setDateFrom(format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'))
      setDateTo(format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'))
    } else if (preset === 'month') {
      setDateFrom(format(startOfMonth(now), 'yyyy-MM-dd'))
      setDateTo(format(endOfMonth(now), 'yyyy-MM-dd'))
    }
  }

  const load = useCallback(async () => {
    if (!agent) return
    setLoading(true)
    setError(null)
    try {
      const [callsRes, agentsRes] = await Promise.all([
        supabase
          .from('calls')
          .select(
            `
            *,
            leads ( id, name, phone, email, location, call_transcript, lead_score, source, budget_mentioned )
          `
          )
          .eq('agent_id', agent.id)
          .order('created_at', { ascending: false }),
        supabase.from('agents').select('id, full_name').order('full_name'),
      ])

      if (callsRes.error) throw callsRes.error
      if (!agentsRes.error && agentsRes.data) {
        setAgents(agentsRes.data as AgentOption[])
      } else {
        setAgents([{ id: agent.id, full_name: agent.full_name }])
      }
      setRows((callsRes.data as CallLogRow[]) || [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load calls')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [agent])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!agent?.id) return
    const channel = supabase
      .channel('calls-log-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'calls', filter: `agent_id=eq.${agent.id}` },
        () => {
          load()
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [agent?.id, load])

  const agentNameById = useMemo(() => {
    const m = new Map<string, string>()
    agents.forEach((a) => m.set(a.id, a.full_name || 'Agent'))
    if (agent) m.set(agent.id, agent.full_name || 'Me')
    return m
  }, [agents, agent])

  const filteredCalls = useMemo(() => {
    return rows.filter((c) => {
      if (agentFilter !== 'all' && c.agent_id !== agentFilter) return false

      const eff = getEffectiveCallOutcome(c)
      if (outcomeFilter !== 'all' && eff !== outcomeFilter) return false

      const srcKey = normalizeSourceKey(c.leads?.source || c.lead_source || c.source)
      if (sourceFilter !== 'all' && srcKey !== sourceFilter) return false

      const t = new Date(callTimestamp(c))
      if (dateFrom) {
        const from = startOfDay(new Date(dateFrom + 'T00:00:00'))
        if (t < from) return false
      }
      if (dateTo) {
        const to = startOfDay(new Date(dateTo + 'T23:59:59'))
        if (t > to) return false
      }

      const q = search.trim().toLowerCase()
      if (q) {
        const name = (c.leads?.name || c.lead_name || '').toLowerCase()
        const phone = (c.leads?.phone || c.lead_phone || '').toLowerCase()
        if (!name.includes(q) && !phone.includes(q)) return false
      }
      return true
    })
  }, [rows, agentFilter, outcomeFilter, sourceFilter, dateFrom, dateTo, search])

  useEffect(() => {
    setPage(1)
  }, [filteredCalls.length, agentFilter, outcomeFilter, sourceFilter, dateFrom, dateTo, search])

  const weekInterval = useMemo(() => {
    const now = new Date()
    return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) }
  }, [])

  const stats = useMemo(() => {
    const weekCalls = rows.filter((c) =>
      isWithinInterval(new Date(callTimestamp(c)), { start: weekInterval.start, end: weekInterval.end })
    )
    const todayForResponse = rows.filter((c) => isToday(new Date(callTimestamp(c))))
    const withResponse = todayForResponse.filter(
      (c) => typeof c.response_time_seconds === 'number' && c.response_time_seconds >= 0
    )
    const avgResponse =
      withResponse.length > 0
        ? Math.round(
            withResponse.reduce((sum, c) => sum + (c.response_time_seconds as number), 0) / withResponse.length
          )
        : null

    const denom = weekCalls.length || 0
    let voicemail = 0
    let answered = 0
    weekCalls.forEach((c) => {
      const o = getEffectiveCallOutcome(c)
      if (o === 'voicemail') voicemail++
      if (o !== 'not_reached') answered++
    })

    const contactRate = denom ? Math.round((answered / denom) * 1000) / 10 : 0
    const voicemailRate = denom ? Math.round((voicemail / denom) * 1000) / 10 : 0

    return {
      totalWeek: denom,
      avgResponseSeconds: avgResponse,
      contactRate,
      voicemailRate,
    }
  }, [rows, weekInterval])

  const paginatedCalls = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filteredCalls.slice(start, start + PAGE_SIZE)
  }, [filteredCalls, page])

  const totalPages = Math.max(1, Math.ceil(filteredCalls.length / PAGE_SIZE))

  const clearFilters = () => {
    setDatePreset('custom')
    setDateFrom('')
    setDateTo('')
    setOutcomeFilter('all')
    setSourceFilter('all')
    setAgentFilter('all')
    setSearch('')
  }

  const leadIdForRow = (c: CallLogRow) => c.leads?.id || c.lead_id || null

  const fullTranscript = (c: CallLogRow) =>
    (c.leads?.call_transcript && c.leads.call_transcript.trim()) || (c.transcript && c.transcript.trim()) || ''

  const markHotLead = async () => {
    if (!selected) return
    const lid = leadIdForRow(selected)
    if (!lid) {
      setHotError('No linked lead record — cannot update score.')
      return
    }
    setMarkingHot(true)
    setHotError(null)
    try {
      const { error: uErr } = await supabase
        .from('leads')
        .update({
          lead_score: 85,
          score_label: 'Hot',
          updated_at: new Date().toISOString(),
        })
        .eq('id', lid)
      if (uErr) throw uErr
      setRows((prev) =>
        prev.map((r) =>
          r.id === selected.id
            ? {
                ...r,
                leads: r.leads ? { ...r.leads, lead_score: 85 } : r.leads,
              }
            : r
        )
      )
      setSelected((s) =>
        s && s.id === selected.id && s.leads ? { ...s, leads: { ...s.leads, lead_score: 85 } } : s
      )
    } catch (e) {
      setHotError(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setMarkingHot(false)
    }
  }

  if (!agent) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-600">Sign in to view calls.</div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-600">
        <div className="h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p>Loading call log…</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Calls</h1>
        <p className="text-slate-600 mt-1">Call history, recordings, transcripts, and qualification</p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800 text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
            <Clock className="w-4 h-4" />
            Avg response time (today)
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {stats.avgResponseSeconds !== null ? `${stats.avgResponseSeconds}s` : '—'}
          </p>
          <p className="text-xs text-slate-500 mt-1">From response_time_seconds on today&apos;s calls</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
            <Phone className="w-4 h-4" />
            Total calls this week
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{stats.totalWeek}</p>
          <p className="text-xs text-slate-500 mt-1">Mon–Sun (local)</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
            <Percent className="w-4 h-4" />
            Contact rate (week)
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {stats.totalWeek ? `${stats.contactRate}%` : '—'}
          </p>
          <p className="text-xs text-slate-500 mt-1">Share of calls that were not &quot;not reached&quot;</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
            <Activity className="w-4 h-4" />
            Voicemail rate (week)
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {stats.totalWeek ? `${stats.voicemailRate}%` : '—'}
          </p>
          <p className="text-xs text-slate-500 mt-1">Voicemail outcomes / total week calls</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-slate-700">
          <Filter className="w-5 h-5 text-slate-400" />
          <span className="font-medium">Filters</span>
          <div className="flex flex-wrap gap-2 ml-2">
            {(
              [
                ['today', 'Today'],
                ['week', 'This week'],
                ['month', 'This month'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => applyDatePreset(key)}
                className={`px-3 py-1 rounded-lg text-sm font-medium border ${
                  datePreset === key ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setDatePreset('custom')}
              className={`px-3 py-1 rounded-lg text-sm font-medium border ${
                datePreset === 'custom' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white border-slate-200 text-slate-700'
              }`}
            >
              Custom
            </button>
          </div>
          <button
            type="button"
            onClick={clearFilters}
            className="ml-auto text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Clear all
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Date from</label>
            <div className="relative">
              <CalendarRange className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value)
                  setDatePreset('custom')
                }}
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Date to</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value)
                setDatePreset('custom')
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Outcome</label>
            <select
              value={outcomeFilter}
              onChange={(e) => setOutcomeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="all">All outcomes</option>
              <option value="qualified">Qualified</option>
              <option value="not_reached">Not reached</option>
              <option value="voicemail">Voicemail</option>
              <option value="callback">Callback requested</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Source</label>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {SOURCE_PRESETS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Agent</label>
            <select
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="all">All agents</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.full_name || a.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-500 mb-1">Search lead</label>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name or phone"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px]">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Lead name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Phone</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Date &amp; time</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Duration</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Outcome</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Agent</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Source</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {paginatedCalls.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-14 text-center text-slate-500">
                    {rows.length === 0
                      ? 'No calls yet. Completed AI calls will appear here with transcript and recording when webhooks save them.'
                      : 'No calls match your filters.'}
                  </td>
                </tr>
              ) : (
                paginatedCalls.map((c) => {
                  const eff = getEffectiveCallOutcome(c)
                  const dur = callDurationSeconds(c)
                  const displayName = c.leads?.name || c.lead_name || 'Unknown'
                  const displayPhone = c.leads?.phone || c.lead_phone || '—'
                  const when = callTimestamp(c)
                  const agentLabel = c.agent_id ? agentNameById.get(c.agent_id) || '—' : '—'
                  const src = formatSourceLabel(c.leads?.source || c.lead_source || c.source)
                  return (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="px-4 py-4 font-medium text-slate-900">{displayName}</td>
                      <td className="px-4 py-4 text-sm text-slate-600">{displayPhone}</td>
                      <td className="px-4 py-4 text-sm text-slate-600 whitespace-nowrap">
                        {format(new Date(when), 'MMM d, yyyy')}
                        <span className="block text-xs text-slate-400">{format(new Date(when), 'h:mm a')}</span>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600">{formatDuration(dur)}</td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${outcomeBadgeClass(
                            eff
                          )}`}
                        >
                          {outcomeLabel(eff)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">{agentLabel}</td>
                      <td className="px-4 py-4 text-sm text-slate-600">{src}</td>
                      <td className="px-4 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => setSelected(c)}
                          className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800"
                        >
                          Details
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        {filteredCalls.length > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50/80">
            <p className="text-sm text-slate-600">
              Page {page} of {totalPages} · {filteredCalls.length} calls
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail drawer */}
      {selected && (
        <>
          <button
            type="button"
            className="fixed inset-0 bg-slate-900/40 z-40"
            aria-label="Close drawer"
            onClick={() => {
              setSelected(null)
              setHotError(null)
            }}
          />
          <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col border-l border-slate-200">
            <div className="p-5 border-b border-slate-200 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Call detail</h2>
                <p className="text-sm text-slate-500">
                  {format(new Date(callTimestamp(selected)), 'PPpp')} ·{' '}
                  {formatDistanceToNow(new Date(callTimestamp(selected)), { addSuffix: true })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelected(null)
                  setHotError(null)
                }}
                className="text-slate-400 hover:text-slate-600 p-1 shrink-0"
                aria-label="Close"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Lead</h3>
                <p className="font-semibold text-slate-900">{selected.leads?.name || selected.lead_name || '—'}</p>
                <p className="text-sm text-slate-600">{selected.leads?.phone || selected.lead_phone || '—'}</p>
                <p className="text-sm text-slate-600">{selected.leads?.email || selected.lead_email || '—'}</p>
                <p className="text-sm text-slate-600 mt-1">{selected.leads?.location || '—'}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full ${outcomeBadgeClass(
                    getEffectiveCallOutcome(selected)
                  )}`}
                >
                  {outcomeLabel(getEffectiveCallOutcome(selected))}
                </span>
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                  {formatSourceLabel(selected.leads?.source || selected.lead_source || selected.source)}
                </span>
              </div>

              {selected.recording_url && (
                <div>
                  <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                    <Headphones className="w-4 h-4" />
                    Recording
                  </h3>
                  <audio controls className="w-full" src={selected.recording_url} />
                </div>
              )}

              <div>
                <h3 className="font-semibold text-slate-900 mb-2">AI transcript</h3>
                <div className="bg-slate-50 p-4 rounded-lg max-h-56 overflow-y-auto text-sm text-slate-700 whitespace-pre-wrap">
                  {fullTranscript(selected) || 'No transcript stored yet.'}
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-slate-900 mb-3">Qualification</h3>
                <dl className="grid grid-cols-1 gap-3 text-sm">
                  <div>
                    <dt className="text-slate-500">Timeline</dt>
                    <dd className="font-medium text-slate-900">{selected.timeline || 'Not specified'}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Budget</dt>
                    <dd className="font-medium text-slate-900">
                      {selected.leads?.budget_mentioned && String(selected.leads.budget_mentioned).trim()
                        ? selected.leads.budget_mentioned
                        : selected.budget_min != null && selected.budget_max != null
                          ? `$${(selected.budget_min / 1000).toFixed(0)}K – $${(selected.budget_max / 1000).toFixed(0)}K`
                          : 'Not specified'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Pre-approval</dt>
                    <dd className="font-medium text-slate-900">
                      {selected.pre_approved === null || selected.pre_approved === undefined
                        ? 'Unknown'
                        : selected.pre_approved
                          ? 'Yes'
                          : 'No'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Area preference</dt>
                    <dd className="font-medium text-slate-900">{areaPreferenceText(selected)}</dd>
                  </div>
                </dl>
              </div>

              {selected.ai_summary && (
                <div>
                  <h3 className="font-semibold text-slate-900 mb-2">AI summary</h3>
                  <p className="text-slate-700 text-sm leading-relaxed">{selected.ai_summary}</p>
                </div>
              )}

              {hotError && <p className="text-sm text-red-600">{hotError}</p>}

              <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={!leadIdForRow(selected) || markingHot}
                  onClick={markHotLead}
                  className="w-full py-2.5 px-4 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium text-sm"
                >
                  <Flame className="w-4 h-4" />
                  {markingHot ? 'Updating…' : 'Mark as Hot Lead (score 85)'}
                </button>
                <button
                  type="button"
                  onClick={() => (selected.leads?.phone || selected.lead_phone) && (window.location.href = `tel:${selected.leads?.phone || selected.lead_phone}`)}
                  disabled={!(selected.leads?.phone || selected.lead_phone)}
                  className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
                >
                  <Phone className="w-4 h-4 inline mr-2" />
                  Call back
                </button>
              </div>
            </div>
          </aside>
        </>
      )}
    </div>
  )
}

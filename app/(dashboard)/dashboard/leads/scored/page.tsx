'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../../components/ui/dialog'

type TabId = 'all' | 'hot' | 'warm' | 'cold' | 'dead'

const TABS: { id: TabId; label: string; min: number; max: number }[] = [
  { id: 'all', label: 'All Scored', min: 0, max: 100 },
  { id: 'hot', label: '🔥 Hot (80-100)', min: 80, max: 100 },
  { id: 'warm', label: '⚡ Warm (50-79)', min: 50, max: 79 },
  { id: 'cold', label: '🧊 Cold (20-49)', min: 20, max: 49 },
  { id: 'dead', label: '☠️ Dead (0-19)', min: 0, max: 19 },
]

type LeadRow = {
  rank: number
  id: string
  name: string
  phone: string
  location: string | null
  lead_score: number
  score_label: string | null
  budget_mentioned: string | null
  follow_up_action: string | null
  interested_in: string | null
  called_at: string | null
  campaign: string
  transcript: string
  manual_call_done: boolean
}

type Stats = {
  total: number
  hotCount: number
  hotReadyCount: number
  avgScore: number
  connectedThisWeek: number
}

function scoreBadgeClass(score: number) {
  const n = Number.isFinite(score) ? score : 0
  if (n >= 80) return 'bg-green-100 text-green-800'
  if (n >= 50) return 'bg-yellow-100 text-yellow-900'
  if (n >= 20) return 'bg-orange-100 text-orange-900'
  return 'bg-red-100 text-red-900'
}

function sniff(text: string, re: RegExp): string | null {
  const m = text.match(re)
  return m?.[1]?.trim() || null
}

function insightsFromTranscript(transcript: string, row: LeadRow) {
  const text = transcript || ''
  const budget = row.budget_mentioned || sniff(text, /budget[:\s]+([^\n]+)/i)
  const location =
    row.location ||
    sniff(text, /location[:\s]+([^\n]+)/i) ||
    sniff(text, /prefer[:\s]+([^\n]+)/i)
  const timeline =
    sniff(text, /(this month|three months|3 months|next month|soon|exploring)/i) ||
    sniff(text, /timeline[:\s]+([^\n]+)/i)
  const interest = row.interested_in || sniff(text, /interested[^.\n]*/i)
  return { budget, location, timeline, interest }
}

function formatTranscriptLines(transcript: string) {
  const lines = transcript.split(/\n+/).filter(Boolean)
  return lines.map((line, i) => {
    const lower = line.toLowerCase()
    const isUser =
      /^user:/i.test(line) ||
      lower.startsWith('user ') ||
      /^customer:/i.test(line)
    const isAi =
      /^assistant:/i.test(line) ||
      lower.startsWith('assistant ') ||
      /^ai:/i.test(line) ||
      /^agent:/i.test(line)
    let cls = 'text-slate-700'
    if (isUser) cls = 'text-blue-800'
    if (isAi) cls = 'text-violet-800'
    return (
      <p key={i} className={`text-xs leading-relaxed ${cls}`}>
        {line}
      </p>
    )
  })
}

export default function ScoredLeadsPage() {
  const [tab, setTab] = useState<TabId>('hot')
  const [location, setLocation] = useState('')
  const [campaignId, setCampaignId] = useState('')
  const [locations, setLocations] = useState<string[]>([])
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([])
  const [leads, setLeads] = useState<LeadRow[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [live, setLive] = useState(false)
  const [modalLead, setModalLead] = useState<LeadRow | null>(null)

  const tabRange = useMemo(() => TABS.find((t) => t.id === tab) || TABS[1], [tab])

  const loadFilters = useCallback(async () => {
    const [locRes, campRes] = await Promise.all([
      fetch('/api/campaigns/filter-options'),
      fetch('/api/campaigns'),
    ])
    const locJ = await locRes.json().catch(() => ({}))
    const campJ = await campRes.json().catch(() => ({}))
    if (locJ.locations) setLocations(locJ.locations as string[])
    if (campJ.campaigns)
      setCampaigns(
        (campJ.campaigns as { id: string; name: string }[]).map((c) => ({
          id: c.id,
          name: c.name,
        }))
      )
  }, [])

  const checkRunning = useCallback(async () => {
    try {
      const res = await fetch('/api/campaigns')
      const j = await res.json()
      if (!res.ok) return false
      const rows = (j.campaigns || []) as { status: string | null }[]
      return rows.some((c) => (c.status || '').toLowerCase() === 'running')
    } catch {
      return false
    }
  }, [])

  const loadLeads = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        minScore: String(tabRange.min),
        maxScore: String(tabRange.max),
        limit: '200',
      })
      if (location) params.set('location', location)
      if (campaignId) params.set('campaignId', campaignId)
      const res = await fetch(`/api/leads/scored?${params}`)
      const j = (await res.json().catch(() => ({}))) as { error?: string; leads?: LeadRow[]; stats?: Stats }
      if (!res.ok) throw new Error(j.error || 'Failed to load scored leads')
      setLeads(j.leads || [])
      setStats(j.stats as Stats)
      setLastUpdated(new Date().toLocaleString())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [tabRange.min, tabRange.max, location, campaignId])

  useEffect(() => {
    void loadFilters()
  }, [loadFilters])

  useEffect(() => {
    void loadLeads()
  }, [loadLeads])

  useEffect(() => {
    let cancelled = false
    const tick = async () => {
      const running = await checkRunning()
      if (cancelled) return
      setLive(running)
      if (running) void loadLeads()
    }

    void tick()
    const interval = setInterval(() => void tick(), 10_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [checkRunning, loadLeads])

  const exportCsv = () => {
    const rows = [
      ['Name', 'Phone', 'Location', 'Score', 'Label', 'Budget Mentioned', 'Follow Up Action', 'Campaign', 'Called At'],
      ...leads.map((r) => [
        r.name,
        r.phone,
        r.location || '',
        String(r.lead_score),
        r.score_label || '',
        r.budget_mentioned || '',
        r.follow_up_action || '',
        r.campaign,
        r.called_at ? new Date(r.called_at).toLocaleString() : '',
      ]),
    ]
    const esc = (c: string) => `"${String(c).replace(/"/g, '""')}"`
    const csv = rows.map((line) => line.map(esc).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const d = new Date().toISOString().slice(0, 10)
    a.href = url
    a.download = `hot-leads-${d}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const markCalled = async (leadId: string) => {
    const res = await fetch('/api/leads/mark-called', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError((j as { error?: string }).error || 'Could not mark called')
      return
    }
    setLeads((prev) =>
      prev.map((r) => (r.id === leadId ? { ...r, manual_call_done: true } : r))
    )
    void loadLeads()
  }

  const empty = !loading && leads.length === 0 && !error

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-900">Scored Leads</h1>
          {live && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-0.5 text-[11px] font-semibold text-green-800 border border-green-200">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              Live
            </span>
          )}
          {lastUpdated && (
            <span className="text-[11px] text-slate-500">Last updated {lastUpdated}</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => exportCsv()}
            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition"
          >
            Export CSV
          </button>
          <Link
            href="/dashboard/campaigns"
            className="inline-flex items-center rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Campaigns
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              tab === t.id
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <label className="flex-1 text-xs font-medium text-slate-700">
          Location
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
          >
            <option value="">All locations</option>
            {locations.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </label>
        <label className="flex-1 text-xs font-medium text-slate-700">
          Campaign
          <select
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
          >
            <option value="">All campaigns</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          {error}
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            ['Total scored', stats.total],
            ['🔥 Hot (≥80)', stats.hotCount],
            ['Avg score', stats.avgScore],
            ['Connected this week', stats.connectedThisWeek],
          ].map(([label, val]) => (
            <div
              key={label as string}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <p className="text-[11px] font-medium text-slate-500">{label}</p>
              <p className="text-lg font-semibold text-slate-900">{val as number}</p>
            </div>
          ))}
        </div>
      )}

      {loading && !stats ? (
        <p className="text-sm text-slate-500">Loading scored leads…</p>
      ) : error && leads.length === 0 ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
          <p className="font-semibold mb-1">Could not load scored leads</p>
          <p className="text-xs">{error}</p>
          <p className="text-xs mt-2 text-red-700">
            Check that Supabase env vars are set and migration 013 (manual_call_done, etc.) has been
            applied.
          </p>
        </div>
      ) : empty ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 shadow-sm text-center space-y-4">
          <div className="text-5xl" aria-hidden>
            📋
          </div>
          <p className="text-sm text-slate-700 max-w-md mx-auto">
            No scored leads yet. Launch a campaign to start calling and scoring your contacts.
          </p>
          <Link
            href="/dashboard/campaigns"
            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition"
          >
            Go to Campaigns
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600">
                  <th className="px-2 py-2 text-left font-medium">#</th>
                  <th className="px-2 py-2 text-left font-medium">Name</th>
                  <th className="px-2 py-2 text-left font-medium">Phone</th>
                  <th className="px-2 py-2 text-left font-medium">Score</th>
                  <th className="px-2 py-2 text-left font-medium">Label</th>
                  <th className="px-2 py-2 text-left font-medium">Location</th>
                  <th className="px-2 py-2 text-left font-medium">Budget</th>
                  <th className="px-2 py-2 text-left font-medium">Follow up</th>
                  <th className="px-2 py-2 text-left font-medium">Called</th>
                  <th className="px-2 py-2 text-left font-medium">Campaign</th>
                  <th className="px-2 py-2 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leads.map((r) => (
                  <tr key={r.id}>
                    <td className="px-2 py-2 text-slate-500">{r.rank}</td>
                    <td className="px-2 py-2 text-slate-800 font-medium">{r.name}</td>
                    <td className="px-2 py-2 text-slate-700 whitespace-nowrap">{r.phone}</td>
                    <td className="px-2 py-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${scoreBadgeClass(Number(r.lead_score))}`}
                      >
                        {Number(r.lead_score) || 0}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-slate-600">{r.score_label || '—'}</td>
                    <td className="px-2 py-2 text-slate-600 max-w-[120px] truncate">
                      {r.location || '—'}
                    </td>
                    <td className="px-2 py-2 text-slate-600 max-w-[140px] truncate">
                      {r.budget_mentioned || '—'}
                    </td>
                    <td className="px-2 py-2 text-slate-600 max-w-[160px] truncate">
                      {r.follow_up_action || '—'}
                    </td>
                    <td className="px-2 py-2 text-slate-500 whitespace-nowrap">
                      {r.called_at ? new Date(r.called_at).toLocaleString() : '—'}
                    </td>
                    <td className="px-2 py-2 text-slate-600 max-w-[120px] truncate">{r.campaign}</td>
                    <td className="px-2 py-2">
                      <div className="flex flex-col gap-1 min-w-[120px]">
                        <a
                          href={`tel:${(r.phone || '').replace(/\s/g, '')}`}
                          className="inline-flex justify-center rounded-lg bg-green-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-green-700"
                        >
                          📞 Call
                        </a>
                        <button
                          type="button"
                          onClick={() => setModalLead(r)}
                          className="inline-flex justify-center rounded-lg border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          👁 Transcript
                        </button>
                        <button
                          type="button"
                          disabled={r.manual_call_done}
                          onClick={() => void markCalled(r.id)}
                          className="inline-flex justify-center rounded-lg border border-blue-200 px-2 py-1 text-[11px] font-semibold text-blue-800 hover:bg-blue-50 disabled:opacity-40"
                        >
                          {r.manual_call_done ? '✅ Done' : '✅ Mark called'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={Boolean(modalLead)} onOpenChange={(o) => !o && setModalLead(null)}>
        <DialogContent className="max-h-[85vh]">
          {modalLead && (
            <>
              <DialogHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <DialogTitle>{modalLead.name}</DialogTitle>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${scoreBadgeClass(Number(modalLead.lead_score))}`}
                  >
                    {Number(modalLead.lead_score) || 0}
                  </span>
                </div>
                <DialogDescription>Call transcript and notes</DialogDescription>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
                {(() => {
                  const ins = insightsFromTranscript(modalLead.transcript, modalLead)
                  return (
                    <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-[11px] text-slate-700 space-y-1">
                      <p>
                        <span className="font-semibold text-slate-800">Budget:</span>{' '}
                        {ins.budget || '—'}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-800">Location:</span>{' '}
                        {ins.location || '—'}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-800">Timeline:</span>{' '}
                        {ins.timeline || '—'}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-800">Interest:</span>{' '}
                        {ins.interest || '—'}
                      </p>
                    </div>
                  )
                })()}
                <div className="rounded-lg border border-slate-200 p-3 max-h-[50vh] overflow-y-auto bg-white space-y-1">
                  {modalLead.transcript
                    ? formatTranscriptLines(modalLead.transcript)
                    : (
                        <p className="text-xs text-slate-500">No transcript stored.</p>
                      )}
                </div>
              </div>
              <div className="border-t border-slate-200 px-4 py-2 flex justify-end">
                <DialogClose onClick={() => setModalLead(null)}>Close</DialogClose>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

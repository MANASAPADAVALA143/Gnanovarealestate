'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../../../../lib/api-fetch'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type SpeedSourceBucket = '99acres' | 'magicbricks' | 'zillow' | 'facebook' | 'website' | 'other'

type StatsPayload = {
  totalToday: number
  avgResponseSeconds: number | null
  hotLeadsToday: number
  fastestSeconds: number | null
  bySource: { source: SpeedSourceBucket; count: number; avgScore: number | null }[]
  recentLeads: Array<{
    id: string
    source: string | null
    property_interest: string | null
    response_seconds: number | null
    call_duration_seconds: number | null
    lead_score: number | null
    call_status: string | null
    received_at: string | null
    lead: { name: string | null; phone: string | null; call_transcript: string | null } | null
  }>
  chartData: { date: string; avgSeconds: number | null }[]
}

const SOURCE_CARD_LABEL: Record<SpeedSourceBucket, string> = {
  '99acres': '99acres',
  magicbricks: 'MagicBricks',
  zillow: 'Zillow',
  facebook: 'Facebook',
  website: 'Website',
  other: 'Other',
}

function maskPhone(phone: string | null | undefined): string {
  const digits = String(phone || '').replace(/\D/g, '')
  if (digits.length >= 10) {
    const last4 = digits.slice(-4)
    return `+91 XXXXX X${last4}`
  }
  if (digits.length >= 4) {
    return `+91 XXXXX X${digits.slice(-4)}`
  }
  return '—'
}

function avgResponseCardClass(seconds: number | null): string {
  if (seconds === null || Number.isNaN(seconds)) return 'border-slate-200 bg-white'
  if (seconds < 60) return 'border-emerald-200 bg-emerald-50/60'
  if (seconds <= 120) return 'border-amber-200 bg-amber-50/70'
  return 'border-red-200 bg-red-50/60'
}

function rowStatusBadge(row: StatsPayload['recentLeads'][0]): { label: string; className: string } {
  const cs = (row.call_status || '').toLowerCase()
  const score = row.lead_score
  const transcript = (row.lead?.call_transcript || '').trim()
  const dur = row.call_duration_seconds

  if (cs === 'pending') {
    return { label: '⏳ Pending', className: 'bg-slate-100 text-slate-800' }
  }
  if (cs === 'calling') {
    return { label: '📞 Calling', className: 'bg-sky-100 text-sky-900' }
  }
  if (cs === 'skipped_no_vapi') {
    return { label: '⚠ Skipped', className: 'bg-amber-100 text-amber-900' }
  }
  if (cs === 'failed') {
    return { label: '❌ Failed', className: 'bg-red-100 text-red-900' }
  }

  if (
    cs === 'completed' &&
    typeof dur === 'number' &&
    dur >= 0 &&
    dur < 10
  ) {
    return { label: '❌ No Answer', className: 'bg-rose-100 text-rose-900' }
  }

  if (typeof score === 'number' && score >= 80) {
    return { label: '✅ Hot', className: 'bg-green-100 text-green-900' }
  }
  if (typeof score === 'number' && score >= 50) {
    return { label: '⚡ Warm', className: 'bg-violet-100 text-violet-900' }
  }

  if (cs === 'completed' && transcript.length < 25) {
    return { label: '❌ No Answer', className: 'bg-rose-100 text-rose-900' }
  }

  return { label: '🧊 Cold', className: 'bg-slate-100 text-slate-700' }
}

export default function SpeedToLeadPage() {
  const [data, setData] = useState<StatsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [live, setLive] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await apiFetch('/api/speed-to-lead/stats', { cache: 'no-store' })
      const j = (await res.json()) as StatsPayload & { error?: string }
      if (!res.ok) throw new Error(j.error || 'Failed to load')
      setData({
        totalToday: j.totalToday ?? 0,
        avgResponseSeconds: j.avgResponseSeconds ?? null,
        hotLeadsToday: j.hotLeadsToday ?? 0,
        fastestSeconds: j.fastestSeconds ?? null,
        bySource: Array.isArray(j.bySource) ? j.bySource : [],
        recentLeads: Array.isArray(j.recentLeads) ? j.recentLeads : [],
        chartData: Array.isArray(j.chartData) ? j.chartData : [],
      })
      setError(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!live) return
    const id = window.setInterval(() => {
      void load()
    }, 5000)
    return () => window.clearInterval(id)
  }, [live, load])

  const avg = data?.avgResponseSeconds ?? null
  const chartRows = (data?.chartData || []).map((d) => ({
    ...d,
    avgSeconds: d.avgSeconds ?? 0,
    label: d.date.slice(5),
  }))

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Speed-to-Lead</h1>
            <p className="text-sm text-slate-600">
              Portal intake, dial speed, and scores from{' '}
              <code className="text-[11px] bg-slate-100 px-1 rounded">speed_to_lead_log</code>.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setLive((v) => !v)}
            className="mt-1 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
            title="Toggle auto-refresh (5s)"
          >
            <span
              className={`h-2 w-2 rounded-full ${live ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}
            />
            {live ? '● Live' : 'Paused'}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Back to overview
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Top stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Total portal leads today</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            {loading && !data ? '—' : data?.totalToday ?? 0}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">IST calendar day (Asia/Kolkata).</p>
        </div>

        <div
          className={`rounded-xl border p-4 shadow-sm ${avgResponseCardClass(loading ? null : avg)}`}
        >
          <p className="text-sm font-semibold text-slate-900">Avg response time</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            {loading && !data
              ? '—'
              : avg === null
                ? '—'
                : `${avg}s`}
          </p>
          <p className="text-[11px] text-slate-600 mt-1">
            Intake → call triggered. Green &lt;60s · Yellow 60–120s · Red &gt;120s.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Hot leads (score ≥ 80) today</p>
          <p className="text-2xl font-bold text-emerald-800 mt-1">
            {loading && !data ? '—' : data?.hotLeadsToday ?? 0}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Fastest response today</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            {loading && !data
              ? '—'
              : data?.fastestSeconds === null || data?.fastestSeconds === undefined
                ? '—'
                : `${data.fastestSeconds}s`}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Lowest response_seconds with a value.</p>
        </div>
      </div>

      {/* Source breakdown */}
      <div>
        <p className="text-sm font-semibold text-slate-900 mb-2">Source breakdown (today)</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {(data?.bySource || []).map((b) => (
            <div
              key={b.source}
              className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
            >
              <p className="text-xs font-semibold text-slate-800">
                {SOURCE_CARD_LABEL[b.source]}
              </p>
              <p className="text-lg font-bold text-slate-900 mt-1">{b.count}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Avg score:{' '}
                {b.avgScore === null || b.avgScore === undefined ? '—' : `${b.avgScore}`}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-slate-900">Avg response time by day</p>
          <p className="text-[11px] text-slate-500">Last 7 days · Red line = 60s target</p>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} label={{ value: 'Seconds', angle: -90, position: 'insideLeft', style: { fontSize: 10 } }} />
              <Tooltip
                formatter={(v: number | undefined) => [`${v ?? 0}s`, 'Avg response']}
                labelFormatter={(label, items) => {
                  const first = Array.isArray(items) ? items[0] : undefined
                  const payload = first && typeof first === 'object' && 'payload' in first
                    ? (first as { payload?: { date?: string } }).payload
                    : undefined
                  return payload?.date ?? String(label)
                }}
              />
              <ReferenceLine
                y={60}
                stroke="#dc2626"
                strokeDasharray="4 4"
                label={{ value: '60s', position: 'insideTopRight', fill: '#dc2626', fontSize: 10 }}
              />
              <Bar dataKey="avgSeconds" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Avg seconds" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Live feed */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-slate-900">Live feed</p>
          <p className="text-[11px] text-slate-500">Last 50 intakes · refreshes every 5s when live</p>
        </div>
        <div className="overflow-x-auto -mx-4 px-4">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500">
                <th className="px-3 py-2 text-left font-medium">Time</th>
                <th className="px-3 py-2 text-left font-medium">Lead</th>
                <th className="px-3 py-2 text-left font-medium">Phone</th>
                <th className="px-3 py-2 text-left font-medium">Source</th>
                <th className="px-3 py-2 text-left font-medium">Property interest</th>
                <th className="px-3 py-2 text-left font-medium">Response</th>
                <th className="px-3 py-2 text-left font-medium">Score</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && !data ? (
                <tr>
                  <td colSpan={8} className="px-3 py-4 text-slate-500">
                    Loading…
                  </td>
                </tr>
              ) : !data?.recentLeads?.length ? (
                <tr>
                  <td colSpan={8} className="px-3 py-4 text-slate-500">
                    No speed-to-lead rows yet. Send a test from n8n or curl (see{' '}
                    <code className="bg-slate-100 px-1 rounded">N8N_PORTAL_SETUP.md</code>).
                  </td>
                </tr>
              ) : (
                data.recentLeads.map((row) => {
                  const badge = rowStatusBadge(row)
                  return (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-slate-600 whitespace-nowrap" suppressHydrationWarning>
                        {row.received_at
                          ? new Date(row.received_at).toLocaleString('en-IN', {
                              timeZone: 'Asia/Kolkata',
                              hour12: true,
                            })
                          : '—'}
                      </td>
                      <td className="px-3 py-2 text-slate-800">{row.lead?.name || '—'}</td>
                      <td className="px-3 py-2 text-slate-700 font-mono">{maskPhone(row.lead?.phone)}</td>
                      <td className="px-3 py-2 text-slate-700">{row.source || '—'}</td>
                      <td className="px-3 py-2 text-slate-600 max-w-[200px] truncate">
                        {row.property_interest || '—'}
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {row.response_seconds === null || row.response_seconds === undefined
                          ? '—'
                          : `${row.response_seconds}s`}
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {row.lead_score === null || row.lead_score === undefined ? '—' : row.lead_score}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

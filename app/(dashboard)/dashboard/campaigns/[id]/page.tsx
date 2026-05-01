'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

type Campaign = {
  id: string
  name: string
  status: string | null
  started_at: string | null
  total_leads: number | null
  leads_count: number | null
  calls_made: number | null
  calls_completed: number | null
  calls_connected: number | null
}

type LeadRow = {
  campaignLeadId: string
  name: string
  phone: string
  location: string | null
  status: string
  lead_score: number | null
  score_label: string | null
  called_at: string | null
}

type Stats = { total: number; called: number; connected: number; avgScore: number }

function campaignIdFromParams(params: ReturnType<typeof useParams>): string {
  const raw = params?.id
  if (Array.isArray(raw)) return raw[0] || ''
  if (typeof raw === 'string') return raw
  return ''
}

export default function CampaignDetailPage() {
  const params = useParams()
  const id = campaignIdFromParams(params)
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [leads, setLeads] = useState<LeadRow[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pausing, setPausing] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    try {
      const res = await fetch(`/api/campaigns/${id}`)
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Failed to load')
      setCampaign(j.campaign as Campaign)
      setLeads(j.leads as LeadRow[])
      setStats(j.stats as Stats)
      setError(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!id || campaign?.status !== 'running') return
    const t = setInterval(() => void load(), 5000)
    return () => clearInterval(t)
  }, [id, campaign?.status, load])

  const pause = async () => {
    setPausing(true)
    try {
      const res = await fetch(`/api/campaigns/${id}/pause`, { method: 'POST' })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Pause failed')
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Pause failed')
    } finally {
      setPausing(false)
    }
  }

  const exportHot = async () => {
    const res = await fetch(`/api/campaigns/${id}/export-hot`)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError((j as { error?: string }).error || 'Export failed')
      return
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `hot-leads-${id.slice(0, 8)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const statusBadge = (s: string | null | undefined) => {
    const v = (s || 'draft').toLowerCase()
    const map: Record<string, string> = {
      draft: 'bg-slate-100 text-slate-700',
      running: 'bg-green-100 text-green-800',
      active: 'bg-green-100 text-green-800',
      paused: 'bg-amber-100 text-amber-900',
      completed: 'bg-blue-100 text-blue-800',
    }
    const cls = map[v] || 'bg-slate-100 text-slate-700'
    return (
      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
        {v}
      </span>
    )
  }

  if (!id) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm text-center text-sm text-slate-600">
        Loading campaign…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-slate-900">
              {campaign?.name || 'Campaign'}
            </h1>
            {statusBadge(campaign?.status)}
          </div>
          {campaign?.started_at && (
            <p className="text-xs text-slate-500">
              Started {new Date(campaign.started_at).toLocaleString()}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/campaigns"
            className="inline-flex items-center rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            All campaigns
          </Link>
          {campaign?.status === 'running' && (
            <button
              type="button"
              disabled={pausing}
              onClick={() => void pause()}
              className="inline-flex items-center rounded-lg border border-amber-300 px-4 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-50 transition disabled:opacity-50"
            >
              {pausing ? 'Pausing…' : 'Pause Campaign'}
            </button>
          )}
          <button
            type="button"
            onClick={() => void exportHot()}
            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition"
          >
            Export Hot Leads
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          {error}
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            ['Total', stats.total],
            ['Called', stats.called],
            ['Connected', stats.connected],
            ['Avg score', stats.avgScore],
          ].map(([label, val]) => (
            <div key={label as string} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-medium text-slate-500">{label}</p>
              <p className="text-lg font-semibold text-slate-900">{val as number}</p>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-slate-900 mb-3">Campaign leads</p>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600">
                <th className="px-3 py-2 text-left font-medium">Name</th>
                <th className="px-3 py-2 text-left font-medium">Phone</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-left font-medium">Score</th>
                <th className="px-3 py-2 text-left font-medium">Label</th>
                <th className="px-3 py-2 text-left font-medium">Called at</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leads.map((r) => (
                <tr key={r.campaignLeadId}>
                  <td className="px-3 py-2 text-slate-800">{r.name}</td>
                  <td className="px-3 py-2 text-slate-700">{r.phone}</td>
                  <td className="px-3 py-2 text-slate-600">{r.status}</td>
                  <td className="px-3 py-2 text-slate-700">
                    {r.lead_score != null ? r.lead_score : '—'}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{r.score_label || '—'}</td>
                  <td className="px-3 py-2 text-slate-500">
                    {r.called_at ? new Date(r.called_at).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

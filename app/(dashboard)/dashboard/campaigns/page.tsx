'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { apiFetch } from '../../../../lib/api-fetch'

type CampaignListRow = {
  id: string
  name: string
  status: string | null
  created_at: string | null
  leads_count: number | null
  total_leads: number | null
  calls_made: number | null
  calls_completed: number | null
  calls_connected: number | null
  scored_count: number
}

function statusBadge(s: string | null | undefined) {
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

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<CampaignListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const res = await apiFetch('/api/campaigns')
        const j = await res.json()
        if (!res.ok) throw new Error(j.error || 'Failed to load campaigns')
        if (!cancelled) setCampaigns(j.campaigns || [])
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Campaigns</h1>
          <p className="text-sm text-slate-600">
            Manage outbound campaigns and contact lists for your AI calling workflows.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/campaigns/new"
            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition"
          >
            New Campaign
          </Link>
          <Link
            href="/dashboard/campaigns/import"
            className="inline-flex items-center rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Import Contacts
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading campaigns…</p>
      ) : campaigns.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600 mb-3">
            No campaigns yet. Import contacts, then start a new campaign to launch your first
            outbound batch.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/campaigns/new"
              className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition"
            >
              New Campaign
            </Link>
            <Link
              href="/dashboard/campaigns/import"
              className="inline-flex items-center rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Import Contacts
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {campaigns.map((c) => {
            const total = c.total_leads ?? c.leads_count ?? 0
            const made = c.calls_made ?? 0
            const pct = total > 0 ? Math.min(100, Math.round((made / total) * 100)) : 0
            const connected = c.calls_connected ?? 0
            return (
              <div
                key={c.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{c.name}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {c.created_at ? new Date(c.created_at).toLocaleDateString() : ''}
                    </p>
                  </div>
                  {statusBadge(c.status)}
                </div>
                <div>
                  <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                    <span>Progress</span>
                    <span>
                      {made} / {total} calls
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-blue-600 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-600">
                  <span className="font-semibold text-slate-800">{connected}</span> connected |{' '}
                  <span className="font-semibold text-slate-800">{c.scored_count}</span> scored
                </p>
                <Link
                  href={`/dashboard/campaigns/${c.id}`}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition mt-auto"
                >
                  View
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

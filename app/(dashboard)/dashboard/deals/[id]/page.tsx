'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api-fetch'
import { DEAL_STAGE_LABELS, DEAL_STAGES, formatAed, type DealStage } from '@/lib/pipeline'

type Deal = {
  id: string
  client_name: string | null
  stage: DealStage | string
  unit_number: string | null
  project_name: string | null
  sale_value: number | null
  commission_percent: number | null
  agent_commission: number | null
  brokerage_commission: number | null
  expected_close_date: string | null
  actual_close_date: string | null
  lost_reason: string | null
  leads?: { name?: string; phone?: string } | null
  agents?: { full_name?: string | null } | null
}

function embed<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? v[0] ?? null : v
}

export default function DealDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [deal, setDeal] = useState<Deal | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const res = await apiFetch(`/api/deals/${id}`)
    const j = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) {
      setError(j.error || 'Failed to load deal')
      return
    }
    setDeal(j.deal as Deal)
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  async function changeStage(stage: string) {
    if (!id) return
    let lost_reason: string | undefined
    if (stage === 'closed_lost') {
      lost_reason = window.prompt('Lost reason?') || ''
      if (!lost_reason.trim()) return
    }
    const res = await apiFetch(`/api/deals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage, lost_reason }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(j.error || 'Update failed')
      return
    }
    setDeal(j.deal as Deal)
  }

  if (loading) return <p className="text-sm text-slate-400 py-10 text-center">Loading deal…</p>
  if (!deal) {
    return (
      <div>
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        <Link href="/dashboard/deals" className="text-sm text-blue-700">
          ← Deals
        </Link>
      </div>
    )
  }

  const lead = embed(deal.leads)
  const total =
    deal.sale_value != null && deal.commission_percent != null
      ? (Number(deal.sale_value) * Number(deal.commission_percent)) / 100
      : null

  return (
    <div className="space-y-6">
      <Link href="/dashboard/deals" className="text-xs text-slate-500 hover:text-slate-800">
        ← All deals
      </Link>
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{error}</div>
      )}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{lead?.name || deal.client_name || 'Deal'}</h1>
            <p className="text-sm text-slate-500 mt-1">
              {[deal.project_name, deal.unit_number].filter(Boolean).join(' · ') || 'No unit'}
            </p>
          </div>
          <select
            value={String(deal.stage)}
            onChange={(e) => void changeStage(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium"
          >
            {DEAL_STAGES.map((s) => (
              <option key={s} value={s}>
                {DEAL_STAGE_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        {deal.lost_reason && <p className="text-sm text-red-700">Lost: {deal.lost_reason}</p>}
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-slate-50 p-3">
            <dt className="text-xs text-slate-500">Sale value</dt>
            <dd className="mt-1 font-semibold">{formatAed(deal.sale_value)}</dd>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <dt className="text-xs text-slate-500">Commission %</dt>
            <dd className="mt-1 font-semibold">{deal.commission_percent != null ? `${deal.commission_percent}%` : '—'}</dd>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <dt className="text-xs text-slate-500">Gross commission</dt>
            <dd className="mt-1 font-semibold">{formatAed(total)}</dd>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <dt className="text-xs text-slate-500">Agent commission</dt>
            <dd className="mt-1 font-semibold">{formatAed(deal.agent_commission)}</dd>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <dt className="text-xs text-slate-500">Brokerage commission</dt>
            <dd className="mt-1 font-semibold">{formatAed(deal.brokerage_commission)}</dd>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <dt className="text-xs text-slate-500">Expected close</dt>
            <dd className="mt-1">{deal.expected_close_date || '—'}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}

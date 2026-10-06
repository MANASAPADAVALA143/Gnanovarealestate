'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../../../../lib/api-fetch'
import { DEAL_STAGE_LABELS, DEAL_STAGES, formatAed, type DealStage } from '../../../../lib/pipeline'

type Deal = {
  id: string
  client_name: string | null
  stage: DealStage | string
  unit_number: string | null
  project_name: string | null
  sale_value: number | null
  expected_close_date: string | null
  leads?: { name?: string } | null
  agents?: { full_name?: string | null } | null
}

function embed<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? v[0] ?? null : v
}

function clientName(d: Deal) {
  return embed(d.leads)?.name || d.client_name || 'Client'
}

export default function DealsPage() {
  const [tab, setTab] = useState<'kanban' | 'list'>('kanban')
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch('/api/deals')
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Failed to load deals')
      setDeals((j.deals as Deal[]) || [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const grouped = useMemo(() => {
    const map = Object.fromEntries(DEAL_STAGES.map((s) => [s, [] as Deal[]])) as Record<DealStage, Deal[]>
    for (const d of deals) {
      const stage = (DEAL_STAGES.includes(d.stage as DealStage) ? d.stage : 'viewing') as DealStage
      map[stage].push(d)
    }
    return map
  }, [deals])

  async function move(id: string, stage: DealStage) {
    if (stage === 'closed_lost') {
      const reason = window.prompt('Lost reason?') || ''
      if (!reason.trim()) return
      const res = await apiFetch(`/api/deals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage, lost_reason: reason.trim() }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.error || 'Move failed')
        return
      }
    } else {
      const res = await apiFetch(`/api/deals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.error || 'Move failed')
        return
      }
    }
    setDeals((prev) => prev.map((d) => (d.id === id ? { ...d, stage } : d)))
  }

  function Card({ deal }: { deal: Deal }) {
    return (
      <article
        draggable
        onDragStart={(e) => {
          setDraggingId(deal.id)
          e.dataTransfer.setData('text/deal-id', deal.id)
        }}
        className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
      >
        <Link href={`/dashboard/deals/${deal.id}`} className="text-sm font-semibold text-slate-900 hover:text-blue-700">
          {clientName(deal)}
        </Link>
        <p className="text-xs text-slate-500 mt-1">
          {[deal.project_name, deal.unit_number].filter(Boolean).join(' · ') || 'No unit'}
        </p>
        <p className="text-xs font-medium text-slate-800 mt-1">{formatAed(deal.sale_value)}</p>
        <p className="text-[11px] text-slate-400 mt-1">
          {embed(deal.agents)?.full_name || 'You'}
          {deal.expected_close_date ? ` · ${deal.expected_close_date}` : ''}
        </p>
      </article>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Deals</h1>
          <p className="text-sm text-slate-500 mt-1">Sale pipeline and commission fields</p>
        </div>
        <div className="flex gap-2">
          {(['kanban', 'list'] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${
                tab === id ? 'bg-blue-600 text-white' : 'border border-slate-300 text-slate-700'
              }`}
            >
              {id}
            </button>
          ))}
        </div>
      </div>
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{error}</div>
      )}
      {loading ? (
        <p className="text-sm text-slate-400 py-10 text-center">Loading deals…</p>
      ) : tab === 'kanban' ? (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {DEAL_STAGES.map((stage) => (
            <div
              key={stage}
              className="w-64 flex-shrink-0 rounded-xl border border-slate-200 bg-slate-50"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const id = e.dataTransfer.getData('text/deal-id') || draggingId
                if (id) void move(id, stage)
              }}
            >
              <div className="px-3 py-2 border-b border-slate-200 flex justify-between">
                <h2 className="text-xs font-semibold text-slate-700">{DEAL_STAGE_LABELS[stage]}</h2>
                <span className="text-[11px] text-slate-400">{grouped[stage].length}</span>
              </div>
              <div className="p-2 space-y-2 min-h-[12rem]">
                {grouped[stage].map((d) => (
                  <Card key={d.id} deal={d} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Sale value</th>
                <th className="px-4 py-3">Stage</th>
                <th className="px-4 py-3">Close</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {deals.map((d) => (
                <tr key={d.id}>
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/deals/${d.id}`} className="font-semibold text-blue-700 hover:underline">
                      {clientName(d)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{[d.project_name, d.unit_number].filter(Boolean).join(' · ') || '—'}</td>
                  <td className="px-4 py-3">{formatAed(d.sale_value)}</td>
                  <td className="px-4 py-3">{DEAL_STAGE_LABELS[d.stage as DealStage] || d.stage}</td>
                  <td className="px-4 py-3 text-xs">{d.expected_close_date || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

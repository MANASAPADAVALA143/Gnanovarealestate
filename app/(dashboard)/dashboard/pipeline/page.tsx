'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiFetch } from '@/lib/api-fetch'
import { PIPELINE_STAGE_LABELS, PIPELINE_STAGES, type PipelineStage } from '@/lib/pipeline'

type LeadCard = {
  id: string
  name: string
  phone: string
  source: string | null
  pipeline_stage: PipelineStage | string
  lead_score: number | null
  score_label: string | null
}

function scoreBadgeClass(score: number | null, label: string | null) {
  const fromLabel = (label || '').toLowerCase()
  if (fromLabel === 'hot' || (score != null && score >= 80)) return 'bg-green-100 text-green-800'
  if (fromLabel === 'warm' || (score != null && score >= 50)) return 'bg-yellow-100 text-yellow-900'
  if (fromLabel === 'cold' || score != null) return 'bg-orange-100 text-orange-900'
  return 'bg-slate-100 text-slate-600'
}

export default function PipelinePage() {
  const [leads, setLeads] = useState<LeadCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch('/api/leads/list?limit=500')
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Failed to load pipeline')
      setLeads((j.leads as LeadCard[]) || [])
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
    const map = Object.fromEntries(PIPELINE_STAGES.map((s) => [s, [] as LeadCard[]])) as Record<
      PipelineStage,
      LeadCard[]
    >
    for (const lead of leads) {
      const stage = (PIPELINE_STAGES.includes(lead.pipeline_stage as PipelineStage)
        ? lead.pipeline_stage
        : 'new') as PipelineStage
      map[stage].push(lead)
    }
    return map
  }, [leads])

  async function moveLead(leadId: string, stage: PipelineStage) {
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, pipeline_stage: stage } : l)))
    const res = await apiFetch(`/api/leads/${leadId}/stage`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pipeline_stage: stage }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(j.error || 'Could not move lead')
      void load()
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Pipeline</h1>
        <p className="text-sm text-slate-500 mt-1">Drag cards between stages. Click a card for Lead 360.</p>
      </div>
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{error}</div>
      )}
      {loading ? (
        <p className="text-sm text-slate-400 py-12 text-center">Loading pipeline…</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {PIPELINE_STAGES.map((stage) => (
            <div
              key={stage}
              className="w-64 flex-shrink-0 rounded-xl border border-slate-200 bg-slate-50"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const id = e.dataTransfer.getData('text/lead-id') || draggingId
                if (id) void moveLead(id, stage)
                setDraggingId(null)
              }}
            >
              <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between">
                <h2 className="text-xs font-semibold text-slate-700">{PIPELINE_STAGE_LABELS[stage]}</h2>
                <span className="text-[11px] text-slate-400">{grouped[stage].length}</span>
              </div>
              <div className="p-2 space-y-2 min-h-[12rem]">
                {grouped[stage].map((lead) => (
                  <article
                    key={lead.id}
                    draggable
                    onDragStart={(e) => {
                      setDraggingId(lead.id)
                      e.dataTransfer.setData('text/lead-id', lead.id)
                      e.dataTransfer.effectAllowed = 'move'
                    }}
                    className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm cursor-grab active:cursor-grabbing"
                  >
                    <Link href={`/dashboard/leads/${lead.id}`} className="text-sm font-semibold text-slate-900 hover:text-blue-700">
                      {lead.name}
                    </Link>
                    <p className="text-xs text-slate-500 mt-1">{lead.phone}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${scoreBadgeClass(
                          lead.lead_score,
                          lead.score_label
                        )}`}
                      >
                        {lead.score_label || (lead.lead_score != null ? lead.lead_score : '—')}
                      </span>
                      <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] capitalize text-slate-600">
                        {lead.source || 'source'}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

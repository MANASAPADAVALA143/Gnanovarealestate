'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import AddLeadModal from '@/components/leads/AddLeadModal'
import { apiFetch } from '@/lib/api-fetch'
import { PIPELINE_STAGE_LABELS, type PipelineStage } from '@/lib/pipeline'
import { useWorkspace } from '@/lib/workspace-client'

type LeadRow = {
  id: string
  name: string
  phone: string
  email: string | null
  location: string | null
  source: string | null
  pipeline_stage: PipelineStage | string
  lead_score: number | null
  score_label: string | null
  agent_name: string | null
  last_activity_at: string | null
}

function scoreBadgeClass(score: number | null, label: string | null) {
  const fromLabel = (label || '').toLowerCase()
  if (fromLabel === 'hot' || (score != null && score >= 80)) return 'bg-green-100 text-green-800'
  if (fromLabel === 'warm' || (score != null && score >= 50)) return 'bg-yellow-100 text-yellow-900'
  if (fromLabel === 'cold' || score != null) return 'bg-orange-100 text-orange-900'
  return 'bg-slate-100 text-slate-600'
}

function stageBadgeClass(stage: string) {
  if (stage === 'closed' || stage === 'booked' || stage === 'registered') return 'bg-emerald-100 text-emerald-800'
  if (stage === 'lost') return 'bg-red-100 text-red-800'
  if (stage === 'negotiation' || stage === 'brochure_sent') return 'bg-violet-100 text-violet-800'
  if (stage.startsWith('viewing') || stage === 'meeting_scheduled' || stage === 'site_visit') {
    return 'bg-blue-100 text-blue-800'
  }
  return 'bg-slate-100 text-slate-700'
}

function formatWhen(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString()
}

export default function LeadsListPage() {
  const workspace = useWorkspace()
  const [q, setQ] = useState('')
  const [stage, setStage] = useState('')
  const [source, setSource] = useState('')
  const [scoreLabel, setScoreLabel] = useState('')
  const [leads, setLeads] = useState<LeadRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: '300' })
      if (q.trim()) params.set('q', q.trim())
      if (stage) params.set('stage', stage)
      if (source) params.set('source', source)
      if (scoreLabel) params.set('scoreLabel', scoreLabel)
      const res = await apiFetch(`/api/leads/list?${params}`)
      const j = (await res.json().catch(() => ({}))) as { error?: string; leads?: LeadRow[] }
      if (!res.ok) throw new Error(j.error || 'Failed to load leads')
      setLeads(j.leads || [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [q, stage, source, scoreLabel])

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 250)
    return () => window.clearTimeout(t)
  }, [load])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Leads</h1>
          <p className="text-sm text-slate-500 mt-1">{workspace.name} · Search, filter, and open Lead 360</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          >
            Add lead
          </button>
          <Link
            href="/dashboard/leads/scored"
            className="inline-flex items-center rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Hot Leads
          </Link>
        </div>
      </div>

      {notice && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">{notice}</div>
      )}

      <div className={`grid grid-cols-1 gap-3 ${workspace.sourceTags ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
        <label className="text-xs font-medium text-slate-700">
          Search
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, phone, or email"
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
          />
        </label>
        <label className="text-xs font-medium text-slate-700">
          Pipeline stage
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
          >
            <option value="">All stages</option>
            {workspace.pipelineStages.map((s) => (
              <option key={s} value={s}>
                {PIPELINE_STAGE_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        {workspace.sourceTags && (
          <label className="text-xs font-medium text-slate-700">
            Source
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            >
              <option value="">All sources</option>
              {workspace.sourceTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="text-xs font-medium text-slate-700">
          Score
          <select
            value={scoreLabel}
            onChange={(e) => setScoreLabel(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
          >
            <option value="">All scores</option>
            <option value="hot">Hot</option>
            <option value="warm">Warm</option>
            <option value="cold">Cold</option>
          </select>
        </label>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{error}</div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Stage</th>
              <th className="px-4 py-3">Last activity</th>
              <th className="px-4 py-3">Agent</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            ) : leads.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  No leads match these filters
                </td>
              </tr>
            ) : (
              leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/leads/${lead.id}`} className="font-semibold text-blue-700 hover:underline">
                      {lead.name}
                    </Link>
                    {lead.location && <div className="text-xs text-slate-400">{lead.location}</div>}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{lead.phone}</td>
                  <td className="px-4 py-3 capitalize text-slate-600">{lead.source || '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${scoreBadgeClass(
                        lead.lead_score,
                        lead.score_label
                      )}`}
                    >
                      {lead.score_label || (lead.lead_score != null ? String(lead.lead_score) : 'Unscored')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${stageBadgeClass(
                        String(lead.pipeline_stage)
                      )}`}
                    >
                      {PIPELINE_STAGE_LABELS[lead.pipeline_stage as PipelineStage] || lead.pipeline_stage}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{formatWhen(lead.last_activity_at)}</td>
                  <td className="px-4 py-3 text-slate-600">{lead.agent_name || 'Unassigned'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <AddLeadModal
          workspace={workspace}
          onClose={() => setShowAdd(false)}
          onCreated={(summary) => {
            setShowAdd(false)
            setNotice(summary)
            void load()
          }}
        />
      )}
    </div>
  )
}

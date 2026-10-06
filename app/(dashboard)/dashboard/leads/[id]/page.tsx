'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../../../../../lib/api-fetch'
import {
  PIPELINE_STAGE_LABELS,
  PIPELINE_STAGES,
  TASK_TYPE_LABELS,
  type LeadTaskType,
  type PipelineStage,
} from '../../../../../lib/pipeline'

type Lead = {
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
  timeline: string | null
  budget_mentioned: string | null
  interested_in: string | null
  follow_up_action: string | null
}

type Activity = {
  id: string
  type: string
  content: string
  created_at: string
}

type Task = {
  id: string
  type: LeadTaskType | string
  due_at: string
  status: string
}

type Viewing = {
  id: string
  scheduled_at: string
  status: string
  interest_level: string | null
  properties?: { title?: string | null; address?: string | null; city?: string | null } | null
}

type Tab = 'activity' | 'tasks' | 'properties' | 'viewings'

function scoreBadgeClass(score: number | null, label: string | null) {
  const fromLabel = (label || '').toLowerCase()
  if (fromLabel === 'hot' || (score != null && score >= 80)) return 'bg-green-100 text-green-800'
  if (fromLabel === 'warm' || (score != null && score >= 50)) return 'bg-yellow-100 text-yellow-900'
  if (fromLabel === 'cold' || score != null) return 'bg-orange-100 text-orange-900'
  return 'bg-slate-100 text-slate-600'
}

function activityIcon(type: string) {
  switch (type) {
    case 'call':
      return '📞'
    case 'whatsapp':
      return '💬'
    case 'email':
      return '✉️'
    case 'note':
      return '📝'
    case 'stage_change':
      return '🔄'
    case 'viewing':
      return '🏠'
    default:
      return '•'
  }
}

export default function Lead360Page() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const [lead, setLead] = useState<Lead | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [viewings, setViewings] = useState<Viewing[]>([])
  const [tab, setTab] = useState<Tab>('activity')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [showNote, setShowNote] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const [leadRes, actRes, taskRes, viewRes] = await Promise.all([
        apiFetch(`/api/leads/${id}`),
        apiFetch(`/api/leads/${id}/activities`),
        apiFetch(`/api/leads/${id}/tasks?status=pending`),
        apiFetch(`/api/leads/${id}/viewings`),
      ])
      const leadJ = await leadRes.json().catch(() => ({}))
      if (!leadRes.ok) throw new Error(leadJ.error || 'Failed to load lead')
      setLead(leadJ.lead as Lead)
      const actJ = await actRes.json().catch(() => ({}))
      setActivities((actJ.activities as Activity[]) || [])
      const taskJ = await taskRes.json().catch(() => ({}))
      setTasks((taskJ.tasks as Task[]) || [])
      const viewJ = await viewRes.json().catch(() => ({}))
      setViewings((viewJ.viewings as Viewing[]) || [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  async function changeStage(stage: string) {
    if (!id) return
    setSaving(true)
    setError(null)
    try {
      const res = await apiFetch(`/api/leads/${id}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipeline_stage: stage }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Could not update stage')
      setLead((prev) => (prev ? { ...prev, pipeline_stage: stage } : prev))
      void load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Stage update failed')
    } finally {
      setSaving(false)
    }
  }

  async function completeTask(taskId: string) {
    if (!id) return
    const res = await apiFetch(`/api/leads/${id}/tasks`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, status: 'completed' }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(j.error || 'Could not complete task')
      return
    }
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
  }

  async function addNote() {
    if (!id || !note.trim()) return
    setSaving(true)
    const res = await apiFetch(`/api/leads/${id}/activities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'note', content: note.trim() }),
    })
    setSaving(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(j.error || 'Could not add note')
      return
    }
    setNote('')
    setShowNote(false)
    void load()
  }

  if (loading && !lead) {
    return <div className="py-16 text-center text-sm text-slate-400">Loading lead…</div>
  }

  if (!lead) {
    return (
      <div className="space-y-3">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{error}</div>
        )}
        <Link href="/dashboard/leads" className="text-sm text-blue-700 hover:underline">
          ← Back to leads
        </Link>
      </div>
    )
  }

  const tel = `tel:${lead.phone}`
  const wa = `https://wa.me/${lead.phone.replace(/\D/g, '')}`

  return (
    <div className="space-y-6">
      <Link href="/dashboard/leads" className="text-xs font-medium text-slate-500 hover:text-slate-800">
        ← All leads
      </Link>

      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{lead.name}</h1>
            <p className="text-sm text-slate-500 mt-1">
              {lead.phone}
              {lead.email ? ` · ${lead.email}` : ''}
              {lead.location ? ` · ${lead.location}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${scoreBadgeClass(
                lead.lead_score,
                lead.score_label
              )}`}
            >
              {lead.score_label || (lead.lead_score != null ? `Score ${lead.lead_score}` : 'Unscored')}
            </span>
            <select
              value={String(lead.pipeline_stage || 'new')}
              disabled={saving}
              onChange={(e) => void changeStage(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800"
            >
              {PIPELINE_STAGES.map((s) => (
                <option key={s} value={s}>
                  {PIPELINE_STAGE_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <a href={tel} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">
            Call
          </a>
          <a
            href={wa}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            WhatsApp
          </a>
          <button
            type="button"
            onClick={() => setShowNote((v) => !v)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Add Note
          </button>
          <button
            type="button"
            onClick={() => setTab('viewings')}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Schedule Viewing
          </button>
        </div>

        {showNote && (
          <div className="space-y-2">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Add a note…"
            />
            <button
              type="button"
              disabled={saving || !note.trim()}
              onClick={() => void addNote()}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              Save note
            </button>
          </div>
        )}

        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div className="rounded-lg bg-slate-50 p-3">
            <dt className="text-xs text-slate-500">Budget</dt>
            <dd className="mt-1 text-slate-800">{lead.budget_mentioned || '—'}</dd>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <dt className="text-xs text-slate-500">Location</dt>
            <dd className="mt-1 text-slate-800">{lead.location || '—'}</dd>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <dt className="text-xs text-slate-500">Timeline</dt>
            <dd className="mt-1 text-slate-800">{lead.timeline || '—'}</dd>
          </div>
        </dl>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{error}</div>
      )}

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {(
          [
            ['activity', 'Activity Timeline'],
            ['tasks', `Tasks (${tasks.length})`],
            ['properties', 'Properties'],
            ['viewings', `Viewings (${viewings.length})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              tab === id
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'activity' && (
        <div className="space-y-2">
          {activities.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">No activity yet</p>
          ) : (
            activities.map((a) => (
              <div key={a.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-semibold text-slate-700">
                    {activityIcon(a.type)} {a.type.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-slate-400">{new Date(a.created_at).toLocaleString()}</span>
                </div>
                <p className="text-sm text-slate-800 whitespace-pre-wrap">{a.content}</p>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'tasks' && (
        <div className="space-y-2">
          {tasks.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">No pending tasks</p>
          ) : (
            tasks.map((t) => (
              <div key={t.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900">
                    {TASK_TYPE_LABELS[t.type as LeadTaskType] || t.type}
                  </p>
                  <p className="text-xs text-slate-500">Due {new Date(t.due_at).toLocaleString()}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void completeTask(t.id)}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  Complete
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'properties' && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-400">
          Property matches for this lead will land here in a later phase.
        </div>
      )}

      {tab === 'viewings' && (
        <div className="space-y-2">
          {viewings.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">No viewings yet</p>
          ) : (
            viewings.map((v) => {
              const prop = Array.isArray(v.properties) ? v.properties[0] : v.properties
              const label = prop?.title || prop?.address || prop?.city || 'Property'
              return (
                <div key={v.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-sm font-semibold text-slate-900">{label}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {new Date(v.scheduled_at).toLocaleString()} · {v.status}
                    {v.interest_level ? ` · interest ${v.interest_level}` : ''}
                  </p>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

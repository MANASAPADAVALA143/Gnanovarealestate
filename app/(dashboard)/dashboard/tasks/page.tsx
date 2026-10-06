'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../../../../lib/api-fetch'
import { TASK_TYPE_LABELS, type LeadTaskType } from '../../../../lib/pipeline'

type TaskRow = {
  id: string
  lead_id: string
  due_at: string
  type: string
  lead_name: string
  lead_phone: string
}

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function endOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch('/api/tasks')
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Failed to load tasks')
      setTasks((j.tasks as TaskRow[]) || [])
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
    const now = new Date()
    const start = startOfDay(now)
    const end = endOfDay(now)
    const overdue: TaskRow[] = []
    const today: TaskRow[] = []
    const upcoming: TaskRow[] = []
    for (const t of tasks) {
      const due = new Date(t.due_at)
      if (due < start) overdue.push(t)
      else if (due <= end) today.push(t)
      else upcoming.push(t)
    }
    return { overdue, today, upcoming }
  }, [tasks])

  async function complete(id: string) {
    const res = await apiFetch(`/api/tasks/${id}/complete`, { method: 'PATCH' })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(j.error || 'Could not complete')
      return
    }
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }

  function Section({ title, rows, tone }: { title: string; rows: TaskRow[]; tone: string }) {
    return (
      <section className="space-y-2">
        <h2 className={`text-sm font-semibold ${tone}`}>
          {title} ({rows.length})
        </h2>
        {rows.length === 0 ? (
          <p className="text-xs text-slate-400 px-1">None</p>
        ) : (
          rows.map((t) => (
            <div key={t.id} className="rounded-xl border border-slate-200 bg-white p-4 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-0">
                <Link href={`/dashboard/leads/${t.lead_id}`} className="text-sm font-semibold text-slate-900 hover:text-blue-700">
                  {t.lead_name}
                </Link>
                <p className="text-xs text-slate-500 mt-0.5">
                  {TASK_TYPE_LABELS[t.type as LeadTaskType] || t.type} · due {new Date(t.due_at).toLocaleString()}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void complete(t.id)}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  Complete
                </button>
                <a href={`tel:${t.lead_phone}`} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700">
                  Call
                </a>
                <a
                  href={`https://wa.me/${t.lead_phone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
                >
                  WhatsApp
                </a>
              </div>
            </div>
          ))
        )}
      </section>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Tasks</h1>
        <p className="text-sm text-slate-500 mt-1">Follow-ups grouped by due date</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="text-2xl font-bold text-red-700">{grouped.overdue.length}</div>
          <div className="text-xs text-red-800 mt-1">Overdue</div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="text-2xl font-bold text-amber-800">{grouped.today.length}</div>
          <div className="text-xs text-amber-900 mt-1">Due today</div>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="text-2xl font-bold text-blue-700">{grouped.upcoming.length}</div>
          <div className="text-xs text-blue-800 mt-1">Upcoming</div>
        </div>
      </div>
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{error}</div>
      )}
      {loading ? (
        <p className="text-sm text-slate-400 py-10 text-center">Loading tasks…</p>
      ) : (
        <div className="space-y-8">
          <Section title="Overdue" rows={grouped.overdue} tone="text-red-700" />
          <Section title="Due today" rows={grouped.today} tone="text-amber-800" />
          <Section title="Upcoming" rows={grouped.upcoming} tone="text-slate-700" />
        </div>
      )}
    </div>
  )
}

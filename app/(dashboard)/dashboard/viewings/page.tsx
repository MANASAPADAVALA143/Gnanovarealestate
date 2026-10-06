'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Calendar, dateFnsLocalizer } from 'react-big-calendar'
import { format, getDay, parse, startOfWeek } from 'date-fns'
import { enUS } from 'date-fns/locale'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { apiFetch } from '../../../../lib/api-fetch'

type Viewing = {
  id: string
  lead_id: string | null
  scheduled_at: string
  status: string
  interest_level: string | null
  feedback: string | null
  client_name: string | null
  leads?: { name?: string; phone?: string } | null
  properties?: { title?: string | null; address?: string | null } | null
  agents?: { full_name?: string | null } | null
}

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales: { 'en-US': enUS },
})

function embed<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? v[0] ?? null : v
}

export default function ViewingsPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'calendar' | 'list'>('list')
  const [viewings, setViewings] = useState<Viewing[]>([])
  const [selected, setSelected] = useState<Viewing | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch('/api/viewings')
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Failed to load viewings')
      setViewings((j.viewings as Viewing[]) || [])
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
    setFeedback(selected?.feedback || '')
  }, [selected])

  const events = useMemo(
    () =>
      viewings.map((v) => {
        const lead = embed(v.leads)
        const prop = embed(v.properties)
        return {
          id: v.id,
          title: `${lead?.name || v.client_name || 'Client'} · ${prop?.title || prop?.address || 'Property'}`,
          start: new Date(v.scheduled_at),
          end: new Date(new Date(v.scheduled_at).getTime() + 60 * 60 * 1000),
          resource: v,
        }
      }),
    [viewings]
  )

  async function patch(id: string, payload: Record<string, string>) {
    const res = await apiFetch(`/api/viewings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(j.error || 'Update failed')
      return
    }
    await load()
    setSelected((prev) => (prev && prev.id === id ? { ...prev, ...payload } : prev))
  }

  async function createDeal() {
    if (!selected?.lead_id) {
      setError('This viewing has no lead — cannot create a deal')
      return
    }
    const lead = embed(selected.leads)
    const res = await apiFetch('/api/deals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lead_id: selected.lead_id,
        client_name: lead?.name || selected.client_name,
        stage: 'viewing',
      }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(j.error || 'Could not create deal')
      return
    }
    router.push(`/dashboard/deals/${j.deal.id}`)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Viewings</h1>
          <p className="text-sm text-slate-500 mt-1">Calendar and list of property visits</p>
        </div>
        <div className="flex gap-2">
          {(['list', 'calendar'] as const).map((id) => (
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
        <p className="text-sm text-slate-400 py-10 text-center">Loading viewings…</p>
      ) : tab === 'calendar' ? (
        <div className="rounded-xl border border-slate-200 bg-white p-3 h-[560px]">
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            onSelectEvent={(ev) => setSelected((ev as { resource: Viewing }).resource)}
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Lead</th>
                <th className="px-4 py-3">Property</th>
                <th className="px-4 py-3">Agent</th>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Interest</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {viewings.map((v) => {
                const lead = embed(v.leads)
                const prop = embed(v.properties)
                const agent = embed(v.agents)
                return (
                  <tr key={v.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSelected(v)}>
                    <td className="px-4 py-3">{lead?.name || v.client_name || '—'}</td>
                    <td className="px-4 py-3">{prop?.title || prop?.address || '—'}</td>
                    <td className="px-4 py-3">{agent?.full_name || '—'}</td>
                    <td className="px-4 py-3 text-xs">{new Date(v.scheduled_at).toLocaleString()}</td>
                    <td className="px-4 py-3 capitalize">{v.status.replace('_', ' ')}</td>
                    <td className="px-4 py-3 capitalize">{v.interest_level || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex justify-end" onClick={() => setSelected(null)}>
          <div className="w-full max-w-md bg-white h-full overflow-y-auto p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-bold text-slate-900">Viewing</h2>
              <button type="button" className="text-slate-400" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
            <p className="text-sm text-slate-600">{new Date(selected.scheduled_at).toLocaleString()}</p>
            <div className="flex flex-wrap gap-2">
              {['confirmed', 'completed', 'no_show', 'cancelled'].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void patch(selected.id, { status: s })}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold capitalize"
                >
                  {s.replace('_', ' ')}
                </button>
              ))}
            </div>
            <label className="text-xs font-medium text-slate-700 block">
              Interest
              <select
                value={selected.interest_level || ''}
                onChange={(e) => void patch(selected.id, { interest_level: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Select</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
            <label className="text-xs font-medium text-slate-700 block">
              Feedback
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={4}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <button
              type="button"
              onClick={() => void patch(selected.id, { feedback })}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold"
            >
              Save feedback
            </button>
            <button
              type="button"
              onClick={() => void createDeal()}
              className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white"
            >
              Create Deal
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

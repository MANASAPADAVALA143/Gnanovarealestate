'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiFetch } from '@/lib/api-fetch'
import { formatAed } from '@/lib/pipeline'

type SuiteStatus = 'Available' | 'Booked' | 'Blocked' | 'Sold'

type Suite = {
  id: string
  suite_number: string
  floor: number
  size_sqft: number
  status: SuiteStatus | string
  price: number
  customer_name: string | null
  payment_received: number
  balance_amount: number
  notes: string | null
}

const STATUS_FILTERS: Array<SuiteStatus | 'All'> = ['All', 'Available', 'Booked', 'Blocked', 'Sold']

function statusClass(status: string) {
  if (status === 'Available') return 'bg-green-100 text-green-800'
  if (status === 'Booked') return 'bg-blue-100 text-blue-800'
  if (status === 'Blocked') return 'bg-yellow-100 text-yellow-900'
  return 'bg-slate-200 text-slate-700'
}

export default function SuitesPage() {
  const [suites, setSuites] = useState<Suite[]>([])
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<SuiteStatus | 'All'>('All')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    suite_number: '',
    floor: '',
    size_sqft: '',
    price: '',
    notes: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (q.trim()) params.set('q', q.trim())
      if (status !== 'All') params.set('status', status)
      const res = await apiFetch(`/api/suites?${params}`)
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Failed to load suites')
      setSuites((j.suites as Suite[]) || [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [q, status])

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 200)
    return () => window.clearTimeout(t)
  }, [load])

  const kpis = useMemo(
    () => ({
      total: suites.length,
      available: suites.filter((s) => s.status === 'Available').length,
      booked: suites.filter((s) => s.status === 'Booked').length,
      sold: suites.filter((s) => s.status === 'Sold').length,
    }),
    [suites]
  )

  async function addSuite(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await apiFetch('/api/suites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suite_number: form.suite_number,
          floor: Number(form.floor),
          size_sqft: Number(form.size_sqft),
          price: Number(form.price),
          notes: form.notes || null,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Failed to add suite')
      setShowAdd(false)
      setForm({ suite_number: '', floor: '', size_sqft: '', price: '', notes: '' })
      void load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add suite')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Suites</h1>
          <p className="text-sm text-slate-500 mt-1">Unit inventory, booking, and collections</p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
        >
          Add Suite
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-2xl font-bold text-slate-900">{kpis.total}</div>
          <div className="text-xs text-slate-500 mt-1">Total Suites</div>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50 p-4">
          <div className="text-2xl font-bold text-green-800">{kpis.available}</div>
          <div className="text-xs text-green-800 mt-1">Available</div>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="text-2xl font-bold text-blue-800">{kpis.booked}</div>
          <div className="text-xs text-blue-800 mt-1">Booked</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-100 p-4">
          <div className="text-2xl font-bold text-slate-800">{kpis.sold}</div>
          <div className="text-xs text-slate-700 mt-1">Sold</div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search suite or customer…"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                status === s ? 'bg-blue-600 text-white' : 'border border-slate-300 text-slate-700'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-slate-400 py-10 text-center">Loading suites…</p>
      ) : suites.length === 0 ? (
        <p className="text-sm text-slate-400 py-10 text-center">No suites yet</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {suites.map((s) => (
            <article key={s.id} className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-xl font-bold text-slate-900">{s.suite_number}</h2>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusClass(String(s.status))}`}>
                  {s.status}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Floor {s.floor} · {Number(s.size_sqft).toLocaleString()} sqft
              </p>
              <p className="text-sm font-semibold text-slate-800">{formatAed(Number(s.price))}</p>
              <p className="text-xs text-slate-600">{s.customer_name || '—'}</p>
              <p className="text-xs text-slate-500">
                {formatAed(Number(s.payment_received))} received · {formatAed(Number(s.balance_amount))} balance
              </p>
              <Link
                href={`/dashboard/suites/${s.id}`}
                className="inline-flex rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                View Details
              </Link>
            </article>
          ))}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={addSuite} className="w-full max-w-md rounded-xl bg-white p-6 space-y-3">
            <h2 className="text-base font-semibold text-slate-900">Add Suite</h2>
            <input
              required
              placeholder="Suite number"
              value={form.suite_number}
              onChange={(e) => setForm((f) => ({ ...f, suite_number: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              required
              type="number"
              placeholder="Floor"
              value={form.floor}
              onChange={(e) => setForm((f) => ({ ...f, floor: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              required
              type="number"
              placeholder="Size (sqft)"
              value={form.size_sqft}
              onChange={(e) => setForm((f) => ({ ...f, size_sqft: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              required
              type="number"
              placeholder="Price (AED)"
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <textarea
              placeholder="Notes"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              rows={3}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="flex-1 rounded-lg border border-slate-300 py-2 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-lg bg-blue-600 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

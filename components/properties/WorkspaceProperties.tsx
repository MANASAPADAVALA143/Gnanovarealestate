'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api-fetch'
import { formatMoney, type WorkspaceConfig } from '@/lib/workspaces'

type WorkspaceProperty = {
  id: string
  title: string | null
  address: string | null
  city: string | null
  zip_code: string | null
  price: number | null
  property_type: string | null
  description: string | null
  monthly_rental: number | null
  total_units: number | null
  available_units: number | null
  yearly_appreciation_pct: number | null
  security_note: string | null
}

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  commercial_coworking: 'Commercial Co-working',
}

export default function WorkspaceProperties({ workspace }: { workspace: WorkspaceConfig }) {
  const [properties, setProperties] = useState<WorkspaceProperty[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await apiFetch('/api/properties?limit=50')
        const j = (await res.json().catch(() => ({}))) as { error?: string; properties?: WorkspaceProperty[] }
        if (!res.ok) throw new Error(j.error || 'Failed to load properties')
        if (!cancelled) setProperties(j.properties || [])
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load properties')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const money = (n: number | null) => formatMoney(n, workspace.currency)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Properties</h1>
        <p className="text-sm text-slate-500 mt-1">{workspace.name} inventory</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{error}</div>
      )}
      {loading ? (
        <p className="py-12 text-center text-sm text-slate-400">Loading properties…</p>
      ) : properties.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-400">No properties in this workspace yet</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {properties.map((p) => {
            const yieldPct =
              p.price && p.monthly_rental ? ((p.monthly_rental * 12) / p.price) * 100 : null
            const stats: [string, string][] = [
              ['Price per unit', money(p.price)],
              ['Monthly rental', money(p.monthly_rental)],
              ['Rental yield', yieldPct != null ? `${yieldPct.toFixed(1)}% p.a.` : '—'],
              ['Yearly appreciation', p.yearly_appreciation_pct != null ? `${p.yearly_appreciation_pct}%` : '—'],
              [
                'Units available',
                p.total_units != null ? `${p.available_units ?? '—'} / ${p.total_units}` : '—',
              ],
              ['Security', p.security_note || '—'],
            ]
            return (
              <article key={p.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{p.title || p.address || 'Property'}</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    {PROPERTY_TYPE_LABELS[p.property_type || ''] || p.property_type || ''}
                    {' · '}
                    {[p.address, p.city, p.zip_code].filter(Boolean).join(', ')}
                  </p>
                </div>
                <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  {stats.map(([label, value]) => (
                    <div key={label} className="rounded-lg bg-slate-50 p-3">
                      <dt className="text-xs text-slate-500">{label}</dt>
                      <dd className="mt-1 font-semibold text-slate-800">{value}</dd>
                    </div>
                  ))}
                </dl>
                {p.description && <p className="text-xs text-slate-600">{p.description}</p>}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

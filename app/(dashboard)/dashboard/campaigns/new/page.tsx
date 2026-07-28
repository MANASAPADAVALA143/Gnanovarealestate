'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../../../../../lib/api-fetch'

type ScoreFilter = 'all' | 'unscored' | 'hot' | 'warm' | 'cold'

type Filters = {
  location: string
  scoreFilter: ScoreFilter
  maxContacts: number
}

export default function NewCampaignPage() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [name, setName] = useState('')
  const [locations, setLocations] = useState<string[]>([])
  const [filters, setFilters] = useState<Filters>({
    location: '',
    scoreFilter: 'all',
    maxContacts: 500,
  })
  const [matchCount, setMatchCount] = useState<number | null>(null)
  const [previewRows, setPreviewRows] = useState<
    {
      id: string
      name: string
      phone: string
      location: string | null
      lead_score: number | null
      score_label: string | null
    }[]
  >([])
  const [loadingCount, setLoadingCount] = useState(false)
  const [launching, setLaunching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    apiFetch('/api/campaigns/filter-options')
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled && j.locations) setLocations(j.locations as string[])
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const refreshPreview = useCallback(async () => {
    setLoadingCount(true)
    setError(null)
    try {
      const res = await apiFetch('/api/campaigns/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filters),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Preview failed')
      setMatchCount(j.count as number)
      setPreviewRows(j.leads || [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Preview failed')
      setMatchCount(null)
    } finally {
      setLoadingCount(false)
    }
  }, [filters])

  useEffect(() => {
    const t = setTimeout(() => {
      void refreshPreview()
    }, 400)
    return () => clearTimeout(t)
  }, [filters, refreshPreview])

  const goReview = () => {
    setError(null)
    if (!name.trim()) {
      setError('Please enter a campaign name.')
      return
    }
    setStep(2)
    void refreshPreview()
  }

  const launch = async () => {
    setStep(3)
    setLaunching(true)
    setError(null)
    try {
      const res = await apiFetch('/api/campaigns/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          filters,
          leadIds: [],
        }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Launch failed')
      if (j.warning) {
        console.warn(j.warning)
      }
      router.push(`/dashboard/campaigns/${j.campaignId}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Launch failed')
      setStep(2)
    } finally {
      setLaunching(false)
    }
  }

  const maxWarn = filters.maxContacts > 5000

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">New Campaign</h1>
          <p className="text-sm text-slate-600">
            Step {step} of 3 — name your campaign, filter contacts, review, then launch the first
            AI call.
          </p>
        </div>
        <Link
          href="/dashboard/campaigns"
          className="inline-flex items-center rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
        >
          Cancel
        </Link>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          {error}
        </div>
      )}

      {step === 1 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <p className="text-sm font-semibold text-slate-900">Step 1 — Name &amp; filter</p>
          <label className="block text-xs font-medium text-slate-700">
            Campaign name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. April Plot Drive"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
          </label>
          <label className="block text-xs font-medium text-slate-700">
            Location / area
            <select
              value={filters.location}
              onChange={(e) => setFilters((f) => ({ ...f, location: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 bg-white"
            >
              <option value="">All locations</option>
              {locations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-slate-700">
            Score label
            <select
              value={filters.scoreFilter}
              onChange={(e) =>
                setFilters((f) => ({ ...f, scoreFilter: e.target.value as ScoreFilter }))
              }
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 bg-white"
            >
              <option value="all">All</option>
              <option value="unscored">Unscored only</option>
              <option value="hot">Hot (score ≥ 80)</option>
              <option value="warm">Warm (50–79)</option>
              <option value="cold">Cold (&lt; 50)</option>
            </select>
          </label>
          <label className="block text-xs font-medium text-slate-700">
            Max contacts
            <input
              type="number"
              min={1}
              max={100000}
              value={filters.maxContacts}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  maxContacts: Math.min(100_000, Math.max(1, Number(e.target.value) || 1)),
                }))
              }
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
          </label>
          {maxWarn && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              You set more than 5,000 contacts. Imports this large can take a long time to dial;
              consider splitting into multiple campaigns.
            </p>
          )}
          <p className="text-sm text-slate-700">
            {loadingCount ? (
              <span className="text-slate-500">Counting matches…</span>
            ) : matchCount != null ? (
              <>
                <span className="font-semibold text-slate-900">{matchCount.toLocaleString()}</span>{' '}
                contacts match this filter
              </>
            ) : (
              <span className="text-slate-500">Adjust filters to see count.</span>
            )}
          </p>
          <button
            type="button"
            onClick={goReview}
            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition"
          >
            Next: Review Contacts
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <p className="text-sm font-semibold text-slate-900">Step 2 — Review</p>
          <p className="text-xs text-slate-600">
            Total in campaign (capped by max contacts):{' '}
            <span className="font-semibold text-slate-900">
              {matchCount != null ? matchCount.toLocaleString() : '—'}
            </span>
          </p>
          {(matchCount ?? 0) > 10_000 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
              Large campaign. Calls will be queued and run over multiple hours.
            </div>
          )}
          <div className="overflow-x-auto rounded-lg border border-slate-100">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600">
                  <th className="px-3 py-2 text-left font-medium">Name</th>
                  <th className="px-3 py-2 text-left font-medium">Phone</th>
                  <th className="px-3 py-2 text-left font-medium">Location</th>
                  <th className="px-3 py-2 text-left font-medium">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previewRows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2 text-slate-800">{r.name}</td>
                    <td className="px-3 py-2 text-slate-700">{r.phone}</td>
                    <td className="px-3 py-2 text-slate-600">{r.location || '—'}</td>
                    <td className="px-3 py-2 text-slate-700">
                      {r.lead_score != null ? r.lead_score : 'Not scored'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="inline-flex items-center rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => void launch()}
              disabled={launching || !name.trim() || (matchCount ?? 0) === 0}
              className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition disabled:opacity-50"
            >
              Launch Campaign
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm text-center space-y-3">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <p className="text-sm font-semibold text-slate-900">Creating campaign…</p>
          <p className="text-xs text-slate-500">Starting the first outbound call via VAPI.</p>
        </div>
      )}
    </div>
  )
}

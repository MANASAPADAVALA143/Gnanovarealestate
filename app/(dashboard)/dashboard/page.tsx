'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import PropertyCard from '../../../components/properties/PropertyCard'
import { apiFetch } from '../../../lib/api-fetch'
import type { Property } from '../../../types/property'

type AnalyticsStatsResponse = {
  today: {
    calls: number
    hotLeads: number
    appointmentsBooked: number
    avgLeadScore: number
  }
  thisWeek: {
    calls: number
    hotLeads: number
    appointmentsBooked: number
    conversionRate: number
  }
  topProperties: (Property & { inquiryCount?: number })[]
  recentActivity: {
    type: 'call' | 'booking' | 'search'
    timestamp: string
    description: string
    metadata?: Record<string, unknown>
  }[]
}

type SearchApiResponse = {
  success: boolean
  properties: Property[]
  query: string
  resultsCount: number
}

type PropertySearchStats = {
  totalProperties: number
  mostCommonLocation: string | null
  averagePrice: number | null
  latestProperty: Property | null
}

const EMPTY_ANALYTICS: AnalyticsStatsResponse = {
  today: { calls: 0, hotLeads: 0, appointmentsBooked: 0, avgLeadScore: 0 },
  thisWeek: { calls: 0, hotLeads: 0, appointmentsBooked: 0, conversionRate: 0 },
  topProperties: [],
  recentActivity: [],
}

export default function DashboardPage() {
  const router = useRouter()

  const [analytics, setAnalytics] = useState<AnalyticsStatsResponse | null>(null)
  const [searchStats, setSearchStats] = useState<PropertySearchStats | null>(null)
  const [hotReadyCount, setHotReadyCount] = useState<number | null>(null)
  const [speedAvgSeconds, setSpeedAvgSeconds] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const fetchData = async () => {
      setLoading(true)
      setError(null)

      try {
        const [analyticsRes, searchRes, scoredRes, speedRes] = await Promise.all([
          apiFetch('/api/analytics/stats'),
          apiFetch('/api/properties/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: 'property search' }),
          }),
          apiFetch('/api/leads/scored?minScore=0&maxScore=100&limit=1'),
          apiFetch('/api/speed-to-lead/stats'),
        ])

        const analyticsRaw = (await analyticsRes.json().catch(() => null)) as
          | (AnalyticsStatsResponse & { error?: string })
          | null

        const analyticsJson: AnalyticsStatsResponse = analyticsRaw
          ? {
              today: { ...EMPTY_ANALYTICS.today, ...analyticsRaw.today },
              thisWeek: { ...EMPTY_ANALYTICS.thisWeek, ...analyticsRaw.thisWeek },
              topProperties: Array.isArray(analyticsRaw.topProperties)
                ? analyticsRaw.topProperties
                : [],
              recentActivity: Array.isArray(analyticsRaw.recentActivity)
                ? analyticsRaw.recentActivity
                : [],
            }
          : EMPTY_ANALYTICS

        if (!analyticsRes.ok && analyticsRaw?.error) {
          if (!cancelled) {
            setError(String(analyticsRaw.error))
          }
        }

        let searchJson: SearchApiResponse | null = null
        if (searchRes.ok) {
          searchJson = (await searchRes.json()) as SearchApiResponse
        }

        if (!cancelled) {
          setAnalytics(analyticsJson)

          if (scoredRes.ok) {
            const scoredJson = (await scoredRes.json().catch(() => ({}))) as {
              stats?: { hotReadyCount?: number }
            }
            if (typeof scoredJson.stats?.hotReadyCount === 'number') {
              setHotReadyCount(scoredJson.stats.hotReadyCount)
            } else {
              setHotReadyCount(0)
            }
          } else {
            setHotReadyCount(0)
          }

          if (speedRes.ok) {
            const speedJson = (await speedRes.json().catch(() => ({}))) as {
              avgResponseSeconds?: number | null
            }
            if (typeof speedJson.avgResponseSeconds === 'number') {
              setSpeedAvgSeconds(speedJson.avgResponseSeconds)
            } else {
              setSpeedAvgSeconds(null)
            }
          } else {
            setSpeedAvgSeconds(null)
          }

          if (searchJson && searchJson.success) {
            const properties = searchJson.properties || []
            const totalProperties = searchJson.resultsCount || properties.length

            const prices = properties
              .map((p) => p.price)
              .filter((p): p is number => typeof p === 'number')

            const averagePrice =
              prices.length > 0
                ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
                : null

            // Most common city among returned properties
            const cityCounts = new Map<string, number>()
            properties.forEach((p) => {
              if (p.city) {
                const key = p.city
                cityCounts.set(key, (cityCounts.get(key) ?? 0) + 1)
              }
            })
            let mostCommonLocation: string | null = null
            let maxCount = 0
            cityCounts.forEach((count, city) => {
              if (count > maxCount) {
                maxCount = count
                mostCommonLocation = city
              }
            })

            // Latest property by listed_date or updated_date
            let latestProperty: Property | null = null
            properties.forEach((p) => {
              const dateStr = p.listed_date || p.updated_date
              if (!dateStr) return
              const date = new Date(dateStr)
              if (!latestProperty) {
                latestProperty = p
                return
              }
              const latestDate = new Date(latestProperty.listed_date || latestProperty.updated_date)
              if (date > latestDate) {
                latestProperty = p
              }
            })

            setSearchStats({
              totalProperties,
              mostCommonLocation,
              averagePrice,
              latestProperty,
            })
          }
        }
      } catch (err: unknown) {
        console.error('Error loading dashboard data:', err)
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load dashboard data')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchData()

    return () => {
      cancelled = true
    }
  }, [])

  const handleGoToSearch = () => {
    router.push('/dashboard/properties')
  }

  const handleAddProperty = () => {
    router.push('/dashboard/properties/new')
  }

  const hotProperties = analytics?.topProperties ?? []

  const recentSearches =
    analytics?.recentActivity?.filter((a) => a.type === 'search') ?? []

  return (
    <div className="space-y-6">
      {/* Header + Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-600">
            Overview of your AI calls, leads, and property search activity.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleGoToSearch}
            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition"
          >
            Search Properties
          </button>
          <button
            type="button"
            onClick={handleAddProperty}
            className="inline-flex items-center rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Add New Property
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Property Search Stats + Today/Week cards could be here later; for now we show property stats */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Hot leads ready (Next dashboard) */}
        <div className="col-span-1 rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col">
          <p className="text-sm font-semibold text-slate-900 mb-2">🔥 Hot Leads Ready</p>
          {loading && hotReadyCount === null ? (
            <p className="text-xs text-slate-500">Loading…</p>
          ) : (
            <>
              <p className="text-2xl font-bold text-slate-900">
                {hotReadyCount ?? '—'}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Score ≥ 80, not yet marked called manually.
              </p>
              <Link
                href="/dashboard/leads/scored"
                className="mt-auto inline-flex items-center justify-center rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition"
              >
                Open list
              </Link>
            </>
          )}
        </div>

        {/* Property Search Stats card */}
        <div className="col-span-1 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-900 mb-2">
            Property Search Insights
          </p>
          {loading && !searchStats ? (
            <p className="text-xs text-slate-500">Loading property stats...</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 text-xs text-slate-600">
              <div>
                <p className="font-semibold text-slate-800">Total properties</p>
                <p>{searchStats?.totalProperties ?? '—'}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-800">Most searched location</p>
                <p>{searchStats?.mostCommonLocation ?? '—'}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-800">Average price</p>
                <p>
                  {searchStats?.averagePrice
                    ? `$${searchStats.averagePrice.toLocaleString()}`
                    : '—'}
                </p>
              </div>
              <div>
                <p className="font-semibold text-slate-800">Latest property added</p>
                <p className="truncate">
                  {searchStats?.latestProperty?.address || '—'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Today stats */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-900 mb-2">Today</p>
          {loading && !analytics ? (
            <p className="text-xs text-slate-500">Loading...</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 text-xs text-slate-600">
              <div>
                <p className="font-semibold text-slate-800">Calls</p>
                <p>{analytics?.today?.calls ?? 0}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-800">Hot leads</p>
                <p>{analytics?.today?.hotLeads ?? 0}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-800">Appointments</p>
                <p>{analytics?.today?.appointmentsBooked ?? 0}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-800">Avg lead score</p>
                <p>{analytics?.today?.avgLeadScore ?? 0}</p>
              </div>
            </div>
          )}
        </div>

        {/* This week stats */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-900 mb-2">This week</p>
          {loading && !analytics ? (
            <p className="text-xs text-slate-500">Loading...</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 text-xs text-slate-600">
              <div>
                <p className="font-semibold text-slate-800">Calls</p>
                <p>{analytics?.thisWeek?.calls ?? 0}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-800">Hot leads</p>
                <p>{analytics?.thisWeek?.hotLeads ?? 0}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-800">Appointments</p>
                <p>{analytics?.thisWeek?.appointmentsBooked ?? 0}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-800">Conversion rate</p>
                <p>
                  {(analytics?.thisWeek?.conversionRate ?? 0) * 100}%
                </p>
              </div>
            </div>
          )}
        </div>

        <Link
          href="/dashboard/speed-to-lead"
          className="col-span-1 rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col hover:border-blue-200 transition"
        >
          <p className="text-sm font-semibold text-slate-900 mb-2">⚡ Avg Response Time</p>
          {loading ? (
            <p className="text-xs text-slate-500">Loading…</p>
          ) : speedAvgSeconds === null ? (
            <p className="text-2xl font-bold text-slate-400">—</p>
          ) : (
            <p
              className={`text-2xl font-bold ${
                speedAvgSeconds <= 60 ? 'text-emerald-700' : 'text-red-600'
              }`}
            >
              {speedAvgSeconds}s
            </p>
          )}
          <p className="text-[11px] text-slate-500 mt-1">
            Today&apos;s portal speed-to-lead (intake → dial). Target ≤ 60s.
          </p>
          <span className="mt-auto text-[11px] font-semibold text-blue-600 pt-2">Open dashboard →</span>
        </Link>
      </div>

      {/* Hot properties carousel + Recent searches */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hot Properties carousel */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-slate-900">
              Hot properties this week
            </p>
            <p className="text-[11px] text-slate-500">
              Top {hotProperties.length || 0} most viewed / recommended
            </p>
          </div>
          {loading && !analytics ? (
            <p className="text-xs text-slate-500">Loading hot properties...</p>
          ) : hotProperties.length === 0 ? (
            <p className="text-xs text-slate-500">
              Not enough activity yet. Once your AI assistant starts recommending
              properties, they’ll appear here.
            </p>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-2">
              {hotProperties.slice(0, 5).map((p) => (
                <div
                  key={p.id}
                  className="min-w-[260px] max-w-xs flex-shrink-0"
                >
                  <PropertyCard
                    property={p}
                    onViewDetails={() => router.push(`/dashboard/properties?propertyId=${p.id}`)}
                    onBookViewing={() =>
                      router.push(`/dashboard/properties?book=${p.id}`)
                    }
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Searches table */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-900 mb-2">Recent searches</p>
          {loading && !analytics ? (
            <p className="text-xs text-slate-500">Loading recent searches...</p>
          ) : recentSearches.length === 0 ? (
            <p className="text-xs text-slate-500">
              No recorded property searches yet. Once leads start searching, they’ll
              show up here.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500">
                    <th className="px-3 py-2 text-left font-medium">Time</th>
                    <th className="px-3 py-2 text-left font-medium">Lead</th>
                    <th className="px-3 py-2 text-left font-medium">Query</th>
                    <th className="px-3 py-2 text-left font-medium">Results</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentSearches.slice(0, 10).map((activity, idx) => {
                    const meta = activity.metadata ?? {}
                    const leadName =
                      typeof meta.leadName === 'string' ? meta.leadName : 'Unknown'
                    const query =
                      typeof meta.query === 'string' ? meta.query : activity.description
                    const results =
                      typeof meta.resultsCount === 'number' ? meta.resultsCount : '—'
                    return (
                      <tr
                        key={idx}
                        className="hover:bg-slate-50 cursor-pointer"
                        onClick={() => {
                          if (typeof meta.query === 'string' && meta.query) {
                            router.push(
                              `/dashboard/properties?query=${encodeURIComponent(meta.query)}`
                            )
                          }
                        }}
                      >
                        <td className="px-3 py-2 text-slate-600" suppressHydrationWarning>
                          {new Date(activity.timestamp).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-slate-700">{leadName}</td>
                        <td className="px-3 py-2 text-slate-700 truncate max-w-[180px]">
                          {query}
                        </td>
                        <td className="px-3 py-2 text-slate-600">{results}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


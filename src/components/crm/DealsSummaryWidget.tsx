import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, TrendingUp, Trophy, XCircle } from 'lucide-react'
import { fetchDealsSummary, formatAed, type DealsSummary } from '../../lib/deals'

export default function DealsSummaryWidget() {
  const [summary, setSummary] = useState<DealsSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchDealsSummary()
        setSummary(data)
      } catch (e) {
        console.error('Deals summary fetch failed:', e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="p-6 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-semibold text-slate-900">Deal Closure — This Month</h2>
        </div>
        <Link to="/dashboard/deals" className="text-sm text-emerald-600 hover:text-emerald-700">
          View deals →
        </Link>
      </div>
      <div className="p-6">
        {loading ? (
          <div className="flex items-center text-slate-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            Loading…
          </div>
        ) : !summary ? (
          <p className="text-sm text-slate-500">Could not load deal summary.</p>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4">
                <p className="text-xs font-medium text-emerald-800 uppercase tracking-wide">
                  Monthly Sales
                </p>
                <p className="text-2xl font-bold text-emerald-900 mt-1">
                  {formatAed(summary.total_sales)}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-600 uppercase tracking-wide">
                  <Trophy className="w-3.5 h-3.5 text-emerald-600" />
                  Won
                </div>
                <p className="text-2xl font-bold text-slate-900 mt-1">{summary.deals_won}</p>
              </div>
              <div className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-600 uppercase tracking-wide">
                  <XCircle className="w-3.5 h-3.5 text-red-500" />
                  Lost
                </div>
                <p className="text-2xl font-bold text-slate-900 mt-1">{summary.deals_lost}</p>
              </div>
            </div>

            {summary.top_agents.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-slate-800 mb-2">Top agents by sale value</p>
                <ul className="space-y-2">
                  {summary.top_agents.map((row, i) => (
                    <li
                      key={row.agent_id}
                      className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50 border border-slate-100"
                    >
                      <span className="text-sm text-slate-800">
                        {i + 1}. {row.full_name || row.agent_id.slice(0, 8)}
                      </span>
                      <span className="text-sm font-semibold text-emerald-700">
                        {formatAed(row.sale_value)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

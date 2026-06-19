import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Banknote, Loader2 } from 'lucide-react'
import { fetchCommissionsSummary, formatAed, type CommissionsSummary } from '../../lib/commissions'

export default function CommissionSummaryWidget() {
  const [summary, setSummary] = useState<CommissionsSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchCommissionsSummary()
        setSummary(data)
      } catch (e) {
        console.error('Commission summary fetch failed:', e)
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
          <Banknote className="w-5 h-5 text-violet-600" />
          <h2 className="text-lg font-semibold text-slate-900">Commission Summary</h2>
        </div>
        <Link to="/dashboard/commissions" className="text-sm text-violet-600 hover:text-violet-700">
          View all →
        </Link>
      </div>
      <div className="p-6">
        {loading ? (
          <div className="flex items-center text-slate-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            Loading…
          </div>
        ) : !summary ? (
          <p className="text-sm text-slate-500">Could not load commission summary.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Pending</p>
              <p className="text-xl font-bold text-slate-900 mt-1">
                {formatAed(summary.this_month.total_pending)}
              </p>
              <p className="text-xs text-slate-400 mt-1">This month</p>
            </div>
            <div className="rounded-lg border border-amber-100 bg-amber-50 p-4">
              <p className="text-xs font-medium text-amber-800 uppercase tracking-wide">Approved</p>
              <p className="text-xl font-bold text-amber-900 mt-1">
                {formatAed(summary.this_month.total_approved)}
              </p>
              <p className="text-xs text-amber-700/70 mt-1">This month</p>
            </div>
            <div className="rounded-lg border border-green-100 bg-green-50 p-4">
              <p className="text-xs font-medium text-green-800 uppercase tracking-wide">Paid</p>
              <p className="text-xl font-bold text-green-900 mt-1">
                {formatAed(summary.this_month.total_paid)}
              </p>
              <p className="text-xs text-green-700/70 mt-1">This month</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

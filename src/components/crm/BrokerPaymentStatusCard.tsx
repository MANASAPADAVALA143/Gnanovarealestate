import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import {
  fetchBrokerPaymentStatus,
  formatAed,
  type BrokerPaymentStatus,
} from '../../lib/broker-invoices'
import { CreditCard, Loader2 } from 'lucide-react'

/** Broker (agent) dashboard card — full payment vs EMI outstanding. */
export default function BrokerPaymentStatusCard() {
  const { agent } = useAuth()
  const [data, setData] = useState<BrokerPaymentStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!agent?.id) {
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const status = await fetchBrokerPaymentStatus(agent.id)
        if (!cancelled) setData(status)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Could not load payment status')
          setData(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [agent?.id])

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-slate-600" />
            Payment Status
          </h3>
          <p className="text-xs text-slate-500 mt-1">Broker commission invoices</p>
        </div>
        <Link
          to="/dashboard/broker-invoices"
          className="text-xs font-medium text-slate-600 hover:text-slate-900 underline-offset-2 hover:underline"
        >
          View all
        </Link>
      </div>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : error ? (
        <p className="mt-4 text-sm text-slate-500">
          {/relation|does not exist|42P01/i.test(error)
            ? 'Run migration 028_broker_invoices.sql in Supabase to enable invoices.'
            : error}
        </p>
      ) : !data || (data.open_count === 0 && data.paid_count === 0) ? (
        <p className="mt-4 text-sm text-slate-500">No invoices yet. Approve a commission to generate one.</p>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Plan</span>
            <span className="text-sm font-semibold text-slate-900">
              {data.payment_mode === 'emi' ? 'EMI plan' : 'Full payment'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Outstanding</span>
            <span className="text-sm font-semibold text-slate-900">
              {formatAed(data.total_outstanding)}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{data.open_count} open</span>
            <span>{data.paid_count} paid</span>
          </div>
        </div>
      )}
    </div>
  )
}

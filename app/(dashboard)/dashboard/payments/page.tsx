'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../../../../lib/api-fetch'
import { formatAed } from '../../../../lib/pipeline'

type Payment = {
  id: string
  customer_name: string
  customer_phone: string | null
  suite_id: string | null
  suite_number: string | null
  installment_number: number
  installment_amount: number
  due_date: string
  paid_date: string | null
  payment_method: string | null
  utr_number: string | null
  status: string
}

function statusClass(status: string) {
  if (status === 'Paid') return 'bg-green-100 text-green-800'
  if (status === 'Overdue') return 'bg-red-100 text-red-800'
  return 'bg-yellow-100 text-yellow-900'
}

function isOverdueRow(p: Payment) {
  if (p.status === 'Overdue') return true
  if (p.status !== 'Pending') return false
  const due = new Date(p.due_date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return due < today
}

export default function CollectionsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [tab, setTab] = useState('All')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = tab === 'All' ? '' : `?status=${tab}`
      const res = await apiFetch(`/api/payments${params}`)
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Failed to load payments')
      setPayments((j.payments as Payment[]) || [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => {
    void load()
  }, [load])

  const kpis = useMemo(() => {
    const totalDue = payments.reduce((s, p) => s + Number(p.installment_amount || 0), 0)
    const collected = payments
      .filter((p) => p.status === 'Paid')
      .reduce((s, p) => s + Number(p.installment_amount || 0), 0)
    const pendingRows = payments.filter((p) => p.status === 'Pending')
    const overdueRows = payments.filter((p) => p.status === 'Overdue' || isOverdueRow(p))
    return {
      totalDue,
      collected,
      pendingCount: pendingRows.length,
      pendingSum: pendingRows.reduce((s, p) => s + Number(p.installment_amount || 0), 0),
      overdueCount: overdueRows.length,
      overdueSum: overdueRows.reduce((s, p) => s + Number(p.installment_amount || 0), 0),
    }
  }, [payments])

  async function markPaid(id: string) {
    const res = await apiFetch(`/api/payments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Paid' }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(j.error || 'Could not mark paid')
      return
    }
    void load()
  }

  async function remind(p: Payment) {
    if (!p.customer_phone) {
      setError('No phone on this payment')
      return
    }
    const message = `Hi ${p.customer_name}! Your payment of ${formatAed(Number(p.installment_amount))} for Suite ${p.suite_number || ''} (Installment ${p.installment_number}) is due on ${p.due_date}. Please arrange the payment. Thank you! — Gnanova Pro`
    const res = await apiFetch('/api/whatsapp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: p.customer_phone, message }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(j.error || 'Reminder failed')
      return
    }
    setError(null)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Collections</h1>
        <p className="text-sm text-slate-500 mt-1">Installments due, paid, and overdue</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-lg font-bold">{formatAed(kpis.totalDue)}</div>
          <div className="text-xs text-slate-500 mt-1">Total Due</div>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50 p-4">
          <div className="text-lg font-bold text-green-800">{formatAed(kpis.collected)}</div>
          <div className="text-xs text-green-800 mt-1">Collected</div>
        </div>
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
          <div className="text-lg font-bold text-yellow-900">
            {kpis.pendingCount} · {formatAed(kpis.pendingSum)}
          </div>
          <div className="text-xs text-yellow-900 mt-1">Pending</div>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="text-lg font-bold text-red-800">
            {kpis.overdueCount} · {formatAed(kpis.overdueSum)}
          </div>
          <div className="text-xs text-red-800 mt-1">Overdue</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {['All', 'Pending', 'Paid', 'Overdue'].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setTab(s)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              tab === s ? 'bg-blue-600 text-white' : 'border border-slate-300 text-slate-700'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-slate-400 py-10 text-center">Loading payments…</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Suite</th>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3">Paid</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">UTR</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                    No payments
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className={isOverdueRow(p) ? 'bg-red-50' : ''}>
                    <td className="px-4 py-3 font-medium">{p.customer_name}</td>
                    <td className="px-4 py-3">
                      {p.suite_id ? (
                        <Link href={`/dashboard/suites/${p.suite_id}`} className="text-blue-700 hover:underline">
                          {p.suite_number || 'Suite'}
                        </Link>
                      ) : (
                        p.suite_number || '—'
                      )}
                    </td>
                    <td className="px-4 py-3">{p.installment_number}</td>
                    <td className="px-4 py-3">{formatAed(Number(p.installment_amount))}</td>
                    <td className="px-4 py-3 text-xs">{p.due_date}</td>
                    <td className="px-4 py-3 text-xs">
                      {p.paid_date ? new Date(p.paid_date).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs">{p.payment_method || '—'}</td>
                    <td className="px-4 py-3 text-xs">{p.utr_number || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(p.status)}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 space-x-2">
                      {p.status !== 'Paid' && (
                        <button
                          type="button"
                          onClick={() => void markPaid(p.id)}
                          className="text-xs font-semibold text-blue-700 hover:underline"
                        >
                          Mark Paid
                        </button>
                      )}
                      {p.customer_phone && p.status !== 'Paid' && (
                        <button
                          type="button"
                          onClick={() => void remind(p)}
                          className="text-xs font-semibold text-slate-600 hover:underline"
                        >
                          Remind
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

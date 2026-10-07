'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api-fetch'
import { formatAed } from '@/lib/pipeline'

type Invoice = {
  id: string
  invoice_number: string
  amount: number
  status: string
  due_date: string | null
  pdf_url: string | null
  agents?: { full_name?: string | null } | null
  deals?: { project_name?: string | null; unit_number?: string | null; client_name?: string | null } | null
}

type Kpis = {
  totalSales: number
  gross: number
  agentComm: number
  brokerage: number
  pending: number
  paid: number
}

function embed<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? v[0] ?? null : v
}

const STATUS_CLASS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  sent: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-800',
  partial: 'bg-amber-100 text-amber-900',
}

export default function CommissionsPage() {
  const [status, setStatus] = useState('')
  const [kpis, setKpis] = useState<Kpis | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = status ? `?status=${status}` : ''
      const res = await apiFetch(`/api/commissions${params}`)
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Failed to load commissions')
      setKpis(j.kpis as Kpis)
      setInvoices((j.invoices as Invoice[]) || [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    void load()
  }, [load])

  async function markPaid(id: string) {
    const res = await apiFetch(`/api/commissions`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiceId: id, status: 'paid' }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(j.error || 'Could not mark paid')
      return
    }
    void load()
  }

  const cards = kpis
    ? [
        ['Total Sales Value', kpis.totalSales],
        ['Gross Commission', kpis.gross],
        ['Agent Commission', kpis.agentComm],
        ['Brokerage Commission', kpis.brokerage],
        ['Pending Payout', kpis.pending],
        ['Paid Out', kpis.paid],
      ]
    : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Commission</h1>
        <p className="text-sm text-slate-500 mt-1">From deals and broker_invoices</p>
      </div>
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{error}</div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-500">{label}</div>
            <div className="text-xl font-bold text-slate-900 mt-1">{formatAed(Number(value))}</div>
          </div>
        ))}
      </div>
      <label className="text-xs font-medium text-slate-700">
        Invoice status
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="ml-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        >
          <option value="">All</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
        </select>
      </label>
      {loading ? (
        <p className="text-sm text-slate-400 py-8 text-center">Loading…</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Agent</th>
                <th className="px-4 py-3">Deal</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    No invoices
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => {
                  const agent = embed(inv.agents)
                  const deal = embed(inv.deals)
                  return (
                    <tr key={inv.id}>
                      <td className="px-4 py-3">{agent?.full_name || 'You'}</td>
                      <td className="px-4 py-3">
                        {[deal?.project_name, deal?.unit_number, deal?.client_name].filter(Boolean).join(' · ') || '—'}
                      </td>
                      <td className="px-4 py-3">{formatAed(inv.amount)}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[inv.status] || ''}`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">{inv.due_date || '—'}</td>
                      <td className="px-4 py-3 space-x-2">
                        {inv.status !== 'paid' && (
                          <button
                            type="button"
                            onClick={() => void markPaid(inv.id)}
                            className="text-xs font-semibold text-blue-700 hover:underline"
                          >
                            Mark Paid
                          </button>
                        )}
                        {inv.pdf_url && (
                          <a href={inv.pdf_url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-slate-600 hover:underline">
                            PDF
                          </a>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

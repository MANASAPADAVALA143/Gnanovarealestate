import React, { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import {
  fetchBrokerInvoices,
  formatAed,
  invoiceDealLabel,
  INVOICE_STATUS_BADGE,
  INVOICE_STATUS_LABELS,
  INVOICE_STATUSES,
  markInvoicePaid,
  markInvoicePartialEmi,
  updateBrokerInvoice,
  type BrokerInvoice,
  type InvoiceStatus,
} from '../../lib/broker-invoices'
import { openBrokerInvoicePrintView } from '../../lib/broker-invoice-pdf'
import { FileText, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { Link } from 'react-router-dom'

type AgentPick = { id: string; full_name: string | null }

export default function BrokerInvoicesPage() {
  const { agent, loading: authLoading } = useAuth()
  const [rows, setRows] = useState<BrokerInvoice[]>([])
  const [agents, setAgents] = useState<AgentPick[]>([])
  const [loading, setLoading] = useState(true)
  const [isManager, setIsManager] = useState(false)
  const [filterBrokerId, setFilterBrokerId] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading || !agent) {
      setLoading(false)
      return
    }
    void load()
  }, [agent, authLoading, filterBrokerId, filterStatus])

  async function load() {
    setLoading(true)
    try {
      const { data: me } = await supabase
        .from('agents')
        .select('is_manager, is_owner')
        .eq('id', agent!.id)
        .maybeSingle()
      const manager =
        Boolean((me as { is_manager?: boolean; is_owner?: boolean } | null)?.is_manager) ||
        Boolean((me as { is_owner?: boolean } | null)?.is_owner)
      setIsManager(manager)

      if (manager) {
        const { data: dir } = await supabase
          .from('agents_directory')
          .select('id, full_name')
          .order('full_name')
        setAgents((dir as AgentPick[]) || [])
      }

      const invoices = await fetchBrokerInvoices({
        broker_id: filterBrokerId || (manager ? undefined : agent!.id),
        status: filterStatus !== 'all' ? (filterStatus as InvoiceStatus) : undefined,
      })
      setRows(invoices)
    } catch (e) {
      console.error(e)
      alert(e instanceof Error ? e.message : 'Failed to load invoices')
    } finally {
      setLoading(false)
    }
  }

  async function handleMarkPaid(row: BrokerInvoice) {
    if (!window.confirm(`Mark ${row.invoice_number} as fully paid?`)) return
    setBusyId(row.id)
    try {
      const updated = await markInvoicePaid(row.id)
      setRows((prev) => prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setBusyId(null)
    }
  }

  async function handlePartialEmi(row: BrokerInvoice) {
    const raw = window.prompt(
      `EMI / partial payment for ${row.invoice_number}\nInvoice total: ${formatAed(row.amount)}\nAlready paid: ${formatAed(row.amount_paid)}\n\nEnter new total amount paid:`,
      String(row.amount_paid || 0)
    )
    if (raw == null) return
    const amountPaid = Number(raw)
    if (!Number.isFinite(amountPaid) || amountPaid < 0) {
      alert('Invalid amount')
      return
    }
    if (amountPaid >= Number(row.amount)) {
      await handleMarkPaid(row)
      return
    }
    setBusyId(row.id)
    try {
      const updated = await markInvoicePartialEmi(row.id, amountPaid)
      setRows((prev) => prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setBusyId(null)
    }
  }

  async function handleMarkSent(row: BrokerInvoice) {
    setBusyId(row.id)
    try {
      const updated = await updateBrokerInvoice(row.id, { status: 'sent' })
      setRows((prev) => prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setBusyId(null)
    }
  }

  if (authLoading) {
    return <div className="flex items-center justify-center h-64 text-slate-600">Loading…</div>
  }

  if (!agent) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-950 max-w-lg">
        <h2 className="font-semibold text-lg">Sign in required</h2>
        <p className="mt-2 text-sm">Sign in with an agent account to view broker invoices.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Broker Invoices</h1>
          <p className="text-sm text-slate-500 mt-1">
            Invoices generated when a commission is approved (payable). Manual mark paid / EMI — no gateway yet.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {isManager && (
            <Link
              to="/dashboard/payment-run"
              className="text-sm font-medium text-blue-700 hover:text-blue-900"
            >
              Payment Run →
            </Link>
          )}
          <Link
            to="/dashboard/commissions"
            className="text-sm font-medium text-slate-700 hover:text-slate-900 underline-offset-2 hover:underline"
          >
            ← Commissions
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        {isManager && (
          <label className="text-sm text-slate-600">
            Broker
            <select
              className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={filterBrokerId}
              onChange={(e) => setFilterBrokerId(e.target.value)}
            >
              <option value="">All brokers</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.full_name || a.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="text-sm text-slate-600">
          Status
          <select
            className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All</option>
            {INVOICE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {INVOICE_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-500 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading invoices…
          </div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-500 px-4">
            No invoices yet. Approve a commission on the{' '}
            <Link to="/dashboard/commissions" className="underline">
              Commissions
            </Link>{' '}
            page to generate one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Invoice</th>
                  <th className="px-4 py-3">Broker</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Due date</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{row.invoice_number}</div>
                      <div className="text-xs text-slate-500 truncate max-w-[200px]">
                        {invoiceDealLabel(row) !== '—'
                          ? invoiceDealLabel(row)
                          : row.commission_id.slice(0, 8)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {row.agents?.full_name || row.broker_id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3">
                      <div>{formatAed(row.amount)}</div>
                      {(row.emi_plan || row.status === 'partial') && (
                        <div className="text-xs text-amber-800">
                          Paid {formatAed(row.amount_paid)} · EMI
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${INVOICE_STATUS_BADGE[row.status] || 'bg-slate-100'}`}
                      >
                        {INVOICE_STATUS_LABELS[row.status] || row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {row.due_date
                        ? format(new Date(row.due_date + 'T00:00:00'), 'dd MMM yyyy')
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openBrokerInvoicePrintView(row)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                        >
                          <FileText className="h-3.5 w-3.5" /> PDF
                        </button>
                        {row.status === 'draft' && (
                          <button
                            type="button"
                            disabled={busyId === row.id}
                            onClick={() => handleMarkSent(row)}
                            className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                          >
                            Mark sent
                          </button>
                        )}
                        {row.status !== 'paid' && (
                          <>
                            <button
                              type="button"
                              disabled={busyId === row.id}
                              onClick={() => handleMarkPaid(row)}
                              className="rounded-lg bg-slate-900 px-2 py-1 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                            >
                              Mark paid
                            </button>
                            <button
                              type="button"
                              disabled={busyId === row.id}
                              onClick={() => handlePartialEmi(row)}
                              className="rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-50"
                            >
                              EMI / partial
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

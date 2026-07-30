import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import {
  createPaymentRun,
  dealLabelFromInvoice,
  fetchOpenInvoicesForPaymentRun,
  fetchPaymentRun,
  fetchPaymentRuns,
  formatAed,
  paymentMethodLabel,
  PAYMENT_METHOD_OPTIONS,
  type OpenInvoiceForRun,
  type PaymentRunDetail,
  type PaymentRunListItem,
} from '../../lib/payment-runs'
import { ChevronDown, ChevronUp, CreditCard, Loader2, Printer } from 'lucide-react'
import { format } from 'date-fns'

export default function PaymentRunPage() {
  const { agent } = useAuth()
  const [invoices, setInvoices] = useState<OpenInvoiceForRun[]>([])
  const [runs, setRuns] = useState<PaymentRunListItem[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [lastRunId, setLastRunId] = useState<string | null>(null)

  const [runDate, setRunDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [method, setMethod] = useState('bank_transfer')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')

  const [summaryRun, setSummaryRun] = useState<PaymentRunDetail | null>(null)
  const printRef = useRef<HTMLDivElement>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 4000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [open, hist] = await Promise.all([
        fetchOpenInvoicesForPaymentRun(),
        fetchPaymentRuns(),
      ])
      setInvoices(open.invoices || [])
      setRuns(hist.runs || [])
      setSelected(new Set())
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : 'Failed to load payment run data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const selectedInvoices = useMemo(
    () => invoices.filter((i) => selected.has(i.id)),
    [invoices, selected]
  )

  const selectedTotal = useMemo(
    () =>
      Math.round(
        selectedInvoices.reduce((s, i) => s + (Number(i.outstanding_aed) || 0), 0) * 100
      ) / 100,
    [selectedInvoices]
  )

  function toggleAll(checked: boolean) {
    if (!checked) {
      setSelected(new Set())
      return
    }
    setSelected(new Set(invoices.map((i) => i.id)))
  }

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  async function handleRunPayment(ev: React.FormEvent) {
    ev.preventDefault()
    if (selectedInvoices.length === 0) return
    if (!reference.trim()) {
      showToast('Payment reference is required')
      return
    }
    const ok = window.confirm(
      `This will mark ${selectedInvoices.length} invoice(s) as paid (${formatAed(selectedTotal)}) and cannot be undone. Proceed?`
    )
    if (!ok) return

    setSaving(true)
    try {
      const result = await createPaymentRun({
        invoice_ids: selectedInvoices.map((i) => i.id),
        payment_method: method,
        payment_reference: reference.trim(),
        run_date: runDate,
        notes: notes.trim() || undefined,
      })
      setLastRunId(result.run_id)
      showToast(
        `Payment run complete — ${result.invoice_count} invoices, ${formatAed(result.total_amount_aed)}`
      )
      setReference('')
      setNotes('')
      await load()
      const detail = await fetchPaymentRun(result.run_id)
      setSummaryRun(detail.run)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Payment run failed')
    } finally {
      setSaving(false)
    }
  }

  async function openSummary(runId: string) {
    try {
      const detail = await fetchPaymentRun(runId)
      setSummaryRun(detail.run)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to load summary')
    }
  }

  function handlePrint() {
    window.print()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Loading payment run…
      </div>
    )
  }

  const allSelected = invoices.length > 0 && selected.size === invoices.length

  return (
    <div className="space-y-6 payment-run-page">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <CreditCard className="w-6 h-6" />
          Payment Run
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Bulk-mark unpaid broker invoices as paid with one payment reference
        </p>
      </div>

      {toast && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 text-sm flex flex-wrap items-center justify-between gap-3">
          <span>{toast}</span>
          {lastRunId && (
            <button
              type="button"
              onClick={() => void openSummary(lastRunId)}
              className="font-medium underline"
            >
              Download Payment Run Summary
            </button>
          )}
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-800 px-4 py-3 text-sm">
          {error}
          <p className="mt-1 text-xs text-red-600">
            Ensure Express is on :3001 and migration 033 is applied.
          </p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Unpaid invoices</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Open statuses: draft, sent, overdue, partial (outstanding balance)
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => toggleAll(e.target.checked)}
                    aria-label="Select all"
                  />
                </th>
                <th className="text-left px-4 py-3 font-medium">Broker</th>
                <th className="text-left px-4 py-3 font-medium">Invoice #</th>
                <th className="text-left px-4 py-3 font-medium">Deal</th>
                <th className="text-right px-4 py-3 font-medium">Amount (AED)</th>
                <th className="text-left px-4 py-3 font-medium">Due Date</th>
                <th className="text-right px-4 py-3 font-medium">Days Overdue</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const overdue = inv.days_overdue || 0
                const rowClass =
                  overdue > 60
                    ? 'bg-red-50'
                    : overdue > 30
                      ? 'bg-amber-50'
                      : ''
                return (
                  <tr key={inv.id} className={`border-t border-slate-100 ${rowClass}`}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(inv.id)}
                        onChange={(e) => toggleOne(inv.id, e.target.checked)}
                        aria-label={`Select ${inv.invoice_number}`}
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {inv.agents?.full_name || '—'}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{inv.invoice_number}</td>
                    <td className="px-4 py-3 text-slate-600">{dealLabelFromInvoice(inv)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">
                      {formatAed(inv.outstanding_aed)}
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {inv.due_date || '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{overdue}</td>
                  </tr>
                )
              })}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    No unpaid invoices. Approve a commission to generate one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 text-sm font-medium text-slate-800">
          {selected.size} invoices selected — {formatAed(selectedTotal)} total
        </div>
      </div>

      {selected.size > 0 && (
        <form
          onSubmit={handleRunPayment}
          className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4"
        >
          <h2 className="font-semibold text-slate-900">Payment details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Payment date</label>
              <input
                type="date"
                required
                value={runDate}
                onChange={(e) => setRunDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Payment method</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                {PAYMENT_METHOD_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Payment reference
              </label>
              <input
                type="text"
                required
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Bank ref / cheque no / transaction ID"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="md:col-span-2 lg:col-span-4">
              <label className="block text-xs font-medium text-slate-600 mb-1">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
            Run Payment ({selected.size} invoices — {formatAed(selectedTotal)})
          </button>
        </form>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setHistoryOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium text-slate-800 hover:bg-slate-50"
        >
          <span>Previous Payment Runs ({runs.length})</span>
          {historyOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {historyOpen && (
          <div className="overflow-x-auto border-t border-slate-100">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Date</th>
                  <th className="text-left px-4 py-2 font-medium">Reference</th>
                  <th className="text-left px-4 py-2 font-medium">Method</th>
                  <th className="text-right px-4 py-2 font-medium">Invoices</th>
                  <th className="text-right px-4 py-2 font-medium">Total (AED)</th>
                  <th className="text-right px-4 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="px-4 py-2 whitespace-nowrap">{r.run_date}</td>
                    <td className="px-4 py-2 font-medium">{r.payment_reference}</td>
                    <td className="px-4 py-2">{paymentMethodLabel(r.payment_method)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{r.invoice_count}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatAed(r.total_amount_aed)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => void openSummary(r.id)}
                        className="text-blue-700 hover:underline text-xs font-medium"
                      >
                        View Summary
                      </button>
                    </td>
                  </tr>
                ))}
                {runs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      No payment runs yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {summaryRun && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:p-0 print:static print:inset-auto">
          <div
            className="absolute inset-0 bg-slate-900/50 print:hidden"
            onClick={() => setSummaryRun(null)}
          />
          <div className="relative bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-auto print:shadow-none print:max-w-none print:max-h-none print:rounded-none">
            <div className="flex justify-end gap-2 p-3 border-b border-slate-100 print:hidden">
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-sm"
              >
                <Printer className="w-4 h-4" />
                Print / Save as PDF
              </button>
              <button
                type="button"
                onClick={() => setSummaryRun(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm"
              >
                Close
              </button>
            </div>
            <div ref={printRef} className="p-8 payment-run-summary-print">
              <div className="text-center mb-6">
                <div className="text-lg font-bold tracking-wide text-slate-900">
                  GNANOVA REAL ESTATE
                </div>
                <div className="text-sm font-semibold text-slate-700 mt-1">
                  PAYMENT RUN SUMMARY
                </div>
                <div className="text-sm text-slate-600 mt-3 space-y-0.5">
                  <div>Date: {summaryRun.run_date}</div>
                  <div>Reference: {summaryRun.payment_reference}</div>
                  <div>Method: {paymentMethodLabel(summaryRun.payment_method)}</div>
                </div>
              </div>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-900">
                    <th className="text-left py-2">Broker Name</th>
                    <th className="text-left py-2">Invoice #</th>
                    <th className="text-left py-2">Deal</th>
                    <th className="text-right py-2">Amount (AED)</th>
                  </tr>
                </thead>
                <tbody>
                  {(summaryRun.payment_run_items || []).map((item) => {
                    const deal = item.broker_invoices?.deals
                    const dealTxt =
                      [deal?.project_name, deal?.unit_number].filter(Boolean).join(' · ') ||
                      deal?.client_name ||
                      '—'
                    return (
                      <tr key={item.id} className="border-b border-slate-200">
                        <td className="py-2">{item.agents?.full_name || '—'}</td>
                        <td className="py-2">
                          {item.broker_invoices?.invoice_number || '—'}
                        </td>
                        <td className="py-2">{dealTxt}</td>
                        <td className="py-2 text-right tabular-nums">
                          {formatAed(item.amount_aed)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div className="mt-6 text-sm text-slate-700 space-y-1">
                <div>Total Invoices: {summaryRun.invoice_count}</div>
                <div className="font-semibold">
                  Total Amount: {formatAed(summaryRun.total_amount_aed)}
                </div>
                <div>
                  Processed by:{' '}
                  {summaryRun.created_by_agent?.full_name || agent?.full_name || '—'}
                </div>
                <div>
                  Generated:{' '}
                  {format(new Date(summaryRun.created_at || Date.now()), 'dd MMM yyyy HH:mm')}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .payment-run-summary-print,
          .payment-run-summary-print * { visibility: visible !important; }
          .payment-run-summary-print {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            padding: 24px !important;
          }
        }
      `}</style>
    </div>
  )
}

'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiFetch } from '@/lib/api-fetch'
import { formatAed } from '@/lib/pipeline'

type Suite = {
  id: string
  suite_number: string
  floor: number
  size_sqft: number
  status: string
  price: number
  customer_name: string | null
  customer_id: string | null
  booking_date: string | null
  payment_received: number
  balance_amount: number
  notes: string | null
}

type Payment = {
  id: string
  installment_number: number
  installment_amount: number
  due_date: string
  paid_date: string | null
  status: string
  payment_method: string | null
  utr_number: string | null
}

function statusClass(status: string) {
  if (status === 'Available') return 'bg-green-100 text-green-800'
  if (status === 'Booked') return 'bg-blue-100 text-blue-800'
  if (status === 'Blocked') return 'bg-yellow-100 text-yellow-900'
  if (status === 'Paid') return 'bg-green-100 text-green-800'
  if (status === 'Pending') return 'bg-yellow-100 text-yellow-900'
  if (status === 'Overdue') return 'bg-red-100 text-red-800'
  return 'bg-slate-200 text-slate-700'
}

export default function SuiteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [suite, setSuite] = useState<Suite | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [edit, setEdit] = useState({ status: '', customer_name: '', notes: '' })
  const [showBook, setShowBook] = useState(false)
  const [showInstallment, setShowInstallment] = useState(false)
  const [editPay, setEditPay] = useState<Payment | null>(null)
  const [saving, setSaving] = useState(false)
  const [bookForm, setBookForm] = useState({
    customer_name: '',
    customer_phone: '',
    booking_date: '',
    booking_amount: '',
  })
  const [instForm, setInstForm] = useState({
    installment_number: '',
    installment_amount: '',
    due_date: '',
    payment_method: 'Bank Transfer',
  })
  const [utrForm, setUtrForm] = useState({ payment_method: '', utr_number: '' })

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch(`/api/suites/${id}`)
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Failed to load suite')
      setSuite(j.suite as Suite)
      setPayments((j.payments as Payment[]) || [])
      setEdit({
        status: j.suite.status,
        customer_name: j.suite.customer_name || '',
        notes: j.suite.notes || '',
      })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const totals = useMemo(() => {
    const received = payments
      .filter((p) => p.status === 'Paid')
      .reduce((s, p) => s + Number(p.installment_amount || 0), 0)
    const price = Number(suite?.price || 0)
    return { price, received, balance: price - received }
  }, [payments, suite])

  async function saveEdit() {
    if (!id) return
    setSaving(true)
    const res = await apiFetch(`/api/suites/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: edit.status,
        customer_name: edit.customer_name,
        notes: edit.notes,
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(j.error || 'Update failed')
      return
    }
    setEditing(false)
    void load()
  }

  async function bookSuite(e: React.FormEvent) {
    e.preventDefault()
    if (!suite) return
    setSaving(true)
    setError(null)
    try {
      const payRes = await apiFetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suite_id: suite.id,
          suite_number: suite.suite_number,
          customer_name: bookForm.customer_name,
          customer_phone: bookForm.customer_phone,
          total_price: suite.price,
          booking_amount: Number(bookForm.booking_amount),
          installment_number: 1,
          installment_amount: Number(bookForm.booking_amount),
          due_date: bookForm.booking_date,
          payment_method: 'Booking',
        }),
      })
      const payJ = await payRes.json().catch(() => ({}))
      if (!payRes.ok) throw new Error(payJ.error || 'Payment create failed')

      const suiteRes = await apiFetch(`/api/suites/${suite.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'Booked',
          customer_name: bookForm.customer_name,
          booking_date: bookForm.booking_date,
        }),
      })
      const suiteJ = await suiteRes.json().catch(() => ({}))
      if (!suiteRes.ok) throw new Error(suiteJ.error || 'Suite update failed')
      setShowBook(false)
      setBookForm({ customer_name: '', customer_phone: '', booking_date: '', booking_amount: '' })
      void load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Booking failed')
    } finally {
      setSaving(false)
    }
  }

  async function addInstallment(e: React.FormEvent) {
    e.preventDefault()
    if (!suite) return
    setSaving(true)
    setError(null)
    try {
      const res = await apiFetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suite_id: suite.id,
          suite_number: suite.suite_number,
          customer_name: suite.customer_name || 'Customer',
          total_price: suite.price,
          booking_amount: 0,
          installment_number: Number(instForm.installment_number),
          installment_amount: Number(instForm.installment_amount),
          due_date: instForm.due_date,
          payment_method: instForm.payment_method,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Failed to add installment')
      setShowInstallment(false)
      setInstForm({ installment_number: '', installment_amount: '', due_date: '', payment_method: 'Bank Transfer' })
      void load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add installment')
    } finally {
      setSaving(false)
    }
  }

  async function markPaid(paymentId: string) {
    const res = await apiFetch(`/api/payments/${paymentId}`, {
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

  async function saveUtr(e: React.FormEvent) {
    e.preventDefault()
    if (!editPay) return
    setSaving(true)
    const res = await apiFetch(`/api/payments/${editPay.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payment_method: utrForm.payment_method,
        utr_number: utrForm.utr_number,
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(j.error || 'Update failed')
      return
    }
    setEditPay(null)
    void load()
  }

  if (loading && !suite) return <p className="text-sm text-slate-400 py-10 text-center">Loading suite…</p>
  if (!suite) {
    return (
      <div>
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        <Link href="/dashboard/suites" className="text-sm text-blue-700">
          ← Suites
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Link href="/dashboard/suites" className="text-xs text-slate-500 hover:text-slate-800">
        ← All suites
      </Link>
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{error}</div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{suite.suite_number}</h1>
            <p className="text-sm text-slate-500 mt-1">
              Floor {suite.floor} · {Number(suite.size_sqft).toLocaleString()} sqft · {formatAed(Number(suite.price))}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(suite.status)}`}>
              {suite.status}
            </span>
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold"
            >
              {editing ? 'Cancel' : 'Edit'}
            </button>
          </div>
        </div>
        {editing && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select
              value={edit.status}
              onChange={(e) => setEdit((f) => ({ ...f, status: e.target.value }))}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {['Available', 'Booked', 'Blocked', 'Sold'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <input
              value={edit.customer_name}
              onChange={(e) => setEdit((f) => ({ ...f, customer_name: e.target.value }))}
              placeholder="Customer name"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              value={edit.notes}
              onChange={(e) => setEdit((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Notes"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveEdit()}
              className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white"
            >
              Save
            </button>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Customer</h2>
        <p className="text-sm text-slate-700">{suite.customer_name || '—'}</p>
        {suite.customer_id && (
          <Link href={`/dashboard/leads/${suite.customer_id}`} className="text-xs text-blue-700 hover:underline">
            Open lead
          </Link>
        )}
        <p className="text-xs text-slate-500">Booked {suite.booking_date || '—'}</p>
        {suite.status === 'Available' && (
          <button
            type="button"
            onClick={() => setShowBook(true)}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white"
          >
            Book This Suite
          </button>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">Payment schedule</h2>
          <button
            type="button"
            onClick={() => setShowInstallment(true)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold"
          >
            Add Installment
          </button>
        </div>
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
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
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  No installments
                </td>
              </tr>
            ) : (
              payments.map((p) => (
                <tr key={p.id}>
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
                    <button
                      type="button"
                      onClick={() => {
                        setEditPay(p)
                        setUtrForm({
                          payment_method: p.payment_method || '',
                          utr_number: p.utr_number || '',
                        })
                      }}
                      className="text-xs font-semibold text-slate-600 hover:underline"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className="grid grid-cols-3 gap-3 border-t border-slate-200 px-5 py-4 text-sm">
          <div>
            <div className="text-xs text-slate-500">Total Price</div>
            <div className="font-semibold">{formatAed(totals.price)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Total Received</div>
            <div className="font-semibold text-green-700">{formatAed(totals.received)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Balance Due</div>
            <div className="font-semibold text-red-700">{formatAed(totals.balance)}</div>
          </div>
        </div>
      </div>

      {showBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={bookSuite} className="w-full max-w-md rounded-xl bg-white p-6 space-y-3">
            <h2 className="text-base font-semibold">Book This Suite</h2>
            <input
              required
              placeholder="Customer name"
              value={bookForm.customer_name}
              onChange={(e) => setBookForm((f) => ({ ...f, customer_name: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              placeholder="Customer phone"
              value={bookForm.customer_phone}
              onChange={(e) => setBookForm((f) => ({ ...f, customer_phone: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              required
              type="date"
              value={bookForm.booking_date}
              onChange={(e) => setBookForm((f) => ({ ...f, booking_date: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              required
              type="number"
              placeholder="Booking amount"
              value={bookForm.booking_amount}
              onChange={(e) => setBookForm((f) => ({ ...f, booking_amount: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowBook(false)} className="flex-1 rounded-lg border py-2 text-xs font-semibold">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-blue-600 py-2 text-xs font-semibold text-white">
                Book
              </button>
            </div>
          </form>
        </div>
      )}

      {showInstallment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={addInstallment} className="w-full max-w-md rounded-xl bg-white p-6 space-y-3">
            <h2 className="text-base font-semibold">Add Installment</h2>
            <input
              required
              type="number"
              placeholder="Installment #"
              value={instForm.installment_number}
              onChange={(e) => setInstForm((f) => ({ ...f, installment_number: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              required
              type="number"
              placeholder="Amount"
              value={instForm.installment_amount}
              onChange={(e) => setInstForm((f) => ({ ...f, installment_amount: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              required
              type="date"
              value={instForm.due_date}
              onChange={(e) => setInstForm((f) => ({ ...f, due_date: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              placeholder="Payment method"
              value={instForm.payment_method}
              onChange={(e) => setInstForm((f) => ({ ...f, payment_method: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowInstallment(false)} className="flex-1 rounded-lg border py-2 text-xs font-semibold">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-blue-600 py-2 text-xs font-semibold text-white">
                Add
              </button>
            </div>
          </form>
        </div>
      )}

      {editPay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={saveUtr} className="w-full max-w-md rounded-xl bg-white p-6 space-y-3">
            <h2 className="text-base font-semibold">Edit payment #{editPay.installment_number}</h2>
            <input
              placeholder="Method"
              value={utrForm.payment_method}
              onChange={(e) => setUtrForm((f) => ({ ...f, payment_method: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              placeholder="UTR / reference"
              value={utrForm.utr_number}
              onChange={(e) => setUtrForm((f) => ({ ...f, utr_number: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setEditPay(null)} className="flex-1 rounded-lg border py-2 text-xs font-semibold">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-blue-600 py-2 text-xs font-semibold text-white">
                Save
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

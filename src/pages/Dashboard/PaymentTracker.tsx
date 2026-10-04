import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  Plus, X, Loader2, Save, MessageCircle, Download,
  CreditCard, AlertCircle, CheckCircle, Clock, Calendar,
} from 'lucide-react'
import { format, addMonths, isPast, isToday } from 'date-fns'

export type PaymentStatus = 'Pending' | 'Paid' | 'Overdue'

export type Payment = {
  id: string
  customer_name: string
  customer_phone: string | null
  suite_id: string | null
  suite_number: string | null
  total_price: number
  booking_amount: number
  installment_number: number
  installment_amount: number
  due_date: string
  paid_date: string | null
  payment_method: string | null
  utr_number: string | null
  status: PaymentStatus
  receipt_sent: boolean
  created_at: string
}

const STATUS_STYLES: Record<PaymentStatus, string> = {
  Paid: 'bg-green-100 text-green-700',
  Overdue: 'bg-red-100 text-red-700',
  Pending: 'bg-yellow-100 text-yellow-700',
}

const STATUS_ROW: Record<PaymentStatus, string> = {
  Paid: 'border-l-4 border-green-400',
  Overdue: 'border-l-4 border-red-400',
  Pending: 'border-l-4 border-yellow-400',
}

type ScheduleEntry = { installment: number; due_date: string; amount: number; status: PaymentStatus }

const emptyForm = {
  customer_name: '',
  customer_phone: '',
  suite_number: '',
  total_price: '',
  booking_amount: '',
  installment_number: '',
  installment_amount: '',
  due_date: '',
  payment_method: 'Bank Transfer',
  utr_number: '',
  status: 'Pending' as PaymentStatus,
}

export default function PaymentTrackerPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [showScheduler, setShowScheduler] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [filterStatus, setFilterStatus] = useState<PaymentStatus | 'All'>('All')
  const [filterSuite, setFilterSuite] = useState('')
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([])
  const [schedForm, setSchedForm] = useState({ total: '', booking: '', installments: '4', start_date: '' })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { loadPayments() }, [])

  async function loadPayments() {
    setLoading(true)
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .order('due_date', { ascending: true })
    if (!error && data) setPayments(data as Payment[])
    setLoading(false)
  }

  const filtered = payments.filter((p) => {
    const matchStatus = filterStatus === 'All' || p.status === filterStatus
    const matchSuite = !filterSuite || (p.suite_number || '').toLowerCase().includes(filterSuite.toLowerCase())
    return matchStatus && matchSuite
  })

  const totalCollected = payments.filter((p) => p.status === 'Paid').reduce((s, p) => s + p.installment_amount, 0)
  const totalOutstanding = payments.filter((p) => p.status !== 'Paid').reduce((s, p) => s + p.installment_amount, 0)
  const overdueCount = payments.filter((p) => p.status === 'Overdue').length
  const todayCount = payments.filter((p) => p.due_date && isToday(new Date(p.due_date))).length

  const formatAed = (n: number) => `INR ${n.toLocaleString()}`

  function generateSchedule() {
    const total = Number(schedForm.total)
    const booking = Number(schedForm.booking)
    const count = Number(schedForm.installments)
    const start = schedForm.start_date ? new Date(schedForm.start_date) : new Date()
    if (!total || !count) return
    const remaining = total - booking
    const installmentAmt = Math.round(remaining / count)
    const entries: ScheduleEntry[] = []
    for (let i = 0; i < count; i++) {
      const due = addMonths(start, i)
      entries.push({
        installment: i + 1,
        due_date: format(due, 'yyyy-MM-dd'),
        amount: i === count - 1 ? remaining - installmentAmt * (count - 1) : installmentAmt,
        status: isPast(due) ? 'Overdue' : 'Pending',
      })
    }
    setSchedule(entries)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const { error } = await supabase.from('payments').insert({
      customer_name: form.customer_name,
      customer_phone: form.customer_phone || null,
      suite_number: form.suite_number || null,
      total_price: Number(form.total_price) || 0,
      booking_amount: Number(form.booking_amount) || 0,
      installment_number: Number(form.installment_number) || 1,
      installment_amount: Number(form.installment_amount) || 0,
      due_date: form.due_date,
      payment_method: form.payment_method || null,
      utr_number: form.utr_number || null,
      status: form.status,
      receipt_sent: false,
    })
    setSaving(false)
    if (error) { setError(error.message); return }
    setShowAdd(false)
    setForm(emptyForm)
    loadPayments()
  }

  async function markPaid(id: string) {
    await supabase.from('payments').update({ status: 'Paid', paid_date: new Date().toISOString() }).eq('id', id)
    loadPayments()
  }

  async function sendWhatsAppReminder(p: Payment) {
    const msg = `Hi ${p.customer_name}! Your payment of ${formatAed(p.installment_amount)} for Suite ${p.suite_number || ''} (Installment ${p.installment_number}) is due on ${p.due_date}. Please arrange the payment. Thank you! — Gnanova Pro`
    alert(`WhatsApp reminder would be sent to ${p.customer_phone}:\n\n${msg}\n\n(Connect Twilio to enable auto-send)`)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payment Tracker</h1>
          <p className="text-slate-500 text-sm mt-1">{payments.length} payment records</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowScheduler(true)}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 text-sm">
            <Calendar className="w-4 h-4" /> Schedule Generator
          </button>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
            <Plus className="w-4 h-4" /> Add Payment
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span className="text-sm text-slate-500">Total Collected</span>
          </div>
          <p className="text-xl font-bold text-green-600">{formatAed(totalCollected)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-yellow-500" />
            <span className="text-sm text-slate-500">Outstanding</span>
          </div>
          <p className="text-xl font-bold text-yellow-600">{formatAed(totalOutstanding)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span className="text-sm text-slate-500">Overdue</span>
          </div>
          <p className="text-xl font-bold text-red-600">{overdueCount} payments</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="w-5 h-5 text-blue-500" />
            <span className="text-sm text-slate-500">Due Today</span>
          </div>
          <p className="text-xl font-bold text-blue-600">{todayCount} payments</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        {(['All', 'Pending', 'Paid', 'Overdue'] as const).map((s) => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
              filterStatus === s ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600 hover:border-slate-400'
            }`}>
            {s}
          </button>
        ))}
        <input value={filterSuite} onChange={(e) => setFilterSuite(e.target.value)}
          placeholder="Filter by suite..." className="ml-auto border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-44" />
      </div>

      {/* Payments Table */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No payments found. Add your first payment record!</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Customer</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Suite</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Installment</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Amount</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Due Date</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">UTR</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((p) => (
                <tr key={p.id} className={`hover:bg-slate-50 transition-colors ${STATUS_ROW[p.status]}`}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{p.customer_name}</p>
                    {p.customer_phone && <p className="text-xs text-slate-500">{p.customer_phone}</p>}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{p.suite_number || '—'}</td>
                  <td className="px-4 py-3 text-slate-700">#{p.installment_number}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{formatAed(p.installment_amount)}</td>
                  <td className="px-4 py-3">
                    <p className={`text-sm ${isPast(new Date(p.due_date)) && p.status !== 'Paid' ? 'text-red-600 font-medium' : 'text-slate-700'}`}>
                      {p.due_date}
                    </p>
                    {p.paid_date && <p className="text-xs text-green-600">Paid: {p.paid_date.split('T')[0]}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[p.status]}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{p.utr_number || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {p.status !== 'Paid' && (
                        <>
                          <button onClick={() => markPaid(p.id)} title="Mark as Paid"
                            className="p-1.5 rounded-lg text-green-600 hover:bg-green-50">
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          {p.customer_phone && (
                            <button onClick={() => sendWhatsAppReminder(p)} title="Send WhatsApp reminder"
                              className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50">
                              <MessageCircle className="w-4 h-4" />
                            </button>
                          )}
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

      {/* Installment Schedule Generator Modal */}
      {showScheduler && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-bold text-slate-900">Installment Schedule Generator</h2>
              <button onClick={() => { setShowScheduler(false); setSchedule([]) }} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">Total Price (INR)</label>
                  <input type="number" value={schedForm.total} onChange={(e) => setSchedForm({ ...schedForm, total: e.target.value })}
                    placeholder="2000000" className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Booking Amount (INR)</label>
                  <input type="number" value={schedForm.booking} onChange={(e) => setSchedForm({ ...schedForm, booking: e.target.value })}
                    placeholder="200000" className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Number of Installments</label>
                  <input type="number" value={schedForm.installments} onChange={(e) => setSchedForm({ ...schedForm, installments: e.target.value })}
                    placeholder="4" className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Start Date</label>
                  <input type="date" value={schedForm.start_date} onChange={(e) => setSchedForm({ ...schedForm, start_date: e.target.value })}
                    className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <button onClick={generateSchedule}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                Generate Schedule
              </button>

              {schedule.length > 0 && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-slate-700">Payment Schedule</p>
                    <p className="text-xs text-slate-500">
                      Booking: INR {Number(schedForm.booking).toLocaleString()} + {schedule.length} installments
                    </p>
                  </div>
                  <div className="space-y-2 max-h-52 overflow-y-auto">
                    {schedule.map((s) => (
                      <div key={s.installment} className={`flex items-center justify-between px-3 py-2 rounded-lg border ${
                        s.status === 'Overdue' ? 'border-red-200 bg-red-50' : 'border-slate-100 bg-slate-50'
                      }`}>
                        <span className="text-sm text-slate-700">Installment #{s.installment}</span>
                        <span className="text-sm text-slate-500">{s.due_date}</span>
                        <span className="text-sm font-semibold text-slate-900">INR {s.amount.toLocaleString()}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLES[s.status]}`}>{s.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Payment Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-screen overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-bold text-slate-900">Add Payment Record</h2>
              <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleAdd} className="p-5 space-y-4">
              {error && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">Customer Name *</label>
                  <input required value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                    placeholder="Ahmed Al Mansoori" className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Phone</label>
                  <input value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
                    placeholder="+971 50 123 4567" className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Suite Number</label>
                  <input value={form.suite_number} onChange={(e) => setForm({ ...form, suite_number: e.target.value })}
                    placeholder="101" className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Total Price (INR)</label>
                  <input type="number" value={form.total_price} onChange={(e) => setForm({ ...form, total_price: e.target.value })}
                    placeholder="500000" className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Installment # *</label>
                  <input required type="number" value={form.installment_number} onChange={(e) => setForm({ ...form, installment_number: e.target.value })}
                    placeholder="1" className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Installment Amount (INR) *</label>
                  <input required type="number" value={form.installment_amount} onChange={(e) => setForm({ ...form, installment_amount: e.target.value })}
                    placeholder="125000" className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Due Date *</label>
                  <input required type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                    className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as PaymentStatus })}
                    className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option>Pending</option><option>Paid</option><option>Overdue</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Payment Method</label>
                  <select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                    className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option>Bank Transfer</option><option>Cheque</option><option>Cash</option><option>UPI</option><option>NEFT</option><option>RTGS</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">UTR / Reference #</label>
                  <input value={form.utr_number} onChange={(e) => setForm({ ...form, utr_number: e.target.value })}
                    placeholder="UTR123456789" className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAdd(false)}
                  className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={saving}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? 'Saving...' : 'Save Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

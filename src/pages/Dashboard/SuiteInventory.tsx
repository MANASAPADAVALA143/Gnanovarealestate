import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, X, Save, Loader2, Building2, CheckCircle, Clock, Ban } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

export type SuiteStatus = 'Available' | 'Booked' | 'Blocked' | 'Sold'

export type Suite = {
  id: string
  suite_number: string
  floor: number
  size_sqft: number
  status: SuiteStatus
  price: number
  customer_id: string | null
  customer_name: string | null
  booking_date: string | null
  payment_received: number
  balance_amount: number
  notes: string | null
  created_at: string
}

const STATUS_COLORS: Record<SuiteStatus, string> = {
  Available: 'bg-green-100 border-green-400 text-green-800',
  Booked: 'bg-yellow-100 border-yellow-400 text-yellow-800',
  Sold: 'bg-red-100 border-red-400 text-red-800',
  Blocked: 'bg-slate-100 border-slate-400 text-slate-600',
}

const STATUS_DOT: Record<SuiteStatus, string> = {
  Available: 'bg-green-500',
  Booked: 'bg-yellow-500',
  Sold: 'bg-red-500',
  Blocked: 'bg-slate-400',
}

const PIE_COLORS = ['#22c55e', '#eab308', '#ef4444', '#94a3b8']
const ALL_STATUSES: SuiteStatus[] = ['Available', 'Booked', 'Sold', 'Blocked']

const emptyForm = {
  suite_number: '',
  floor: '',
  size_sqft: '',
  status: 'Available' as SuiteStatus,
  price: '',
  customer_name: '',
  booking_date: '',
  payment_received: '',
  balance_amount: '',
  notes: '',
}

export default function SuiteInventoryPage() {
  const [suites, setSuites] = useState<Suite[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Suite | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [filterStatus, setFilterStatus] = useState<SuiteStatus | 'All'>('All')
  const [filterFloor, setFilterFloor] = useState<string>('All')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadSuites()
  }, [])

  async function loadSuites() {
    setLoading(true)
    const { data, error } = await supabase
      .from('suites')
      .select('*')
      .order('floor', { ascending: true })
      .order('suite_number', { ascending: true })
    if (!error && data) setSuites(data as Suite[])
    setLoading(false)
  }

  const floors = ['All', ...Array.from(new Set(suites.map((s) => String(s.floor)))).sort()]

  const filtered = suites.filter((s) => {
    const matchStatus = filterStatus === 'All' || s.status === filterStatus
    const matchFloor = filterFloor === 'All' || String(s.floor) === filterFloor
    return matchStatus && matchFloor
  })

  const counts = ALL_STATUSES.map((st) => ({
    name: st,
    value: suites.filter((s) => s.status === st).length,
  }))

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const { error } = await supabase.from('suites').insert({
      suite_number: form.suite_number,
      floor: Number(form.floor),
      size_sqft: Number(form.size_sqft),
      status: form.status,
      price: Number(form.price),
      customer_name: form.customer_name || null,
      booking_date: form.booking_date || null,
      payment_received: Number(form.payment_received) || 0,
      balance_amount: Number(form.balance_amount) || 0,
      notes: form.notes || null,
    })
    setSaving(false)
    if (error) { setError(error.message); return }
    setShowAdd(false)
    setForm(emptyForm)
    loadSuites()
  }

  async function handleStatusChange(suite: Suite, status: SuiteStatus) {
    await supabase.from('suites').update({ status }).eq('id', suite.id)
    loadSuites()
    if (selected?.id === suite.id) setSelected({ ...selected, status })
  }

  const formatAed = (n: number) =>
    n ? `INR ${n.toLocaleString()}` : '—'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Suite Inventory</h1>
          <p className="text-slate-500 text-sm mt-1">{suites.length} suites total</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Add Suite
        </button>
      </div>

      {/* KPI Cards + Chart */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {counts.map((c, i) => (
          <button
            key={c.name}
            onClick={() => setFilterStatus(filterStatus === c.name ? 'All' : c.name as SuiteStatus)}
            className={`bg-white rounded-xl border-2 p-4 text-left transition-all ${
              filterStatus === c.name ? 'border-blue-500 shadow-md' : 'border-slate-100 hover:border-slate-300'
            }`}
          >
            <div className={`w-3 h-3 rounded-full mb-2 ${STATUS_DOT[c.name as SuiteStatus]}`} />
            <p className="text-2xl font-bold text-slate-900">{c.value}</p>
            <p className="text-sm text-slate-500">{c.name}</p>
          </button>
        ))}
        <div className="bg-white rounded-xl border border-slate-100 p-4 lg:col-span-1">
          <ResponsiveContainer width="100%" height={80}>
            <PieChart>
              <Pie data={counts} dataKey="value" cx="50%" cy="50%" outerRadius={35} strokeWidth={0}>
                {counts.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i]} />
                ))}
              </Pie>
              <Tooltip formatter={(v, n) => [v, n]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <span className="text-sm text-slate-500 font-medium">Floor:</span>
        {floors.map((f) => (
          <button
            key={f}
            onClick={() => setFilterFloor(f)}
            className={`px-3 py-1 rounded-full text-sm border transition-colors ${
              filterFloor === f
                ? 'bg-blue-600 text-white border-blue-600'
                : 'border-slate-200 text-slate-600 hover:border-slate-400'
            }`}
          >
            {f === 'All' ? 'All Floors' : `Floor ${f}`}
          </button>
        ))}
        {(filterStatus !== 'All' || filterFloor !== 'All') && (
          <button
            onClick={() => { setFilterStatus('All'); setFilterFloor('All') }}
            className="text-xs text-blue-600 hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Suite Grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No suites found. Add your first suite!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {filtered.map((suite) => (
            <button
              key={suite.id}
              onClick={() => setSelected(suite)}
              className={`border-2 rounded-xl p-3 text-left transition-all hover:shadow-md ${STATUS_COLORS[suite.status]}`}
            >
              <p className="font-bold text-lg leading-tight">{suite.suite_number}</p>
              <p className="text-xs opacity-70">Floor {suite.floor}</p>
              <p className="text-xs opacity-70">{suite.size_sqft} sqft</p>
              <div className="mt-2">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  suite.status === 'Available' ? 'bg-green-200' :
                  suite.status === 'Booked' ? 'bg-yellow-200' :
                  suite.status === 'Sold' ? 'bg-red-200' : 'bg-slate-200'
                }`}>
                  {suite.status}
                </span>
              </div>
              <p className="text-xs font-medium mt-1">{formatAed(suite.price)}</p>
            </button>
          ))}
        </div>
      )}

      {/* Suite Detail Modal */}
      {selected && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-bold text-slate-900">Suite {selected.suite_number}</h2>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-slate-500">Floor</p><p className="font-semibold">{selected.floor}</p></div>
                <div><p className="text-slate-500">Size</p><p className="font-semibold">{selected.size_sqft} sqft</p></div>
                <div><p className="text-slate-500">Price</p><p className="font-semibold">{formatAed(selected.price)}</p></div>
                <div><p className="text-slate-500">Payment Received</p><p className="font-semibold text-green-600">{formatAed(selected.payment_received)}</p></div>
                <div><p className="text-slate-500">Balance</p><p className="font-semibold text-red-600">{formatAed(selected.balance_amount)}</p></div>
                {selected.customer_name && (
                  <div><p className="text-slate-500">Customer</p><p className="font-semibold">{selected.customer_name}</p></div>
                )}
                {selected.booking_date && (
                  <div><p className="text-slate-500">Booked On</p><p className="font-semibold">{selected.booking_date}</p></div>
                )}
              </div>
              {selected.notes && (
                <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600">{selected.notes}</div>
              )}
              <div>
                <p className="text-sm text-slate-500 mb-2 font-medium">Change Status:</p>
                <div className="flex flex-wrap gap-2">
                  {ALL_STATUSES.map((st) => (
                    <button
                      key={st}
                      onClick={() => handleStatusChange(selected, st)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-colors ${
                        selected.status === st
                          ? STATUS_COLORS[st] + ' border-current'
                          : 'border-slate-200 text-slate-600 hover:border-slate-400'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Suite Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-bold text-slate-900">Add New Suite</h2>
              <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAdd} className="p-5 space-y-4">
              {error && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">Suite Number *</label>
                  <input required value={form.suite_number} onChange={(e) => setForm({ ...form, suite_number: e.target.value })}
                    placeholder="e.g. 101" className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Floor *</label>
                  <input required type="number" value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })}
                    placeholder="1" className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Size (sqft) *</label>
                  <input required type="number" value={form.size_sqft} onChange={(e) => setForm({ ...form, size_sqft: e.target.value })}
                    placeholder="500" className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Price (INR) *</label>
                  <input required type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })}
                    placeholder="500000" className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as SuiteStatus })}
                    className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {ALL_STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Customer Name</label>
                  <input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                    placeholder="Optional" className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Payment Received (INR)</label>
                  <input type="number" value={form.payment_received} onChange={(e) => setForm({ ...form, payment_received: e.target.value })}
                    placeholder="0" className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Balance (INR)</label>
                  <input type="number" value={form.balance_amount} onChange={(e) => setForm({ ...form, balance_amount: e.target.value })}
                    placeholder="0" className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2} placeholder="Optional notes..." className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAdd(false)}
                  className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm hover:bg-slate-50">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? 'Saving...' : 'Add Suite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

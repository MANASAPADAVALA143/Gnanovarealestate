import React, { useCallback, useEffect, useState } from 'react'
import {
  CheckCircle2, ClipboardList, Clock, Download, FileText,
  Loader2, MessageCircle, Plus, RefreshCw, Send, X,
} from 'lucide-react'
import {
  buildAgreementNumber,
  fetchAgreements,
  fetchCustomersForAgreement,
  fetchPaymentScheduleForCustomer,
  generateAgreementPDF,
  saveAgreement,
  updateAgreementStatus,
  type Agreement,
  type AgreementStatus,
} from '../../lib/agreements'
import { whatsappLink } from '../../lib/payment-tracker'

const STATUS_STYLE: Record<AgreementStatus, string> = {
  Draft: 'bg-amber-100 text-amber-800 border-amber-200',
  Sent: 'bg-blue-100 text-blue-800 border-blue-200',
  Signed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
}

const STATUS_ICON: Record<AgreementStatus, React.ElementType> = {
  Draft: ClipboardList,
  Sent: Send,
  Signed: CheckCircle2,
}

function fmt(n: number) {
  return 'AED ' + n.toLocaleString('en-AE', { minimumFractionDigits: 2 })
}

type Step = 'form' | 'preview'

const EMPTY_FORM = {
  customer_name: '',
  customer_address: '',
  customer_aadhaar: '',
  customer_pan: '',
  customer_phone: '',
  suite_number: '',
  floor: '',
  size_sqft: '',
  total_price: '',
  booking_amount: '',
  possession_date: '',
}

export default function AgreementGeneratorPage() {
  const [agreements, setAgreements] = useState<Agreement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const [showModal, setShowModal] = useState(false)
  const [step, setStep] = useState<Step>('form')
  const [saving, setSaving] = useState(false)

  const [customers, setCustomers] = useState<any[]>([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [schedule, setSchedule] = useState<{ installment: number; due_date: string; amount: number }[]>([])
  const [previewAgr, setPreviewAgr] = useState<Agreement | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 4000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [agrs, custs] = await Promise.all([fetchAgreements(), fetchCustomersForAgreement()])
      setAgreements(agrs)
      setCustomers(custs)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function handleCustomerSelect(name: string) {
    setForm((f) => ({ ...f, customer_name: name }))
    if (!name) { setSchedule([]); return }
    const cust = customers.find((c: any) => c.customer_name === name)
    if (cust) {
      setForm((f) => ({
        ...f,
        customer_name: name,
        customer_phone: cust.customer_phone || '',
        suite_number: cust.suite_number || '',
        total_price: String(cust.total_price || ''),
        booking_amount: String(cust.booking_amount || ''),
      }))
    }
    try {
      const sched = await fetchPaymentScheduleForCustomer(name)
      setSchedule(sched)
    } catch {
      setSchedule([])
    }
  }

  function updateField(key: keyof typeof EMPTY_FORM, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function handlePreview() {
    if (!form.customer_name || !form.total_price) { showToast('Fill customer name and total price'); return }
    const agr: Agreement = {
      id: '__preview__',
      agreement_number: buildAgreementNumber(agreements),
      status: 'Draft',
      customer_name: form.customer_name,
      customer_address: form.customer_address || null,
      customer_aadhaar: form.customer_aadhaar || null,
      customer_pan: form.customer_pan || null,
      customer_phone: form.customer_phone || null,
      suite_number: form.suite_number || null,
      floor: form.floor || null,
      size_sqft: form.size_sqft ? parseFloat(form.size_sqft) : null,
      total_price: parseFloat(form.total_price),
      booking_amount: parseFloat(form.booking_amount) || 0,
      possession_date: form.possession_date || null,
      payment_schedule: schedule,
      created_at: new Date().toISOString(),
      sent_at: null,
      signed_at: null,
    }
    setPreviewAgr(agr)
    setStep('preview')
  }

  async function handleSave() {
    if (!previewAgr) return
    setSaving(true)
    try {
      const saved = await saveAgreement({
        agreement_number: previewAgr.agreement_number,
        status: 'Draft',
        customer_name: previewAgr.customer_name,
        customer_address: previewAgr.customer_address,
        customer_aadhaar: previewAgr.customer_aadhaar,
        customer_pan: previewAgr.customer_pan,
        customer_phone: previewAgr.customer_phone,
        suite_number: previewAgr.suite_number,
        floor: previewAgr.floor,
        size_sqft: previewAgr.size_sqft,
        total_price: previewAgr.total_price,
        booking_amount: previewAgr.booking_amount,
        possession_date: previewAgr.possession_date,
        payment_schedule: previewAgr.payment_schedule,
      })
      showToast(`Agreement ${saved.agreement_number} saved`)
      // auto-download
      generateAgreementPDF(saved).save(`${saved.agreement_number}.pdf`)
      closeModal()
      await load()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  function handleDownload(agr: Agreement) {
    generateAgreementPDF(agr).save(`${agr.agreement_number}.pdf`)
  }

  async function handleStatusChange(agr: Agreement, status: AgreementStatus) {
    try {
      await updateAgreementStatus(agr.id, status)
      showToast(`Status updated to ${status}`)
      await load()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Update failed')
    }
  }

  function handleWhatsApp(agr: Agreement) {
    if (!agr.customer_phone) { showToast('No phone number'); return }
    const msg = `Hi ${agr.customer_name}, your Sale Agreement ${agr.agreement_number} for Suite ${agr.suite_number || ''} has been prepared by Gnanova Real Estate. Please review and confirm. Total Value: ${fmt(agr.total_price)}.`
    window.open(whatsappLink(agr.customer_phone, msg), '_blank')
  }

  function closeModal() {
    setShowModal(false)
    setStep('form')
    setForm(EMPTY_FORM)
    setSchedule([])
    setPreviewAgr(null)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-6 h-6" /> Agreement Generator
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Generate and track Sale Agreements</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => void load()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button onClick={() => { setShowModal(true); setStep('form') }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800">
            <Plus className="w-4 h-4" /> New Agreement
          </button>
        </div>
      </div>

      {/* Status KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {(['Draft', 'Sent', 'Signed'] as AgreementStatus[]).map((s) => {
          const Icon = STATUS_ICON[s]
          const count = agreements.filter((a) => a.status === s).length
          return (
            <div key={s} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                s === 'Draft' ? 'bg-amber-100 text-amber-600'
                : s === 'Sent' ? 'bg-blue-100 text-blue-600'
                : 'bg-emerald-100 text-emerald-600'
              }`}>
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">{s}</p>
                <p className="text-xl font-bold text-slate-900">{count}</p>
              </div>
            </div>
          )
        })}
      </div>

      {toast && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 text-sm">{toast}</div>
      )}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-800 px-4 py-3 text-sm">
          {error} — ensure the <code>gnanova_agreements</code> table exists in Supabase.
        </div>
      )}

      {/* Agreements Table */}
      {loading ? (
        <div className="flex items-center justify-center py-24 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">All Agreements ({agreements.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Agreement #</th>
                  <th className="text-left px-4 py-3 font-medium">Customer</th>
                  <th className="text-left px-4 py-3 font-medium">Suite</th>
                  <th className="text-right px-4 py-3 font-medium">Total Price</th>
                  <th className="text-center px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Created</th>
                  <th className="text-right px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {agreements.map((agr) => (
                  <tr key={agr.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-mono text-sm font-medium text-blue-700">{agr.agreement_number}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{agr.customer_name}</div>
                      {agr.customer_phone && <div className="text-xs text-slate-400">{agr.customer_phone}</div>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{agr.suite_number || '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold">{fmt(agr.total_price)}</td>
                    <td className="px-4 py-3 text-center">
                      <select
                        value={agr.status}
                        onChange={(e) => void handleStatusChange(agr, e.target.value as AgreementStatus)}
                        className={`text-xs font-medium border rounded-full px-2 py-0.5 cursor-pointer ${STATUS_STYLE[agr.status]}`}
                      >
                        <option value="Draft">Draft</option>
                        <option value="Sent">Sent</option>
                        <option value="Signed">Signed</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{agr.created_at.split('T')[0]}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => handleDownload(agr)} title="Download PDF"
                          className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50">
                          <Download className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleWhatsApp(agr)} title="Send via WhatsApp"
                          className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50">
                          <MessageCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {agreements.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                      No agreements yet. Click "New Agreement" to generate one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-slate-900/50" onClick={closeModal} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl my-8">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <h2 className="font-semibold text-slate-900">
                  {step === 'form' ? 'New Agreement' : 'Preview Agreement'}
                </h2>
                <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs font-medium">
                  <button onClick={() => setStep('form')}
                    className={`px-3 py-1 rounded-md transition-colors ${step === 'form' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>
                    1 · Details
                  </button>
                  <button disabled={!previewAgr && step === 'form'}
                    onClick={() => previewAgr && setStep('preview')}
                    className={`px-3 py-1 rounded-md transition-colors ${step === 'preview' ? 'bg-white shadow text-slate-900' : 'text-slate-500 disabled:opacity-40'}`}>
                    2 · Preview
                  </button>
                </div>
              </div>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Step 1 — Form */}
            {step === 'form' && (
              <div className="p-5 space-y-5">
                {/* Customer Select */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Customer</label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Select existing customer</label>
                      <select
                        value={form.customer_name}
                        onChange={(e) => void handleCustomerSelect(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      >
                        <option value="">— Select customer —</option>
                        {customers.map((c: any) => (
                          <option key={c.customer_name} value={c.customer_name}>{c.customer_name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Or enter name manually</label>
                      <input value={form.customer_name} onChange={(e) => updateField('customer_name', e.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Full name" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Phone</label>
                      <input value={form.customer_phone} onChange={(e) => updateField('customer_phone', e.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="+971 50 000 0000" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Address</label>
                      <input value={form.customer_address} onChange={(e) => updateField('customer_address', e.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Dubai, UAE" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Aadhaar / Emirates ID</label>
                      <input value={form.customer_aadhaar} onChange={(e) => updateField('customer_aadhaar', e.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="784-XXXX-XXXXXXX-X" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">PAN / TRN</label>
                      <input value={form.customer_pan} onChange={(e) => updateField('customer_pan', e.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="100XXXXXXX00003" />
                    </div>
                  </div>
                </div>

                {/* Property */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Property</label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Suite Number</label>
                      <input value={form.suite_number} onChange={(e) => updateField('suite_number', e.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="A-101" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Floor</label>
                      <input value={form.floor} onChange={(e) => updateField('floor', e.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="3rd Floor" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Size (sq ft)</label>
                      <input type="number" value={form.size_sqft} onChange={(e) => updateField('size_sqft', e.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="850" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Possession Date</label>
                      <input type="date" value={form.possession_date} onChange={(e) => updateField('possession_date', e.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                    </div>
                  </div>
                </div>

                {/* Financials */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Financials</label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Total Price (AED) *</label>
                      <input required type="number" value={form.total_price} onChange={(e) => updateField('total_price', e.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="1000000" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Booking Amount (AED)</label>
                      <input type="number" value={form.booking_amount} onChange={(e) => updateField('booking_amount', e.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="100000" />
                    </div>
                  </div>
                </div>

                {/* Payment Schedule Preview */}
                {schedule.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      Payment Schedule (auto-loaded — {schedule.length} installments)
                    </label>
                    <div className="rounded-lg border border-slate-200 overflow-hidden max-h-40 overflow-y-auto">
                      <table className="min-w-full text-xs">
                        <thead className="bg-slate-50 sticky top-0">
                          <tr>
                            <th className="text-left px-3 py-1.5 font-medium text-slate-600">#</th>
                            <th className="text-left px-3 py-1.5 font-medium text-slate-600">Due Date</th>
                            <th className="text-right px-3 py-1.5 font-medium text-slate-600">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {schedule.map((r) => (
                            <tr key={r.installment} className="border-t border-slate-100">
                              <td className="px-3 py-1 text-slate-600">{r.installment}</td>
                              <td className="px-3 py-1 text-slate-600">{r.due_date}</td>
                              <td className="px-3 py-1 text-right tabular-nums">{fmt(r.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button onClick={handlePreview}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800">
                    Preview Agreement →
                  </button>
                  <button onClick={closeModal}
                    className="px-4 py-2.5 rounded-lg border border-slate-200 text-sm hover:bg-slate-50">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Step 2 — Preview */}
            {step === 'preview' && previewAgr && (
              <div className="p-5 space-y-4">
                {/* Mini summary card */}
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-slate-500 text-xs">Agreement #</span><br /><span className="font-mono font-semibold text-blue-700">{previewAgr.agreement_number}</span></div>
                  <div><span className="text-slate-500 text-xs">Customer</span><br /><span className="font-semibold">{previewAgr.customer_name}</span></div>
                  <div><span className="text-slate-500 text-xs">Suite</span><br /><span>{previewAgr.suite_number || '—'}</span></div>
                  <div><span className="text-slate-500 text-xs">Floor / Size</span><br /><span>{[previewAgr.floor, previewAgr.size_sqft ? `${previewAgr.size_sqft} sqft` : null].filter(Boolean).join(' · ') || '—'}</span></div>
                  <div><span className="text-slate-500 text-xs">Total Price</span><br /><span className="font-bold text-emerald-700">{fmt(previewAgr.total_price)}</span></div>
                  <div><span className="text-slate-500 text-xs">Booking Paid</span><br /><span>{fmt(previewAgr.booking_amount)}</span></div>
                  <div><span className="text-slate-500 text-xs">Possession</span><br /><span>{previewAgr.possession_date || '—'}</span></div>
                  <div><span className="text-slate-500 text-xs">Installments</span><br /><span>{previewAgr.payment_schedule?.length ?? 0}</span></div>
                </div>

                <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
                  PDF will include: Customer details, property info, financial summary, payment schedule, T&C, and signature fields.
                </div>

                <div className="flex gap-2">
                  <button onClick={() => void handleSave()} disabled={saving}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    Save & Download PDF
                  </button>
                  <button onClick={() => setStep('form')}
                    className="px-4 py-2.5 rounded-lg border border-slate-200 text-sm hover:bg-slate-50">
                    ← Edit
                  </button>
                  <button onClick={closeModal}
                    className="px-4 py-2.5 rounded-lg border border-slate-200 text-sm hover:bg-slate-50">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

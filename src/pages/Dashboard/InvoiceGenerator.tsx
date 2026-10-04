import React, { useCallback, useEffect, useState } from 'react'
import { Download, FileText, Loader2, MessageCircle, Plus, RefreshCw, X } from 'lucide-react'
import { jsPDF } from 'jspdf'
import { supabase } from '../../lib/supabase'
import { whatsappLink } from '../../lib/payment-tracker'

interface InvoiceRecord {
  id: string
  invoice_number: string
  customer_name: string
  customer_phone: string | null
  suite_number: string | null
  amount: number
  payment_date: string
  utr_number: string | null
  payment_method: string | null
  created_at: string
}

function nextInvoiceNumber(existing: InvoiceRecord[]): string {
  const nums = existing.map((r) => parseInt(r.invoice_number.replace(/\D/g, '') || '0')).filter(Boolean)
  const next = nums.length ? Math.max(...nums) + 1 : 1001
  return `GNV-${String(next).padStart(4, '0')}`
}

function generatePDF(inv: InvoiceRecord): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = 210
  const margin = 20

  // Header band
  doc.setFillColor(15, 23, 42)
  doc.rect(0, 0, W, 40, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text('GNANOVA', margin, 18)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Real Estate & Property Management', margin, 25)
  doc.setFontSize(8)
  doc.text('Dubai, UAE  |  info@gnanova.com', margin, 32)

  // Invoice label
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text('RECEIPT', W - margin, 22, { align: 'right' })
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(inv.invoice_number, W - margin, 30, { align: 'right' })

  // Body
  doc.setTextColor(15, 23, 42)
  let y = 56

  // Bill To box
  doc.setFillColor(248, 250, 252)
  doc.roundedRect(margin, y, 80, 32, 2, 2, 'F')
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(100, 116, 139)
  doc.text('BILLED TO', margin + 4, y + 7)
  doc.setTextColor(15, 23, 42)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text(inv.customer_name, margin + 4, y + 15)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  if (inv.customer_phone) doc.text(inv.customer_phone, margin + 4, y + 22)
  if (inv.suite_number) doc.text(`Suite: ${inv.suite_number}`, margin + 4, y + 29)

  // Details box
  doc.setFillColor(248, 250, 252)
  doc.roundedRect(W - margin - 80, y, 80, 32, 2, 2, 'F')
  const dx = W - margin - 80 + 4
  const details = [
    ['Date', inv.payment_date],
    ['Method', inv.payment_method || 'Bank Transfer'],
    ['UTR / Ref', inv.utr_number || '—'],
  ]
  doc.setFontSize(8)
  details.forEach(([k, v], i) => {
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(100, 116, 139)
    doc.text(k, dx, y + 7 + i * 8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(15, 23, 42)
    doc.text(v, dx + 28, y + 7 + i * 8)
  })

  y += 44

  // Table header
  doc.setFillColor(15, 23, 42)
  doc.rect(margin, y, W - 2 * margin, 9, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('Description', margin + 4, y + 6)
  doc.text('Amount (INR)', W - margin - 4, y + 6, { align: 'right' })

  y += 9

  // Table row
  doc.setFillColor(255, 255, 255)
  doc.rect(margin, y, W - 2 * margin, 12, 'F')
  doc.setTextColor(15, 23, 42)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  const desc = inv.suite_number
    ? `Payment for Suite ${inv.suite_number} — Installment`
    : 'Property Payment — Installment'
  doc.text(desc, margin + 4, y + 8)
  doc.setFont('helvetica', 'bold')
  doc.text(
    inv.amount.toLocaleString('en-AE', { minimumFractionDigits: 2 }),
    W - margin - 4,
    y + 8,
    { align: 'right' }
  )

  y += 12
  doc.setDrawColor(226, 232, 240)
  doc.line(margin, y, W - margin, y)

  // Total
  y += 12
  doc.setFillColor(15, 23, 42)
  doc.roundedRect(W - margin - 70, y - 4, 70, 14, 2, 2, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('TOTAL PAID', W - margin - 66, y + 6)
  doc.text(
    `INR ${inv.amount.toLocaleString('en-AE', { minimumFractionDigits: 2 })}`,
    W - margin - 4,
    y + 6,
    { align: 'right' }
  )

  // Footer
  y = 265
  doc.setDrawColor(226, 232, 240)
  doc.line(margin, y, W - margin, y)
  doc.setTextColor(100, 116, 139)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text('Thank you for your payment. This is a computer-generated receipt and requires no signature.', W / 2, y + 8, { align: 'center' })
  doc.text('Gnanova Real Estate — Dubai, UAE', W / 2, y + 14, { align: 'center' })

  return doc
}

export default function InvoiceGeneratorPage() {
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  const [fCustomer, setFCustomer] = useState('')
  const [fPhone, setFPhone] = useState('')
  const [fSuite, setFSuite] = useState('')
  const [fAmount, setFAmount] = useState('')
  const [fDate, setFDate] = useState(new Date().toISOString().split('T')[0])
  const [fUtr, setFUtr] = useState('')
  const [fMethod, setFMethod] = useState('Bank Transfer')

  const showToast = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 4000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('gnanova_invoices')
        .select('*')
        .order('created_at', { ascending: false })
      if (err) throw new Error(err.message)
      setInvoices((data ?? []) as InvoiceRecord[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load invoices')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  function handleDownload(inv: InvoiceRecord) {
    const doc = generatePDF(inv)
    doc.save(`${inv.invoice_number}.pdf`)
  }

  function handleWhatsApp(inv: InvoiceRecord) {
    if (!inv.customer_phone) { showToast('No phone number'); return }
    const msg = `Hi ${inv.customer_name}, please find your payment receipt ${inv.invoice_number} for INR ${inv.amount.toLocaleString()} paid on ${inv.payment_date}. Thank you — Gnanova Real Estate.`
    window.open(whatsappLink(inv.customer_phone, msg), '_blank')
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!fCustomer || !fAmount || !fDate) { showToast('Fill required fields'); return }
    setSaving(true)
    try {
      const invoice_number = nextInvoiceNumber(invoices)
      const { error: err } = await supabase.from('gnanova_invoices').insert({
        invoice_number,
        customer_name: fCustomer,
        customer_phone: fPhone || null,
        suite_number: fSuite || null,
        amount: parseFloat(fAmount),
        payment_date: fDate,
        utr_number: fUtr || null,
        payment_method: fMethod || null,
      })
      if (err) throw new Error(err.message)
      showToast(`Invoice ${invoice_number} created`)
      setShowForm(false)
      setFCustomer(''); setFPhone(''); setFSuite(''); setFAmount('')
      setFDate(new Date().toISOString().split('T')[0]); setFUtr(''); setFMethod('Bank Transfer')
      await load()
      // Auto-download
      const fresh = await supabase.from('gnanova_invoices').select('*').eq('invoice_number', invoice_number).single()
      if (fresh.data) handleDownload(fresh.data as InvoiceRecord)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-6 h-6" /> Invoice Generator
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Generate and send payment receipts</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => void load()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800">
            <Plus className="w-4 h-4" /> New Invoice
          </button>
        </div>
      </div>

      {toast && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 text-sm">{toast}</div>
      )}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-800 px-4 py-3 text-sm">
          {error} — ensure the <code>gnanova_invoices</code> table exists in Supabase.
        </div>
      )}

      {/* Invoice List */}
      {loading ? (
        <div className="flex items-center justify-center py-24 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading invoices…
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">All Invoices ({invoices.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Invoice #</th>
                  <th className="text-left px-4 py-3 font-medium">Customer</th>
                  <th className="text-left px-4 py-3 font-medium">Suite</th>
                  <th className="text-right px-4 py-3 font-medium">Amount (INR)</th>
                  <th className="text-left px-4 py-3 font-medium">Date</th>
                  <th className="text-left px-4 py-3 font-medium">UTR</th>
                  <th className="text-right px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-mono text-sm font-medium text-blue-700">{inv.invoice_number}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <div>{inv.customer_name}</div>
                      {inv.customer_phone && <div className="text-xs text-slate-400">{inv.customer_phone}</div>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{inv.suite_number || '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold">
                      {inv.amount.toLocaleString('en-AE', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{inv.payment_date}</td>
                    <td className="px-4 py-3 text-slate-500 max-w-[120px] truncate">{inv.utr_number || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleDownload(inv)}
                          title="Download PDF"
                          className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleWhatsApp(inv)}
                          title="Send via WhatsApp"
                          className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {invoices.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                      No invoices yet. Click "New Invoice" to generate one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Invoice Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setShowForm(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Generate Invoice</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={(e) => void handleSave(e)} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Customer Name *</label>
                  <input required value={fCustomer} onChange={(e) => setFCustomer(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Mohammed Al Rashid" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
                  <input value={fPhone} onChange={(e) => setFPhone(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="+971 50 000 0000" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Suite Number</label>
                  <input value={fSuite} onChange={(e) => setFSuite(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="A-101" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Amount (INR) *</label>
                  <input required type="number" min="0" step="0.01" value={fAmount} onChange={(e) => setFAmount(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="50000" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Payment Date *</label>
                  <input required type="date" value={fDate} onChange={(e) => setFDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">UTR / Reference</label>
                  <input value={fUtr} onChange={(e) => setFUtr(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="TXN123456" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Payment Method</label>
                  <select value={fMethod} onChange={(e) => setFMethod(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                    <option>Bank Transfer</option>
                    <option>Cash</option>
                    <option>Cheque</option>
                    <option>Credit Card</option>
                    <option>Crypto</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                  Generate & Download
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-4 py-2.5 rounded-lg border border-slate-200 text-sm hover:bg-slate-50">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

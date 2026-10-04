import React, { useState } from 'react'
import { FileText, Download, Send, Receipt, Eye } from 'lucide-react'

type Tab = 'agreement' | 'receipt'

function formatDate(d: string) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
}

function genReceiptNo() {
  return `VSR-REC-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`
}

function printAgreement(f: typeof AGREEMENT_DEFAULT) {
  const win = window.open('', '_blank')
  if (!win) return
  const rows = f.installments.map((inst, i) =>
    `<tr><td>${i + 1}</td><td>${inst.label}</td><td>₹${Number(inst.amount).toLocaleString()}</td><td>${inst.due_date}</td></tr>`
  ).join('')
  win.document.write(`<!DOCTYPE html><html><head><title>Suite Agreement</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; color: #1e293b; padding: 40px; }
    h1 { text-align: center; font-size: 18px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 4px; }
    .subtitle { text-align: center; font-size: 14px; color: #475569; margin-bottom: 32px; }
    .section { margin-bottom: 20px; }
    .section-title { font-weight: bold; font-size: 13px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px; color: #7c3aed; }
    .row { display: flex; gap: 32px; margin-bottom: 6px; }
    .label { color: #64748b; min-width: 160px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { background: #f8fafc; text-align: left; padding: 8px; font-size: 11px; text-transform: uppercase; color: #475569; border-bottom: 2px solid #e2e8f0; }
    td { padding: 8px; border-bottom: 1px solid #f1f5f9; }
    .terms { background: #f8fafc; padding: 16px; border-radius: 8px; font-size: 11px; color: #475569; line-height: 1.6; }
    .sig { display: flex; justify-content: space-between; margin-top: 60px; }
    .sig-block { text-align: center; width: 200px; }
    .sig-line { border-top: 1px solid #334155; padding-top: 4px; margin-top: 48px; font-size: 11px; color: #64748b; }
    .stamp { text-align: center; margin: 20px 0; }
    @media print { body { padding: 20px; } }
  </style></head><body>
  <h1>${f.project_name}</h1>
  <p class="subtitle">Suite Purchase Agreement</p>
  <div class="section">
    <div class="section-title">Buyer Details</div>
    <div class="row"><span class="label">Name:</span><span>${f.buyer_name}</span></div>
    <div class="row"><span class="label">Phone:</span><span>${f.buyer_phone}</span></div>
    <div class="row"><span class="label">Email:</span><span>${f.buyer_email}</span></div>
    <div class="row"><span class="label">Address:</span><span>${f.buyer_address}</span></div>
  </div>
  <div class="section">
    <div class="section-title">Property Details</div>
    <div class="row"><span class="label">Suite Number:</span><span>${f.suite_number}</span></div>
    <div class="row"><span class="label">Floor:</span><span>${f.floor}</span></div>
    <div class="row"><span class="label">Area:</span><span>${f.area} sq ft</span></div>
    <div class="row"><span class="label">Total Price:</span><span>₹${Number(f.total_price).toLocaleString()}</span></div>
    <div class="row"><span class="label">Booking Amount:</span><span>₹${Number(f.booking_amount).toLocaleString()}</span></div>
    <div class="row"><span class="label">Agreement Date:</span><span>${formatDate(f.agreement_date)}</span></div>
  </div>
  <div class="section">
    <div class="section-title">Payment Schedule</div>
    <table><thead><tr><th>#</th><th>Milestone</th><th>Amount</th><th>Due Date</th></tr></thead>
    <tbody>${rows}</tbody></table>
  </div>
  <div class="section">
    <div class="section-title">Terms &amp; Conditions</div>
    <div class="terms">
      1. The booking amount is non-refundable once the agreement is executed.<br/>
      2. All payments shall be made as per the schedule above. Late payments attract 2% per month interest.<br/>
      3. The suite will be handed over upon receipt of full payment and completion of all formalities.<br/>
      4. Any dispute arising out of this agreement shall be subject to the jurisdiction of Tirupathi courts.<br/>
      5. The developer reserves the right to make minor variations in the specifications without prior notice.<br/>
      6. GST and other applicable taxes will be charged as per prevailing government regulations.
    </div>
  </div>
  <div class="sig">
    <div class="sig-block"><div class="sig-line">Buyer Signature<br/>${f.buyer_name}</div></div>
    <div class="sig-block"><div class="sig-line">Authorized Signatory<br/>${f.developer_name}</div></div>
  </div>
  <script>window.print()</script></body></html>`)
  win.document.close()
}

function printReceipt(f: typeof RECEIPT_DEFAULT) {
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(`<!DOCTYPE html><html><head><title>Payment Receipt</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; color: #1e293b; padding: 40px; max-width: 600px; margin: 0 auto; }
    h1 { text-align: center; font-size: 18px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 4px; }
    .subtitle { text-align: center; font-size: 20px; font-weight: bold; color: #7c3aed; margin-bottom: 4px; }
    .receipt-no { text-align: center; font-size: 11px; color: #64748b; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; }
    td:first-child { color: #64748b; width: 160px; }
    td:last-child { font-weight: 600; }
    .amount-box { background: linear-gradient(135deg, #7c3aed, #4338ca); color: white; padding: 20px; border-radius: 12px; text-align: center; margin: 20px 0; }
    .amount-box .label { font-size: 12px; opacity: 0.8; }
    .amount-box .value { font-size: 28px; font-weight: bold; }
    .thank-you { text-align: center; color: #475569; font-size: 13px; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; }
    .sig { text-align: right; margin-top: 40px; }
    .sig-line { display: inline-block; text-align: center; border-top: 1px solid #334155; padding-top: 4px; font-size: 11px; color: #64748b; width: 180px; margin-top: 48px; }
    @media print { body { padding: 20px; } }
  </style></head><body>
  <h1>Venkateswara Suite Rooms</h1>
  <p class="subtitle">PAYMENT RECEIPT</p>
  <p class="receipt-no">Receipt No: ${f.receipt_no} &nbsp;|&nbsp; Date: ${formatDate(f.paid_date)}</p>
  <table>
    <tr><td>Customer Name</td><td>${f.buyer_name}</td></tr>
    <tr><td>Phone</td><td>${f.buyer_phone}</td></tr>
    <tr><td>Reference</td><td>${f.reference}</td></tr>
    <tr><td>Payment Method</td><td>${f.payment_method}</td></tr>
    <tr><td>UTR / Reference No.</td><td>${f.utr}</td></tr>
    <tr><td>Payment Date</td><td>${formatDate(f.paid_date)}</td></tr>
  </table>
  <div class="amount-box">
    <div class="label">Amount Received</div>
    <div class="value">₹${Number(f.amount).toLocaleString()}</div>
  </div>
  <p class="thank-you">Thank you for your payment! We appreciate your trust in Venkateswara Suite Rooms.</p>
  <div class="sig"><div class="sig-line">Authorized Signatory</div></div>
  <script>window.print()</script></body></html>`)
  win.document.close()
}

const AGREEMENT_DEFAULT = {
  buyer_name: '',
  buyer_phone: '',
  buyer_email: '',
  buyer_address: '',
  suite_number: '',
  floor: '',
  area: '',
  total_price: '',
  booking_amount: '',
  agreement_date: new Date().toISOString().slice(0, 10),
  project_name: 'Venkateswara Suite Rooms',
  developer_name: 'VSR Developers',
  installments: [
    { label: 'Booking Amount', amount: '', due_date: new Date().toISOString().slice(0, 10) },
    { label: 'On Slab Completion', amount: '', due_date: '' },
    { label: 'On Handover', amount: '', due_date: '' },
  ],
}

const RECEIPT_DEFAULT = {
  receipt_no: genReceiptNo(),
  buyer_name: '',
  buyer_phone: '',
  amount: '',
  paid_date: new Date().toISOString().slice(0, 10),
  payment_method: 'UPI',
  utr: '',
  reference: '',
}

export default function DocumentGenerator() {
  const [tab, setTab] = useState<Tab>('agreement')
  const [agreement, setAgreement] = useState(AGREEMENT_DEFAULT)
  const [receipt, setReceipt] = useState(RECEIPT_DEFAULT)

  function updateAgreement(field: string, value: string) {
    setAgreement(a => ({ ...a, [field]: value }))
  }

  function updateInstallment(i: number, field: string, value: string) {
    setAgreement(a => {
      const insts = [...a.installments]
      insts[i] = { ...insts[i], [field]: value }
      return { ...a, installments: insts }
    })
  }

  function addInstallment() {
    setAgreement(a => ({ ...a, installments: [...a.installments, { label: '', amount: '', due_date: '' }] }))
  }

  function shareWhatsApp(type: Tab) {
    const msg = type === 'agreement'
      ? `Hi ${agreement.buyer_name}, please find your Suite Purchase Agreement for ${agreement.suite_number}. Total: ₹${Number(agreement.total_price).toLocaleString()}. Contact us at +91 9948114343 for any queries.`
      : `Payment Receipt ✅\nName: ${receipt.buyer_name}\nAmount: ₹${Number(receipt.amount).toLocaleString()}\nDate: ${formatDate(receipt.paid_date)}\nRef: ${receipt.utr}\nThank you!`
    const phone = (type === 'agreement' ? agreement.buyer_phone : receipt.buyer_phone).replace(/\D/g, '')
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Document Generator</h1>
        <p className="text-slate-500 text-sm mt-1">Generate agreements and payment receipts</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        <button onClick={() => setTab('agreement')} className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-all ${tab === 'agreement' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <FileText className="w-4 h-4" /> Suite Agreement
        </button>
        <button onClick={() => setTab('receipt')} className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-all ${tab === 'receipt' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <Receipt className="w-4 h-4" /> Payment Receipt
        </button>
      </div>

      {tab === 'agreement' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-800 mb-4">Buyer Details</h3>
              <div className="space-y-3">
                {[
                  { label: 'Buyer Name *', field: 'buyer_name', placeholder: 'Full name' },
                  { label: 'Phone *', field: 'buyer_phone', placeholder: '+91 XXXXX XXXXX' },
                  { label: 'Email', field: 'buyer_email', placeholder: 'email@example.com' },
                  { label: 'Address', field: 'buyer_address', placeholder: 'Full address' },
                ].map(({ label, field, placeholder }) => (
                  <div key={field}>
                    <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
                    <input value={(agreement as any)[field]} onChange={e => updateAgreement(field, e.target.value)} placeholder={placeholder} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-800 mb-4">Property Details</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Suite No.', field: 'suite_number', placeholder: '101' },
                  { label: 'Floor', field: 'floor', placeholder: '1' },
                  { label: 'Area (sq ft)', field: 'area', placeholder: '450' },
                  { label: 'Agreement Date', field: 'agreement_date', placeholder: '', type: 'date' },
                  { label: 'Total Price (₹)', field: 'total_price', placeholder: '2500000' },
                  { label: 'Booking Amount (₹)', field: 'booking_amount', placeholder: '250000' },
                ].map(({ label, field, placeholder, type }) => (
                  <div key={field}>
                    <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
                    <input type={type || 'text'} value={(agreement as any)[field]} onChange={e => updateAgreement(field, e.target.value)} placeholder={placeholder} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-800">Payment Schedule</h3>
                <button onClick={addInstallment} className="text-xs text-amber-600 hover:underline">+ Add row</button>
              </div>
              <div className="space-y-2">
                {agreement.installments.map((inst, i) => (
                  <div key={i} className="grid grid-cols-3 gap-2">
                    <input value={inst.label} onChange={e => updateInstallment(i, 'label', e.target.value)} placeholder="Milestone" className="px-2 py-1.5 border border-slate-200 rounded text-xs" />
                    <input type="number" value={inst.amount} onChange={e => updateInstallment(i, 'amount', e.target.value)} placeholder="₹ Amount" className="px-2 py-1.5 border border-slate-200 rounded text-xs" />
                    <input type="date" value={inst.due_date} onChange={e => updateInstallment(i, 'due_date', e.target.value)} className="px-2 py-1.5 border border-slate-200 rounded text-xs" />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => printAgreement(agreement)} className="flex-1 py-3 bg-slate-900 text-white rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-slate-800">
                <Eye className="w-4 h-4" /> Preview &amp; Print
              </button>
              <button onClick={() => shareWhatsApp('agreement')} className="flex-1 py-3 bg-green-600 text-white rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-green-700">
                <Send className="w-4 h-4" /> WhatsApp
              </button>
            </div>
          </div>

          {/* Live Preview Card */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 hidden lg:block">
            <h3 className="font-semibold text-slate-700 mb-4 text-sm uppercase tracking-wide">Preview</h3>
            <div className="space-y-3 text-sm">
              <div className="text-center pb-3 border-b border-slate-200">
                <p className="font-bold text-lg text-slate-900">{agreement.project_name}</p>
                <p className="text-slate-500 text-xs uppercase tracking-widest">Suite Purchase Agreement</p>
              </div>
              {agreement.buyer_name && <div className="flex justify-between"><span className="text-slate-500">Buyer</span><span className="font-medium">{agreement.buyer_name}</span></div>}
              {agreement.suite_number && <div className="flex justify-between"><span className="text-slate-500">Suite</span><span className="font-medium">{agreement.suite_number} (Floor {agreement.floor})</span></div>}
              {agreement.total_price && <div className="flex justify-between"><span className="text-slate-500">Total Price</span><span className="font-bold text-purple-700">₹{Number(agreement.total_price).toLocaleString()}</span></div>}
              {agreement.agreement_date && <div className="flex justify-between"><span className="text-slate-500">Date</span><span className="font-medium">{formatDate(agreement.agreement_date)}</span></div>}
              {agreement.installments.some(i => i.amount) && (
                <div>
                  <p className="text-slate-500 text-xs mb-2">Payment Schedule</p>
                  {agreement.installments.filter(i => i.label).map((inst, i) => (
                    <div key={i} className="flex justify-between text-xs py-1 border-b border-slate-100">
                      <span>{inst.label}</span>
                      <span className="font-medium">₹{Number(inst.amount || 0).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'receipt' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <h3 className="font-semibold text-slate-800">Receipt Details</h3>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Receipt No.</label>
              <input value={receipt.receipt_no} onChange={e => setReceipt(r => ({ ...r, receipt_no: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Buyer Name *', field: 'buyer_name', placeholder: 'Full name' },
                { label: 'Phone *', field: 'buyer_phone', placeholder: '+91 XXXXX XXXXX' },
              ].map(({ label, field, placeholder }) => (
                <div key={field}>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
                  <input value={(receipt as any)[field]} onChange={e => setReceipt(r => ({ ...r, [field]: e.target.value }))} placeholder={placeholder} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                </div>
              ))}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Amount (₹) *</label>
              <input type="number" value={receipt.amount} onChange={e => setReceipt(r => ({ ...r, amount: e.target.value }))} placeholder="250000" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Payment Date</label>
                <input type="date" value={receipt.paid_date} onChange={e => setReceipt(r => ({ ...r, paid_date: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Method</label>
                <select value={receipt.payment_method} onChange={e => setReceipt(r => ({ ...r, payment_method: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                  <option>UPI</option><option>Bank Transfer</option><option>Cash</option><option>Cheque</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">UTR / Reference No.</label>
              <input value={receipt.utr} onChange={e => setReceipt(r => ({ ...r, utr: e.target.value }))} placeholder="UTR123456789" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Suite / Membership Reference</label>
              <input value={receipt.reference} onChange={e => setReceipt(r => ({ ...r, reference: e.target.value }))} placeholder="Suite 101 / VSR-2025-001" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => printReceipt(receipt)} className="flex-1 py-3 bg-slate-900 text-white rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-slate-800">
                <Eye className="w-4 h-4" /> Preview &amp; Print
              </button>
              <button onClick={() => shareWhatsApp('receipt')} className="flex-1 py-3 bg-green-600 text-white rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-green-700">
                <Send className="w-4 h-4" /> WhatsApp
              </button>
            </div>
          </div>

          {/* Receipt Preview */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 hidden lg:block">
            <h3 className="font-semibold text-slate-700 mb-4 text-sm uppercase tracking-wide">Preview</h3>
            <div className="space-y-3 text-sm">
              <div className="text-center pb-3 border-b border-slate-200">
                <p className="font-bold text-lg text-slate-900">Venkateswara Suite Rooms</p>
                <p className="text-slate-500 text-xs uppercase tracking-widest">Payment Receipt</p>
                <p className="text-slate-400 text-xs mt-1">{receipt.receipt_no}</p>
              </div>
              {receipt.buyer_name && <div className="flex justify-between"><span className="text-slate-500">Customer</span><span className="font-medium">{receipt.buyer_name}</span></div>}
              {receipt.paid_date && <div className="flex justify-between"><span className="text-slate-500">Date</span><span className="font-medium">{formatDate(receipt.paid_date)}</span></div>}
              {receipt.payment_method && <div className="flex justify-between"><span className="text-slate-500">Method</span><span className="font-medium">{receipt.payment_method}</span></div>}
              {receipt.utr && <div className="flex justify-between"><span className="text-slate-500">UTR</span><span className="font-mono text-xs font-medium">{receipt.utr}</span></div>}
              {receipt.amount && (
                <div className="bg-gradient-to-r from-purple-600 to-indigo-700 rounded-xl p-4 text-white text-center mt-4">
                  <p className="text-xs opacity-80 uppercase tracking-wide">Amount Received</p>
                  <p className="text-2xl font-bold mt-1">₹{Number(receipt.amount).toLocaleString()}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

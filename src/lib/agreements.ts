import { supabase } from './supabase'
import { jsPDF } from 'jspdf'

export type AgreementStatus = 'Draft' | 'Sent' | 'Signed'

export interface Agreement {
  id: string
  agreement_number: string
  status: AgreementStatus
  customer_name: string
  customer_address: string | null
  customer_aadhaar: string | null
  customer_pan: string | null
  customer_phone: string | null
  suite_number: string | null
  floor: string | null
  size_sqft: number | null
  total_price: number
  booking_amount: number
  possession_date: string | null
  payment_schedule: { installment: number; due_date: string; amount: number }[]
  created_at: string
  sent_at: string | null
  signed_at: string | null
}

export async function fetchAgreements(): Promise<Agreement[]> {
  const { data, error } = await supabase
    .from('gnanova_agreements')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as Agreement[]
}

export async function fetchCustomersForAgreement() {
  const { data } = await supabase
    .from('payments')
    .select('customer_name, customer_phone, suite_number, total_price, booking_amount, due_date, installment_number, installment_amount')
    .order('customer_name')
  // Deduplicate by customer_name
  const seen = new Set<string>()
  const unique: typeof data = []
  ;(data ?? []).forEach((r: any) => {
    if (!seen.has(r.customer_name)) {
      seen.add(r.customer_name)
      unique.push(r)
    }
  })
  return unique ?? []
}

export async function fetchPaymentScheduleForCustomer(customerName: string) {
  const { data } = await supabase
    .from('payments')
    .select('installment_number, due_date, installment_amount')
    .eq('customer_name', customerName)
    .order('installment_number')
  return (data ?? []).map((r: any) => ({
    installment: r.installment_number,
    due_date: r.due_date,
    amount: r.installment_amount,
  }))
}

export async function saveAgreement(
  data: Omit<Agreement, 'id' | 'created_at' | 'sent_at' | 'signed_at'>
): Promise<Agreement> {
  const { data: row, error } = await supabase
    .from('gnanova_agreements')
    .insert({ ...data, payment_schedule: JSON.stringify(data.payment_schedule) })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return row as Agreement
}

export async function updateAgreementStatus(id: string, status: AgreementStatus): Promise<void> {
  const update: Record<string, string> = { status }
  if (status === 'Sent') update.sent_at = new Date().toISOString()
  if (status === 'Signed') update.signed_at = new Date().toISOString()
  const { error } = await supabase.from('gnanova_agreements').update(update).eq('id', id)
  if (error) throw new Error(error.message)
}

function nextAgreementNumber(existing: Agreement[]): string {
  const nums = existing.map((r) => parseInt(r.agreement_number.replace(/\D/g, '') || '0')).filter(Boolean)
  const next = nums.length ? Math.max(...nums) + 1 : 5001
  return `GNV-AGR-${String(next).padStart(4, '0')}`
}

export function buildAgreementNumber(existing: Agreement[]): string {
  return nextAgreementNumber(existing)
}

const TERMS = [
  'The Purchaser has agreed to purchase the above mentioned Suite at the price and terms stated herein.',
  'The Booking Amount is non-refundable in case of cancellation by the Purchaser.',
  'The remaining payment shall be made as per the Payment Schedule attached hereto.',
  'Possession of the Suite shall be handed over to the Purchaser upon receipt of full payment.',
  'All disputes arising out of this Agreement shall be subject to the jurisdiction of Dubai Courts.',
  'The Seller reserves the right to alter the internal layout of the Suite without prior notice, provided the carpet area remains unchanged.',
  'Registration charges, transfer fees, and all government levies shall be borne by the Purchaser.',
  'This Agreement shall be construed and governed by the laws of the United Arab Emirates.',
]

export function generateAgreementPDF(agr: Agreement): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = 210
  const M = 20
  const LINE_H = 7

  // ── Header band ──
  doc.setFillColor(15, 23, 42)
  doc.rect(0, 0, W, 36, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text('GNANOVA', M, 16)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('Real Estate & Property Management  |  Dubai, UAE', M, 23)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('SALE AGREEMENT', W - M, 16, { align: 'right' })
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(agr.agreement_number, W - M, 23, { align: 'right' })
  const statusColors: Record<string, [number, number, number]> = {
    Draft: [245, 158, 11], Sent: [59, 130, 246], Signed: [16, 185, 129],
  }
  const [sr, sg, sb] = statusColors[agr.status] ?? [100, 116, 139]
  doc.setFillColor(sr, sg, sb)
  doc.roundedRect(W - M - 22, 27, 22, 7, 1, 1, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.text(agr.status.toUpperCase(), W - M - 11, 32, { align: 'center' })

  let y = 46
  doc.setTextColor(15, 23, 42)

  // ── Section helper ──
  const sectionTitle = (title: string) => {
    doc.setFillColor(241, 245, 249)
    doc.rect(M, y, W - 2 * M, 7, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(71, 85, 105)
    doc.text(title.toUpperCase(), M + 3, y + 5)
    doc.setTextColor(15, 23, 42)
    y += 10
  }

  const field = (label: string, value: string, x = M, width = (W - 2 * M) / 2) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(100, 116, 139)
    doc.text(label, x + 2, y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(15, 23, 42)
    doc.setFontSize(10)
    doc.text(value || '—', x + 2, y + 5)
    return y + LINE_H
  }

  // ── Purchaser Details ──
  sectionTitle('1. Purchaser Details')
  const halfW = (W - 2 * M) / 2
  const col2 = M + halfW + 4

  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(100, 116, 139)
  doc.text('Full Name', M + 2, y); doc.text('Phone', col2, y)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(15, 23, 42)
  doc.text(agr.customer_name, M + 2, y + 5); doc.text(agr.customer_phone || '—', col2, y + 5)
  y += LINE_H + 2

  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(100, 116, 139)
  doc.text('Address', M + 2, y); doc.text('Aadhaar / Emirates ID', col2, y)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(15, 23, 42)
  const addrLines = doc.splitTextToSize(agr.customer_address || '—', halfW - 4)
  doc.text(addrLines, M + 2, y + 5)
  doc.text(agr.customer_aadhaar || '—', col2, y + 5)
  y += LINE_H + 2

  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(100, 116, 139)
  doc.text('PAN / TRN', M + 2, y)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(15, 23, 42)
  doc.text(agr.customer_pan || '—', M + 2, y + 5)
  y += LINE_H + 4

  // ── Property Details ──
  sectionTitle('2. Property Details')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(100, 116, 139)
  doc.text('Suite Number', M + 2, y); doc.text('Floor', col2, y)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(15, 23, 42)
  doc.text(agr.suite_number || '—', M + 2, y + 5); doc.text(agr.floor || '—', col2, y + 5)
  y += LINE_H + 2

  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(100, 116, 139)
  doc.text('Size (sq ft)', M + 2, y); doc.text('Possession Date', col2, y)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(15, 23, 42)
  doc.text(agr.size_sqft ? `${agr.size_sqft.toLocaleString()} sq ft` : '—', M + 2, y + 5)
  doc.text(agr.possession_date || '—', col2, y + 5)
  y += LINE_H + 4

  // ── Financial Summary ──
  sectionTitle('3. Financial Summary')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(100, 116, 139)
  doc.text('Total Price', M + 2, y); doc.text('Booking Amount Paid', col2, y)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(15, 23, 42)
  doc.text(`INR ${agr.total_price.toLocaleString('en-AE', { minimumFractionDigits: 2 })}`, M + 2, y + 6)
  doc.text(`INR ${agr.booking_amount.toLocaleString('en-AE', { minimumFractionDigits: 2 })}`, col2, y + 6)
  y += 12

  // ── Payment Schedule ──
  if (agr.payment_schedule?.length) {
    sectionTitle('4. Payment Schedule')
    // Table header
    doc.setFillColor(15, 23, 42)
    doc.rect(M, y, W - 2 * M, 7, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text('#', M + 4, y + 5)
    doc.text('Due Date', M + 20, y + 5)
    doc.text('Amount (INR)', W - M - 4, y + 5, { align: 'right' })
    y += 7

    const schedule = Array.isArray(agr.payment_schedule)
      ? agr.payment_schedule
      : JSON.parse(agr.payment_schedule as unknown as string ?? '[]')

    schedule.forEach((row: { installment: number; due_date: string; amount: number }, i: number) => {
      if (y > 250) {
        doc.addPage()
        y = 20
      }
      doc.setFillColor(i % 2 === 0 ? 248 : 255, i % 2 === 0 ? 250 : 255, i % 2 === 0 ? 252 : 255)
      doc.rect(M, y, W - 2 * M, 6, 'F')
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(15, 23, 42)
      doc.text(String(row.installment), M + 4, y + 4.5)
      doc.text(row.due_date, M + 20, y + 4.5)
      doc.text(
        row.amount.toLocaleString('en-AE', { minimumFractionDigits: 2 }),
        W - M - 4, y + 4.5, { align: 'right' }
      )
      y += 6
    })

    // Total row
    const total = schedule.reduce((s: number, r: { amount: number }) => s + r.amount, 0)
    doc.setFillColor(15, 23, 42)
    doc.rect(M, y, W - 2 * M, 7, 'F')
    doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255); doc.setFontSize(9)
    doc.text('BALANCE TOTAL', M + 4, y + 5)
    doc.text(
      total.toLocaleString('en-AE', { minimumFractionDigits: 2 }),
      W - M - 4, y + 5, { align: 'right' }
    )
    y += 12
  }

  // New page if needed
  if (y > 210) { doc.addPage(); y = 20 }

  // ── Terms ──
  sectionTitle('5. Terms & Conditions')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(71, 85, 105)
  TERMS.forEach((term, i) => {
    if (y > 260) { doc.addPage(); y = 20 }
    const lines = doc.splitTextToSize(`${i + 1}. ${term}`, W - 2 * M - 4)
    doc.text(lines, M + 2, y)
    y += lines.length * 5 + 2
  })

  // ── Signatures ──
  y += 6
  if (y > 240) { doc.addPage(); y = 20 }
  sectionTitle('6. Signatures')

  const sigBox = (label: string, x: number, width: number) => {
    doc.setDrawColor(203, 213, 225)
    doc.rect(x, y, width, 18, 'S')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(148, 163, 184)
    doc.text(label, x + width / 2, y + 16, { align: 'center' })
  }
  const colW = (W - 2 * M - 10) / 2
  sigBox('Signature of Purchaser', M, colW)
  sigBox('Authorized Signatory — Gnanova', M + colW + 10, colW)

  y += 22
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(148, 163, 184)
  doc.text('Date: ____________________', M, y)
  doc.text('Date: ____________________', M + colW + 10, y)

  // ── Footer ──
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setDrawColor(226, 232, 240)
    doc.line(M, 285, W - M, 285)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(148, 163, 184)
    doc.text(
      `${agr.agreement_number} · Gnanova Real Estate · Dubai, UAE · Page ${p} of ${pages}`,
      W / 2, 290, { align: 'center' }
    )
  }

  return doc
}

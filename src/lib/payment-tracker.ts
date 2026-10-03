import { supabase } from './supabase'

export type PaymentStatus = 'Pending' | 'Paid' | 'Overdue'

export interface Payment {
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

export interface InstallmentRow {
  installment_number: number
  due_date: string
  amount: number
  status: PaymentStatus
}

export async function fetchPayments(): Promise<Payment[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .order('due_date', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as Payment[]
}

export async function updatePaymentStatus(
  id: string,
  status: PaymentStatus,
  paid_date?: string,
  utr_number?: string,
  payment_method?: string,
): Promise<void> {
  const { error } = await supabase
    .from('payments')
    .update({ status, paid_date: paid_date ?? null, utr_number: utr_number ?? null, payment_method: payment_method ?? null })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function markReceiptSent(id: string): Promise<void> {
  const { error } = await supabase.from('payments').update({ receipt_sent: true }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function insertPayments(rows: Omit<Payment, 'id' | 'created_at'>[]): Promise<void> {
  const { error } = await supabase.from('payments').insert(rows)
  if (error) throw new Error(error.message)
}

export function generateSchedule(
  totalPrice: number,
  bookingAmount: number,
  numInstallments: number,
  firstDueDate: string,
  intervalMonths: number = 1,
): InstallmentRow[] {
  const remaining = totalPrice - bookingAmount
  const base = Math.floor((remaining / numInstallments) * 100) / 100
  const rows: InstallmentRow[] = []
  const start = new Date(firstDueDate)

  for (let i = 0; i < numInstallments; i++) {
    const d = new Date(start)
    d.setMonth(d.getMonth() + i * intervalMonths)
    const isLast = i === numInstallments - 1
    const amount = isLast
      ? Math.round((remaining - base * (numInstallments - 1)) * 100) / 100
      : base
    rows.push({
      installment_number: i + 1,
      due_date: d.toISOString().split('T')[0],
      amount,
      status: 'Pending',
    })
  }
  return rows
}

export function whatsappLink(phone: string, message: string): string {
  const clean = phone.replace(/\D/g, '')
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`
}

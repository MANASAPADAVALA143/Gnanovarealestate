import type { SupabaseClient } from '@supabase/supabase-js'

/** Recalculate suite payment_received from Paid installments only (avoids double-count). */
export async function syncSuiteBalance(supabase: SupabaseClient, suiteId: string) {
  const { data: suite, error: suiteErr } = await supabase
    .from('suites')
    .select('id, price')
    .eq('id', suiteId)
    .maybeSingle()
  if (suiteErr) throw new Error(suiteErr.message)
  if (!suite) return

  const { data: paidRows, error: payErr } = await supabase
    .from('payments')
    .select('installment_amount')
    .eq('suite_id', suiteId)
    .eq('status', 'Paid')
  if (payErr) throw new Error(payErr.message)

  const received = (paidRows || []).reduce((sum, row) => sum + Number(row.installment_amount || 0), 0)
  const price = Number(suite.price || 0)
  const { error } = await supabase
    .from('suites')
    .update({
      payment_received: received,
      balance_amount: price - received,
      updated_at: new Date().toISOString(),
    })
    .eq('id', suiteId)
  if (error) throw new Error(error.message)
}

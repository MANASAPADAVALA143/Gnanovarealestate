import { useCallback, useEffect, useState } from 'react'
import { Pencil, Trash2, Plus } from 'lucide-react'
import {
  addMilestone,
  BAR_COLORS,
  deleteMilestone,
  formatPlanAmount,
  getPaymentPlan,
  QUICK_MILESTONES,
  updateMilestone,
  type PaymentPlanMilestone,
} from '../../src/lib/property-payment-plans'

type Props = {
  propertyId: string
  propertyPrice: number | null
  isManager: boolean
  onPlanChanged?: () => void
}

const emptyForm = {
  milestone: '',
  percentage: '',
  due_date: '',
  notes: '',
}

export default function PropertyPaymentPlanPanel({
  propertyId,
  propertyPrice,
  isManager,
  onPlanChanged,
}: Props) {
  const [milestones, setMilestones] = useState<PaymentPlanMilestone[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(emptyForm)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { milestones: rows } = await getPaymentPlan(propertyId)
      setMilestones(rows)
      if (rows.length === 0 && isManager) setShowForm(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load payment plan')
    } finally {
      setLoading(false)
    }
  }, [propertyId, isManager])

  useEffect(() => {
    void load()
  }, [load])

  const price = Number(propertyPrice) || 0
  const totalPct = milestones.reduce((s, m) => s + Number(m.percentage), 0)
  const totalAmt = milestones.reduce(
    (s, m) => s + (Number(m.percentage) / 100) * price,
    0
  )

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const percentage = Number(form.percentage)
    if (!form.milestone.trim() || !Number.isFinite(percentage)) return
    setSaving(true)
    setError(null)
    try {
      await addMilestone(propertyId, {
        milestone: form.milestone.trim(),
        percentage,
        due_date: form.due_date.trim() || null,
        notes: form.notes.trim() || null,
      })
      setForm(emptyForm)
      await load()
      onPlanChanged?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add milestone')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveEdit(id: string) {
    const percentage = Number(editForm.percentage)
    if (!editForm.milestone.trim() || !Number.isFinite(percentage)) return
    setSaving(true)
    setError(null)
    try {
      await updateMilestone(propertyId, id, {
        milestone: editForm.milestone.trim(),
        percentage,
        due_date: editForm.due_date.trim() || null,
        notes: editForm.notes.trim() || null,
      })
      setEditingId(null)
      await load()
      onPlanChanged?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this milestone?')) return
    setSaving(true)
    setError(null)
    try {
      await deleteMilestone(propertyId, id)
      await load()
      onPlanChanged?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500 py-6 text-center">Loading payment plan…</p>
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      {milestones.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center">
          <p className="text-sm text-slate-600">No payment plan added yet.</p>
          {isManager && (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-[#7C3AED] to-[#06B6D4] px-4 py-2 text-sm font-semibold text-white"
            >
              <Plus className="h-4 w-4" />
              Add Payment Plan
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-600">
                <tr>
                  <th className="px-3 py-2.5">Milestone</th>
                  <th className="px-3 py-2.5">%</th>
                  <th className="px-3 py-2.5">Amount AED</th>
                  <th className="px-3 py-2.5">When</th>
                  {isManager && <th className="px-3 py-2.5 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {milestones.map((m, idx) => {
                  const amt = (Number(m.percentage) / 100) * price
                  if (editingId === m.id) {
                    return (
                      <tr key={m.id} className="bg-violet-50/50">
                        <td className="px-3 py-2" colSpan={isManager ? 5 : 4}>
                          <div className="grid gap-2 sm:grid-cols-4">
                            <input
                              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                              value={editForm.milestone}
                              onChange={(e) =>
                                setEditForm((f) => ({ ...f, milestone: e.target.value }))
                              }
                            />
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step={0.01}
                              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                              value={editForm.percentage}
                              onChange={(e) =>
                                setEditForm((f) => ({ ...f, percentage: e.target.value }))
                              }
                            />
                            <input
                              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                              value={editForm.due_date}
                              onChange={(e) =>
                                setEditForm((f) => ({ ...f, due_date: e.target.value }))
                              }
                              placeholder="When"
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => void handleSaveEdit(m.id)}
                                className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  }
                  return (
                    <tr key={m.id} className="hover:bg-slate-50/80">
                      <td className="px-3 py-2.5 font-medium text-slate-900">
                        <span
                          className="mr-2 inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: BAR_COLORS[idx % BAR_COLORS.length] }}
                        />
                        {m.milestone}
                      </td>
                      <td className="px-3 py-2.5 text-slate-700">{Number(m.percentage)}%</td>
                      <td className="px-3 py-2.5 text-slate-700">
                        {price > 0 ? formatPlanAmount(amt) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">{m.due_date || '—'}</td>
                      {isManager && (
                        <td className="px-3 py-2.5 text-right">
                          <button
                            type="button"
                            className="inline-flex p-1.5 text-slate-500 hover:text-violet-600"
                            title="Edit"
                            onClick={() => {
                              setEditingId(m.id)
                              setEditForm({
                                milestone: m.milestone,
                                percentage: String(m.percentage),
                                due_date: m.due_date || '',
                                notes: m.notes || '',
                              })
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            className="inline-flex p-1.5 text-slate-500 hover:text-rose-600"
                            title="Delete"
                            onClick={() => void handleDelete(m.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  )
                })}
                <tr className="bg-slate-100 font-semibold">
                  <td className="px-3 py-2.5 text-slate-900">TOTAL</td>
                  <td className="px-3 py-2.5 text-slate-900">{Math.round(totalPct * 100) / 100}%</td>
                  <td className="px-3 py-2.5 text-slate-900">
                    {price > 0 ? formatPlanAmount(totalAmt) : '—'}
                  </td>
                  <td className="px-3 py-2.5" colSpan={isManager ? 2 : 1} />
                </tr>
              </tbody>
            </table>
          </div>

          {Math.abs(totalPct - 100) > 0.01 && (
            <p className="text-sm text-amber-700">
              ⚠ Percentages total {Math.round(totalPct * 100) / 100}% — should equal 100%
            </p>
          )}

          {totalPct > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Plan mix · 0% paid (tracking coming soon)
              </p>
              <div className="flex h-9 w-full overflow-hidden rounded-lg bg-slate-100">
                {milestones.map((m, idx) => {
                  const pct = Number(m.percentage)
                  if (!(pct > 0)) return null
                  return (
                    <div
                      key={m.id}
                      className="flex items-center justify-center text-[11px] font-bold text-white"
                      style={{
                        width: `${(pct / totalPct) * 100}%`,
                        backgroundColor: BAR_COLORS[idx % BAR_COLORS.length],
                        minWidth: pct >= 8 ? undefined : 28,
                      }}
                      title={`${m.milestone}: ${pct}%`}
                    >
                      {pct >= 8 ? `${Math.round(pct)}%` : ''}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      {isManager && (showForm || milestones.length > 0) && (
        <form
          onSubmit={(e) => void handleAdd(e)}
          className="space-y-3 rounded-xl border border-slate-200 bg-white p-4"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-900">Add Milestone</h4>
            {milestones.length === 0 && showForm && (
              <button
                type="button"
                className="text-xs text-slate-500"
                onClick={() => setShowForm(false)}
              >
                Hide
              </button>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Milestone name</label>
            <input
              required
              value={form.milestone}
              onChange={(e) => setForm((f) => ({ ...f, milestone: e.target.value }))}
              placeholder="e.g. On Booking"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {QUICK_MILESTONES.map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, milestone: label }))}
                  className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-700 hover:border-violet-300 hover:bg-violet-50"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Percentage</label>
              <div className="relative">
                <input
                  required
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={form.percentage}
                  onChange={(e) => setForm((f) => ({ ...f, percentage: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-8 text-sm"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                  %
                </span>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">When / Due date</label>
              <input
                value={form.due_date}
                onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                placeholder="e.g. Q4 2027 or On completion"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Notes (optional)</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-[#7C3AED] to-[#06B6D4] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {saving ? 'Saving…' : 'Add Milestone'}
          </button>
        </form>
      )}
    </div>
  )
}

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import {
  AD_SPEND_SOURCE_OPTIONS,
  createAdSpendEntry,
  cplBadgeClass,
  deleteAdSpendEntry,
  fetchAdSpendEntries,
  formatAed,
  sourceLabel,
  updateAdSpendEntry,
  type AdSpendEntry,
} from '../../lib/ad-spend'
import { ChevronDown, ChevronUp, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { format } from 'date-fns'

function monthBoundsLocal(): { start: string; end: string } {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const iso = (d: Date) => format(d, 'yyyy-MM-dd')
  return { start: iso(start), end: iso(end) }
}

function overlapsThisMonth(e: AdSpendEntry, monthStart: string, monthEnd: string): boolean {
  return e.period_start <= monthEnd && e.period_end >= monthStart
}

export default function MetaAdsPage() {
  const { agent } = useAuth()
  const [entries, setEntries] = useState<AdSpendEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const month = monthBoundsLocal()
  const [periodStart, setPeriodStart] = useState(month.start)
  const [periodEnd, setPeriodEnd] = useState(month.end)
  const [source, setSource] = useState('facebook')
  const [campaignName, setCampaignName] = useState('')
  const [spendAed, setSpendAed] = useState('')

  const showToast = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchAdSpendEntries()
      setEntries(data.entries || [])
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : 'Failed to load ad spend')
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const summary = useMemo(() => {
    const monthEntries = entries.filter((e) => overlapsThisMonth(e, month.start, month.end))
    const totalSpend = monthEntries.reduce((s, e) => s + (Number(e.spend_aed) || 0), 0)
    const totalLeads = monthEntries.reduce((s, e) => s + (Number(e.lead_count) || 0), 0)
    const blended = totalLeads > 0 ? totalSpend / totalLeads : null

    let best: { source: string; cpl: number } | null = null
    for (const e of monthEntries) {
      if (e.cost_per_lead == null) continue
      if (!best || e.cost_per_lead < best.cpl) {
        best = { source: e.source, cpl: e.cost_per_lead }
      }
    }

    return { totalSpend, totalLeads, blended, best }
  }, [entries, month.start, month.end])

  async function handleCreate(ev: React.FormEvent) {
    ev.preventDefault()
    const spend = Number(spendAed)
    if (!Number.isFinite(spend) || spend < 0) {
      showToast('Enter a valid spend amount')
      return
    }
    setSaving(true)
    try {
      await createAdSpendEntry({
        period_start: periodStart,
        period_end: periodEnd,
        source,
        campaign_name: campaignName.trim() || undefined,
        spend_aed: spend,
      })
      setCampaignName('')
      setSpendAed('')
      showToast('Ad spend saved')
      await load()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleEdit(entry: AdSpendEntry) {
    const rawSpend = window.prompt('Spend (AED)', String(entry.spend_aed))
    if (rawSpend == null) return
    const spend = Number(rawSpend)
    if (!Number.isFinite(spend) || spend < 0) {
      showToast('Invalid spend')
      return
    }
    const campaign = window.prompt('Campaign name (optional)', entry.campaign_name || '')
    if (campaign == null) return
    setBusyId(entry.id)
    try {
      await updateAdSpendEntry(entry.id, {
        spend_aed: spend,
        campaign_name: campaign.trim() || null,
      })
      showToast('Updated')
      await load()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(entry: AdSpendEntry) {
    if (!window.confirm(`Delete spend entry for ${sourceLabel(entry.source)}?`)) return
    setBusyId(entry.id)
    try {
      await deleteAdSpendEntry(entry.id)
      showToast('Deleted')
      await load()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Loading Meta Ads attribution…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Meta Ads Attribution</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manual ad spend entry · Cost per lead by source
          {agent?.full_name ? ` · ${agent.full_name}` : ''}
        </p>
      </div>

      {toast && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 text-sm">
          {toast}
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-800 px-4 py-3 text-sm">
          {error}
          <p className="mt-1 text-red-600 text-xs">
            Ensure Express is running on :3001 and migration 031 is applied.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Spend this month" value={formatAed(summary.totalSpend)} />
        <SummaryCard label="Leads this month" value={String(summary.totalLeads)} />
        <SummaryCard
          label="Blended CPL"
          value={summary.blended != null ? formatAed(summary.blended) : '—'}
        />
        <SummaryCard
          label="Best source (lowest CPL)"
          value={summary.best ? sourceLabel(summary.best.source) : '—'}
          sub={summary.best ? formatAed(summary.best.cpl) : undefined}
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setFormOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-3 border-b border-slate-100 text-left"
        >
          <span className="font-semibold text-slate-900 inline-flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add ad spend
          </span>
          {formOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {formOpen && (
          <form onSubmit={handleCreate} className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Period start</label>
              <input
                type="date"
                required
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Period end</label>
              <input
                type="date"
                required
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Source</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                {AD_SPEND_SOURCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Campaign name (optional)
              </label>
              <input
                type="text"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="July Marina Campaign"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Spend (AED)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                required
                value={spendAed}
                onChange={(e) => setSpendAed(e.target.value)}
                placeholder="5000"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={saving}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Save
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Attribution</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Period</th>
                <th className="text-left px-4 py-3 font-medium">Source</th>
                <th className="text-left px-4 py-3 font-medium">Campaign</th>
                <th className="text-right px-4 py-3 font-medium">Spend (AED)</th>
                <th className="text-right px-4 py-3 font-medium">Leads</th>
                <th className="text-right px-4 py-3 font-medium">CPL (AED)</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                    {e.period_start} → {e.period_end}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">{sourceLabel(e.source)}</td>
                  <td className="px-4 py-3 text-slate-600">{e.campaign_name || '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatAed(e.spend_aed)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{e.lead_count}</td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${cplBadgeClass(e.cost_per_lead)}`}
                    >
                      {e.cost_per_lead != null ? formatAed(e.cost_per_lead) : 'No leads'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        disabled={busyId === e.id}
                        onClick={() => void handleEdit(e)}
                        className="p-1.5 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
                        aria-label="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={busyId === e.id}
                        onClick={() => void handleDelete(e)}
                        className="p-1.5 rounded border border-slate-200 hover:bg-red-50 text-red-700 disabled:opacity-50"
                        aria-label="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    No ad spend entries yet. Add your first Meta / portal spend above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-xl font-semibold text-slate-900 tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  )
}

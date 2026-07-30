import React, { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { formatAed } from '../../lib/broker-invoices'
import { fetchAdSpendEntries, type AdSpendEntry } from '../../lib/ad-spend'
import {
  fetchAdminAuditLog,
  fetchAdminBrokers,
  fetchAdminOverview,
  patchAdminBroker,
  startRankRecalculation,
  type AdminAuditEntry,
  type AdminBroker,
  type AdminOverview,
} from '../../lib/admin-api'
import {
  Loader2,
  RefreshCw,
  Shield,
  TrendingUp,
  Users,
  ScrollText,
  Ban,
  CheckCircle2,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { Link } from 'react-router-dom'

type TabId = 'revenue' | 'rankings' | 'brokers' | 'audit'

function fmtChange(oldV: Record<string, unknown>, newV: Record<string, unknown>): string {
  const keys = Array.from(new Set([...Object.keys(oldV), ...Object.keys(newV)]))
  return keys
    .filter((k) => k !== 'rank_factors')
    .map((k) => `${k}: ${JSON.stringify(oldV[k])} → ${JSON.stringify(newV[k])}`)
    .join(', ')
}

export default function AdminPage() {
  const { agent, dashboardPreview } = useAuth()
  const [tab, setTab] = useState<TabId>('revenue')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [recalcBusy, setRecalcBusy] = useState(false)

  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [brokers, setBrokers] = useState<AdminBroker[]>([])
  const [audit, setAudit] = useState<AdminAuditEntry[]>([])
  const [isOwner, setIsOwner] = useState(false)
  const [rankDraft, setRankDraft] = useState<Record<string, string>>({})
  const [adSpendMonth, setAdSpendMonth] = useState<{
    totalSpend: number
    blendedCpl: number | null
  } | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 4000)
  }

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [ov, br, au] = await Promise.all([
        fetchAdminOverview(),
        fetchAdminBrokers(),
        fetchAdminAuditLog(),
      ])
      setOverview(ov)
      setBrokers(br.brokers)
      setAudit(au.entries)
      setIsOwner(Boolean(ov.viewer?.is_owner || br.viewer?.is_owner || agent?.is_owner))
      const drafts: Record<string, string> = {}
      for (const b of br.brokers) {
        drafts[b.id] = String(b.broker_rank_score ?? 0)
      }
      setRankDraft(drafts)

      try {
        const now = new Date()
        const monthStart = format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd')
        const monthEnd = format(new Date(now.getFullYear(), now.getMonth() + 1, 0), 'yyyy-MM-dd')
        const { entries } = await fetchAdSpendEntries()
        const monthRows = (entries || []).filter(
          (e: AdSpendEntry) => e.period_start <= monthEnd && e.period_end >= monthStart
        )
        const totalSpend = monthRows.reduce((s, e) => s + (Number(e.spend_aed) || 0), 0)
        const totalLeads = monthRows.reduce((s, e) => s + (Number(e.lead_count) || 0), 0)
        setAdSpendMonth({
          totalSpend,
          blendedCpl: totalLeads > 0 ? totalSpend / totalLeads : null,
        })
      } catch {
        setAdSpendMonth(null)
      }
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : 'Failed to load admin data')
    } finally {
      setLoading(false)
    }
  }, [agent?.is_owner])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  async function handleRecalculate() {
    setRecalcBusy(true)
    try {
      await startRankRecalculation()
      showToast('Recalculation started')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Recalculation failed')
    } finally {
      setRecalcBusy(false)
    }
  }

  async function handlePatch(
    id: string,
    body: { broker_rank_score?: number; is_available?: boolean; is_manager?: boolean }
  ) {
    if (!isOwner && !dashboardPreview) {
      showToast('Owner only')
      return
    }
    setBusyId(id)
    try {
      const res = await patchAdminBroker(id, body)
      setBrokers((prev) =>
        prev.map((b) =>
          b.id === id
            ? {
                ...b,
                ...res.broker,
                broker_rank_score: Number(res.broker.broker_rank_score) || 0,
                is_available: res.broker.is_available !== false,
                is_manager: Boolean(res.broker.is_manager),
              }
            : b
        )
      )
      if (typeof body.broker_rank_score === 'number') {
        setRankDraft((d) => ({ ...d, [id]: String(body.broker_rank_score) }))
      }
      const au = await fetchAdminAuditLog()
      setAudit(au.entries)
      showToast(`Saved: ${res.action}`)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setBusyId(null)
    }
  }

  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'revenue', label: 'Revenue', icon: TrendingUp },
    { id: 'rankings', label: 'Rankings', icon: Shield },
    { id: 'brokers', label: 'Brokers', icon: Users },
    { id: 'audit', label: 'Audit log', icon: ScrollText },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Loading admin panel…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin</h1>
          <p className="text-sm text-slate-500 mt-1">
            Company-wide oversight
            {isOwner ? ' · Owner access' : ' · Manager view (mutations require owner)'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadAll()}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {toast && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 text-sm">
          {toast}
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-800 px-4 py-3 text-sm">
          {error}
          <p className="mt-1 text-red-600">
            Ensure Next is running on :3002 and you are signed in as manager/owner.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {tabs.map((t) => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                active
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'revenue' && overview && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total paid revenue" value={formatAed(overview.total_paid_revenue)} />
            <StatCard
              label="Deals closed this month"
              value={String(overview.deals_closed_this_month)}
              sub={`Last month: ${overview.deals_closed_last_month}`}
            />
            <StatCard
              label="Pending commissions"
              value={formatAed(overview.commission_pipeline.pending_total)}
            />
            <StatCard
              label="Approved commissions"
              value={formatAed(overview.commission_pipeline.approved_total)}
              sub="Not yet paid"
            />
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Revenue by broker</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Broker</th>
                    <th className="text-right px-4 py-3 font-medium">Paid</th>
                    <th className="text-right px-4 py-3 font-medium">Pending invoices</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.revenue_by_broker.map((r) => (
                    <tr key={r.broker_id} className="border-t border-slate-100">
                      <td className="px-4 py-3 text-slate-900">{r.broker_name}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatAed(r.paid_total)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                        {formatAed(r.pending_total)}
                      </td>
                    </tr>
                  ))}
                  {overview.revenue_by_broker.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                        No brokers yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {adSpendMonth && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-900">Ad Spend Summary</h3>
                <p className="text-sm text-slate-600 mt-1">
                  This month: {formatAed(adSpendMonth.totalSpend)}
                  {' · '}
                  Blended CPL:{' '}
                  {adSpendMonth.blendedCpl != null ? formatAed(adSpendMonth.blendedCpl) : '—'}
                </p>
              </div>
              <Link
                to="/dashboard/meta-ads"
                className="text-sm font-medium text-blue-700 hover:text-blue-900 whitespace-nowrap"
              >
                View full attribution →
              </Link>
            </div>
          )}
        </div>
      )}

      {tab === 'rankings' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500">
              Sorted by broker_rank_score. Manual override is owner-only.
            </p>
            <button
              type="button"
              disabled={recalcBusy}
              onClick={() => void handleRecalculate()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {recalcBusy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Recalculate all ranks
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Broker</th>
                    <th className="text-right px-4 py-3 font-medium">Score</th>
                    <th className="text-left px-4 py-3 font-medium">Factors</th>
                    <th className="text-left px-4 py-3 font-medium">Updated</th>
                    <th className="text-right px-4 py-3 font-medium">Active leads</th>
                    <th className="text-right px-4 py-3 font-medium">Closed 90d</th>
                    {isOwner && <th className="text-right px-4 py-3 font-medium">Override</th>}
                  </tr>
                </thead>
                <tbody>
                  {brokers.map((b) => (
                    <tr key={b.id} className="border-t border-slate-100 align-top">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{b.full_name || 'Broker'}</div>
                        <div className="text-xs text-slate-500">{b.email}</div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold">
                        {Number(b.broker_rank_score).toFixed(1)}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 max-w-xs">
                        <code className="whitespace-pre-wrap break-all">
                          {JSON.stringify(b.rank_factors || {}, null, 0).slice(0, 180)}
                          {JSON.stringify(b.rank_factors || {}).length > 180 ? '…' : ''}
                        </code>
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {b.rank_updated_at
                          ? formatDistanceToNow(new Date(b.rank_updated_at), { addSuffix: true })
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{b.active_lead_count}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{b.deals_closed_90d}</td>
                      {isOwner && (
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step={0.1}
                              value={rankDraft[b.id] ?? ''}
                              onChange={(e) =>
                                setRankDraft((d) => ({ ...d, [b.id]: e.target.value }))
                              }
                              className="w-20 rounded border border-slate-200 px-2 py-1 text-right"
                            />
                            <button
                              type="button"
                              disabled={busyId === b.id}
                              onClick={() => {
                                const n = Number(rankDraft[b.id])
                                if (!Number.isFinite(n)) {
                                  showToast('Invalid score')
                                  return
                                }
                                void handlePatch(b.id, { broker_rank_score: n })
                              }}
                              className="px-2 py-1 text-xs rounded bg-slate-900 text-white disabled:opacity-50"
                            >
                              Save
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'brokers' && (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            Toggle availability to block new lead assignment. Promote/demote managers is owner-only.
            Broker deletion uses the separate data-deletion flow — not available here.
          </p>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Broker</th>
                    <th className="text-left px-4 py-3 font-medium">Flags</th>
                    <th className="text-right px-4 py-3 font-medium">Active leads</th>
                    <th className="text-left px-4 py-3 font-medium">Last active</th>
                    {isOwner && <th className="text-right px-4 py-3 font-medium">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {brokers.map((b) => (
                    <tr key={b.id} className="border-t border-slate-100">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{b.full_name || 'Broker'}</div>
                        <div className="text-xs text-slate-500">{b.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {!b.is_available && (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-red-100 text-red-800">
                              <Ban className="w-3 h-3" /> Blocked
                            </span>
                          )}
                          {b.is_available && (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-emerald-50 text-emerald-800">
                              <CheckCircle2 className="w-3 h-3" /> Available
                            </span>
                          )}
                          {b.is_manager && (
                            <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-800">
                              Manager
                            </span>
                          )}
                          {b.is_owner && (
                            <span className="text-xs px-2 py-0.5 rounded bg-amber-50 text-amber-900">
                              Owner
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{b.active_lead_count}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {b.last_active
                          ? formatDistanceToNow(new Date(b.last_active), { addSuffix: true })
                          : '—'}
                      </td>
                      {isOwner && (
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              disabled={busyId === b.id}
                              onClick={() =>
                                void handlePatch(b.id, { is_available: !b.is_available })
                              }
                              className="px-2 py-1 text-xs rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
                            >
                              {b.is_available ? 'Block' : 'Unblock'}
                            </button>
                            {!b.is_owner && (
                              <button
                                type="button"
                                disabled={busyId === b.id || b.id === agent?.id}
                                onClick={() =>
                                  void handlePatch(b.id, { is_manager: !b.is_manager })
                                }
                                className="px-2 py-1 text-xs rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
                              >
                                {b.is_manager ? 'Demote' : 'Promote'}
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'audit' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Last 50 admin actions</h2>
            <p className="text-xs text-slate-500 mt-0.5">Append-only — no edit or delete</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">When</th>
                  <th className="text-left px-4 py-3 font-medium">Action</th>
                  <th className="text-left px-4 py-3 font-medium">By</th>
                  <th className="text-left px-4 py-3 font-medium">Target</th>
                  <th className="text-left px-4 py-3 font-medium">Change</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((e) => (
                  <tr key={e.id} className="border-t border-slate-100 align-top">
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                      {format(new Date(e.created_at), 'dd MMM yyyy HH:mm')}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{e.action}</td>
                    <td className="px-4 py-3">{e.performed_by_name}</td>
                    <td className="px-4 py-3">{e.target_agent_name || '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 max-w-md break-words">
                      {fmtChange(e.old_value || {}, e.new_value || {}) || '—'}
                    </td>
                  </tr>
                ))}
                {audit.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      No admin actions yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({
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
      <div className="mt-2 text-2xl font-semibold text-slate-900 tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  )
}

import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { dealDisplayName } from '../../lib/deals'
import {
  bulkSubmitCommissions,
  commissionNextStatus,
  commissionStatusChangedAt,
  COMMISSION_STATUS_BADGE,
  COMMISSION_STATUS_LABELS,
  COMMISSION_STATUSES,
  fetchCommissions,
  formatAed,
  updateCommissionStatus,
  type CommissionRow,
  type CommissionStatus,
} from '../../lib/commissions'
import DealTimeline from '../../components/crm/DealTimeline'
import { ChevronDown, ChevronRight, Filter, Loader2 } from 'lucide-react'
import { format } from 'date-fns'

type AgentPick = { id: string; full_name: string | null }

export default function CommissionsPage() {
  const { agent, loading: authLoading } = useAuth()
  const [rows, setRows] = useState<CommissionRow[]>([])
  const [agents, setAgents] = useState<AgentPick[]>([])
  const [loading, setLoading] = useState(true)
  const [isManager, setIsManager] = useState(false)
  const [filterAgentId, setFilterAgentId] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [paymentRef, setPaymentRef] = useState<Record<string, string>>({})
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [bulkLoading, setBulkLoading] = useState(false)

  useEffect(() => {
    if (authLoading || !agent) {
      setLoading(false)
      return
    }
    loadAgents()
    loadManagerFlag()
    loadCommissions()
  }, [agent, authLoading, filterAgentId, filterStatus])

  async function loadManagerFlag() {
    const { data } = await supabase
      .from('agents')
      .select('is_manager')
      .eq('id', agent!.id)
      .maybeSingle()
    setIsManager(Boolean((data as { is_manager?: boolean } | null)?.is_manager))
  }

  async function loadAgents() {
    const { data } = await supabase.from('agents').select('id, full_name').order('full_name')
    setAgents((data as AgentPick[]) || [])
  }

  async function loadCommissions() {
    setLoading(true)
    try {
      const data = await fetchCommissions({
        agent_id: filterAgentId || undefined,
        status: filterStatus !== 'all' ? (filterStatus as CommissionStatus) : undefined,
      })
      setRows(data)
    } catch (e) {
      console.error('Commissions fetch failed:', e)
    } finally {
      setLoading(false)
    }
  }

  const filteredRows = useMemo(() => rows, [rows])

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function advanceStatus(row: CommissionRow, allowMissingRef = false) {
    const next = commissionNextStatus(row.commission_status || 'pending')
    if (!next) return

    if (row.stage !== 'closed_won') {
      alert('Deal must be Closed Won before commission can advance.')
      return
    }

    setUpdatingId(row.id)
    try {
      const payload: Parameters<typeof updateCommissionStatus>[1] = {
        commission_status: next,
        updated_by: agent!.id,
      }
      if (next === 'paid') {
        payload.commission_payment_reference = paymentRef[row.id]?.trim() || null
        if (!payload.commission_payment_reference) {
          payload.allow_missing_payment_reference = allowMissingRef
        }
      }

      const { deal, warnings } = await updateCommissionStatus(row.id, payload)
      setRows((prev) => prev.map((r) => (r.id === deal.id ? { ...r, ...deal } : r)))
      if (warnings?.length) {
        alert(warnings.join('\n'))
      }
    } catch (err) {
      const e = err as Error & { can_override?: boolean }
      if (e.can_override && window.confirm(`${e.message}\n\nMark as paid anyway without a reference?`)) {
        await advanceStatus(row, true)
      } else {
        alert(e.message)
      }
    } finally {
      setUpdatingId(null)
    }
  }

  async function resetToPending(row: CommissionRow) {
    if (!window.confirm('Reset commission status to pending? This clears commission timestamps.')) return
    setUpdatingId(row.id)
    try {
      const { deal } = await updateCommissionStatus(row.id, {
        commission_status: 'pending',
        updated_by: agent!.id,
      })
      setRows((prev) => prev.map((r) => (r.id === deal.id ? { ...r, ...deal } : r)))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to reset')
    } finally {
      setUpdatingId(null)
    }
  }

  async function handleBulkSubmit() {
    if (!isManager) return
    const ids = Array.from(selectedIds).filter((id) => {
      const row = rows.find((r) => r.id === id)
      return row?.commission_status === 'pending' && row.stage === 'closed_won'
    })
    if (ids.length === 0) {
      alert('Select pending closed-won deals to bulk submit.')
      return
    }
    setBulkLoading(true)
    try {
      const result = await bulkSubmitCommissions(ids, agent!.id)
      alert(`Submitted ${result.succeeded} deal(s). ${result.failed} failed.`)
      setSelectedIds(new Set())
      await loadCommissions()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Bulk submit failed')
    } finally {
      setBulkLoading(false)
    }
  }

  if (authLoading) {
    return <div className="flex items-center justify-center h-64 text-slate-600">Loading…</div>
  }

  if (!agent) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-950 max-w-lg">
        <h2 className="font-semibold text-lg">No agent profile</h2>
        <p className="mt-2 text-sm">Sign in with an agent account to view commissions.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Commissions</h1>
          <p className="text-slate-600 mt-1">
            Track commission from submission through payment. Only closed-won deals appear here.
          </p>
        </div>
        {isManager && selectedIds.size > 0 && (
          <button
            onClick={handleBulkSubmit}
            disabled={bulkLoading}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {bulkLoading ? 'Submitting…' : `Mark ${selectedIds.size} as Submitted`}
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 bg-white border border-slate-200 rounded-xl p-4">
        <Filter className="w-4 h-4 text-slate-400" />
        <select
          value={filterAgentId}
          onChange={(e) => setFilterAgentId(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All agents</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.full_name || a.id.slice(0, 8)}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="all">All statuses</option>
          {COMMISSION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {COMMISSION_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Loading commissions…
          </div>
        ) : filteredRows.length === 0 ? (
          <p className="text-center py-16 text-slate-500 text-sm">
            No closed-won deals with commission data yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {isManager && (
                    <th className="px-4 py-3 w-10">
                      <span className="sr-only">Select</span>
                    </th>
                  )}
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Agent</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Deal</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600">Sale Value</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600">Comm %</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600">Agent Comm.</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Status Date</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((row) => {
                  const status = (row.commission_status || 'pending') as CommissionStatus
                  const next = commissionNextStatus(status)
                  const expanded = expandedId === row.id
                  const changedAt = commissionStatusChangedAt(row)

                  return (
                    <React.Fragment key={row.id}>
                      <tr className="hover:bg-slate-50">
                        {isManager && (
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(row.id)}
                              onChange={() => toggleSelect(row.id)}
                              disabled={status !== 'pending'}
                            />
                          </td>
                        )}
                        <td className="px-4 py-3 whitespace-nowrap">
                          {row.agents?.full_name || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setExpandedId(expanded ? null : row.id)}
                            className="flex items-start gap-1 text-left hover:text-emerald-700"
                          >
                            {expanded ? (
                              <ChevronDown className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            ) : (
                              <ChevronRight className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            )}
                            <span>
                              <span className="font-medium text-slate-900 block">
                                {dealDisplayName(row)}
                              </span>
                              <span className="text-xs text-slate-500">
                                {[row.unit_number && `Unit ${row.unit_number}`, row.project_name]
                                  .filter(Boolean)
                                  .join(' · ') || '—'}
                              </span>
                            </span>
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {formatAed(row.sale_value)}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {row.commission_percent != null ? `${row.commission_percent}%` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-emerald-700 whitespace-nowrap">
                          {formatAed(row.agent_commission)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${COMMISSION_STATUS_BADGE[status]}`}
                          >
                            {COMMISSION_STATUS_LABELS[status]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                          {changedAt ? format(new Date(changedAt), 'MMM d, yyyy') : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-2 min-w-[140px]">
                            {next && (
                              <>
                                {next === 'paid' && (
                                  <input
                                    type="text"
                                    placeholder="Payment ref (invoice #)"
                                    value={paymentRef[row.id] || ''}
                                    onChange={(e) =>
                                      setPaymentRef((p) => ({ ...p, [row.id]: e.target.value }))
                                    }
                                    className="border border-slate-300 rounded px-2 py-1 text-xs w-full"
                                  />
                                )}
                                <button
                                  type="button"
                                  disabled={updatingId === row.id}
                                  onClick={() => advanceStatus(row)}
                                  className="text-xs px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                                >
                                  → {COMMISSION_STATUS_LABELS[next]}
                                </button>
                              </>
                            )}
                            {status !== 'pending' && (
                              <button
                                type="button"
                                disabled={updatingId === row.id}
                                onClick={() => resetToPending(row)}
                                className="text-xs px-2 py-1 rounded border border-slate-300 text-slate-600 hover:bg-slate-50"
                              >
                                Reset to pending
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {expanded && (
                        <tr>
                          <td colSpan={isManager ? 9 : 8} className="px-6 py-4 bg-slate-50">
                            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">
                              Commission activity
                            </p>
                            <DealTimeline
                              dealId={row.id}
                              agentId={agent.id}
                              activityTypes={['commission_status_change', 'amount_update']}
                              showNoteForm={false}
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

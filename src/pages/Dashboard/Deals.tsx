import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { Plus, X, Loader2, Save } from 'lucide-react'
import {
  createDeal,
  dealDisplayName,
  fetchDeals,
  formatAed,
  updateDeal,
  type DealRow,
  type DealStage,
} from '../../lib/deals'
import DealsKanban from '../../components/crm/DealsKanban'
import DealTimeline from '../../components/crm/DealTimeline'

type LeadPick = { id: string; name: string; phone: string }

type NewDealForm = {
  lead_id: string
  client_name: string
  unit_number: string
  project_name: string
  sale_value: string
  commission_percent: string
}

const emptyForm: NewDealForm = {
  lead_id: '',
  client_name: '',
  unit_number: '',
  project_name: '',
  sale_value: '',
  commission_percent: '2',
}

export default function DealsPage() {
  const { agent, loading: authLoading } = useAuth()
  const [deals, setDeals] = useState<DealRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDeal, setSelectedDeal] = useState<DealRow | null>(null)
  const [showNewDeal, setShowNewDeal] = useState(false)
  const [leads, setLeads] = useState<LeadPick[]>([])
  const [leadSearch, setLeadSearch] = useState('')
  const [newForm, setNewForm] = useState<NewDealForm>(emptyForm)
  const [creating, setCreating] = useState(false)
  const [savingDetail, setSavingDetail] = useState(false)
  const [detailForm, setDetailForm] = useState<Record<string, string>>({})

  useEffect(() => {
    if (authLoading || !agent) {
      setLoading(false)
      return
    }
    loadDeals()
    loadLeads()
  }, [agent, authLoading])

  useEffect(() => {
    if (!selectedDeal) return
    setDetailForm({
      unit_number: selectedDeal.unit_number || '',
      project_name: selectedDeal.project_name || '',
      booking_amount: selectedDeal.booking_amount?.toString() || '',
      token_amount: selectedDeal.token_amount?.toString() || '',
      sale_value: selectedDeal.sale_value?.toString() || '',
      commission_percent: selectedDeal.commission_percent?.toString() || '',
      agent_commission: selectedDeal.agent_commission?.toString() || '',
      brokerage_commission: selectedDeal.brokerage_commission?.toString() || '',
      developer_incentive: selectedDeal.developer_incentive?.toString() || '',
      lost_reason: selectedDeal.lost_reason || '',
      expected_close_date: selectedDeal.expected_close_date || '',
      actual_close_date: selectedDeal.actual_close_date || '',
    })
  }, [selectedDeal])

  async function loadDeals() {
    setLoading(true)
    try {
      const rows = await fetchDeals()
      setDeals(rows)
    } catch (e) {
      console.error('Deals fetch failed:', e)
    } finally {
      setLoading(false)
    }
  }

  async function loadLeads() {
    const { data } = await supabase
      .from('leads')
      .select('id, name, phone')
      .order('name')
      .limit(200)
    setLeads((data as LeadPick[]) || [])
  }

  const filteredLeads = useMemo(() => {
    const q = leadSearch.trim().toLowerCase()
    if (!q) return leads.slice(0, 20)
    return leads
      .filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.phone.includes(q)
      )
      .slice(0, 20)
  }, [leads, leadSearch])

  async function handleStageChange(dealId: string, stage: DealStage) {
    const payload: Record<string, unknown> = { stage, updated_by: agent!.id }
    if (stage === 'closed_lost') {
      const reason = window.prompt('Reason for lost deal?')
      if (!reason?.trim()) return
      payload.lost_reason = reason.trim()
    }
    await updateDeal(dealId, payload)
    setDeals((prev) =>
      prev.map((d) =>
        d.id === dealId
          ? {
              ...d,
              stage,
              lost_reason: (payload.lost_reason as string) || d.lost_reason,
              stage_entered_at: new Date().toISOString(),
            }
          : d
      )
    )
    if (selectedDeal?.id === dealId) {
      setSelectedDeal((prev) =>
        prev
          ? {
              ...prev,
              stage,
              lost_reason: (payload.lost_reason as string) || prev.lost_reason,
            }
          : null
      )
    }
  }

  async function handleCreateDeal(e: React.FormEvent) {
    e.preventDefault()
    if (!newForm.lead_id && !newForm.client_name.trim()) {
      alert('Select a lead or enter a client name.')
      return
    }
    setCreating(true)
    try {
      const deal = await createDeal({
        lead_id: newForm.lead_id || null,
        client_name: newForm.client_name.trim() || null,
        agent_id: agent!.id,
        unit_number: newForm.unit_number || null,
        project_name: newForm.project_name || null,
        sale_value: newForm.sale_value ? Number(newForm.sale_value) : null,
        commission_percent: newForm.commission_percent
          ? Number(newForm.commission_percent)
          : null,
      })
      setDeals((prev) => [deal, ...prev])
      setShowNewDeal(false)
      setNewForm(emptyForm)
      setLeadSearch('')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create deal')
    } finally {
      setCreating(false)
    }
  }

  async function handleSaveDetail(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedDeal) return
    setSavingDetail(true)
    try {
      const updated = await updateDeal(selectedDeal.id, {
        unit_number: detailForm.unit_number || null,
        project_name: detailForm.project_name || null,
        booking_amount: detailForm.booking_amount ? Number(detailForm.booking_amount) : null,
        token_amount: detailForm.token_amount ? Number(detailForm.token_amount) : null,
        sale_value: detailForm.sale_value ? Number(detailForm.sale_value) : null,
        commission_percent: detailForm.commission_percent
          ? Number(detailForm.commission_percent)
          : null,
        agent_commission: detailForm.agent_commission
          ? Number(detailForm.agent_commission)
          : null,
        brokerage_commission: detailForm.brokerage_commission
          ? Number(detailForm.brokerage_commission)
          : null,
        developer_incentive: detailForm.developer_incentive
          ? Number(detailForm.developer_incentive)
          : null,
        lost_reason: detailForm.lost_reason || null,
        expected_close_date: detailForm.expected_close_date || null,
        actual_close_date: detailForm.actual_close_date || null,
        updated_by: agent!.id,
      })
      setSelectedDeal(updated)
      setDeals((prev) => prev.map((d) => (d.id === updated.id ? { ...d, ...updated } : d)))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save deal')
    } finally {
      setSavingDetail(false)
    }
  }

  if (authLoading) {
    return <div className="flex items-center justify-center h-64 text-slate-600">Loading…</div>
  }

  if (!agent) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-950 max-w-lg">
        <h2 className="font-semibold text-lg">No agent profile</h2>
        <p className="mt-2 text-sm">Sign in with an agent account to view deals.</p>
      </div>
    )
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading deals…</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Deals</h1>
          <p className="text-slate-600 mt-1">
            Track deals from viewing through closure. Drag cards between stages.
          </p>
        </div>
        <button
          onClick={() => setShowNewDeal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          New Deal
        </button>
      </div>

      <DealsKanban
        deals={deals}
        onStageChange={handleStageChange}
        onCardClick={setSelectedDeal}
      />

      {showNewDeal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">New Deal</h2>
              <button onClick={() => setShowNewDeal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleCreateDeal} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Link to existing lead (optional)
                </label>
                <input
                  type="text"
                  value={leadSearch}
                  onChange={(e) => setLeadSearch(e.target.value)}
                  placeholder="Search leads by name or phone…"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-2"
                />
                <select
                  value={newForm.lead_id}
                  onChange={(e) => {
                    const lead = leads.find((l) => l.id === e.target.value)
                    setNewForm((f) => ({
                      ...f,
                      lead_id: e.target.value,
                      client_name: lead ? lead.name : f.client_name,
                    }))
                  }}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">— Manual client —</option>
                  {filteredLeads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.phone})
                    </option>
                  ))}
                </select>
              </div>
              {!newForm.lead_id && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Client name</label>
                  <input
                    type="text"
                    value={newForm.client_name}
                    onChange={(e) => setNewForm((f) => ({ ...f, client_name: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    required={!newForm.lead_id}
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Unit number</label>
                  <input
                    type="text"
                    value={newForm.unit_number}
                    onChange={(e) => setNewForm((f) => ({ ...f, unit_number: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Project</label>
                  <input
                    type="text"
                    value={newForm.project_name}
                    onChange={(e) => setNewForm((f) => ({ ...f, project_name: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Sale value (AED)</label>
                  <input
                    type="number"
                    min="0"
                    value={newForm.sale_value}
                    onChange={(e) => setNewForm((f) => ({ ...f, sale_value: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Commission %</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newForm.commission_percent}
                    onChange={(e) =>
                      setNewForm((f) => ({ ...f, commission_percent: e.target.value }))
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={creating}
                className="w-full py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 font-medium"
              >
                {creating ? 'Creating…' : 'Create Deal'}
              </button>
            </form>
          </div>
        </div>
      )}

      {selectedDeal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{dealDisplayName(selectedDeal)}</h2>
                <p className="text-sm text-slate-500 mt-1">
                  {selectedDeal.project_name || 'No project'} · {formatAed(selectedDeal.sale_value)}
                </p>
              </div>
              <button
                onClick={() => setSelectedDeal(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <form onSubmit={handleSaveDetail} className="space-y-4">
                <h3 className="font-semibold text-slate-900">Deal details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    ['unit_number', 'Unit number'],
                    ['project_name', 'Project'],
                    ['booking_amount', 'Booking amount'],
                    ['token_amount', 'Token amount'],
                    ['sale_value', 'Sale value'],
                    ['commission_percent', 'Commission %'],
                    ['agent_commission', 'Agent commission'],
                    ['brokerage_commission', 'Brokerage commission'],
                    ['developer_incentive', 'Developer incentive'],
                    ['expected_close_date', 'Expected close (YYYY-MM-DD)'],
                    ['actual_close_date', 'Actual close (YYYY-MM-DD)'],
                  ].map(([key, label]) => (
                    <div key={key}>
                      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
                      <input
                        type={key.includes('date') ? 'date' : key.includes('amount') || key.includes('commission') || key.includes('percent') || key.includes('incentive') || key === 'sale_value' ? 'number' : 'text'}
                        value={detailForm[key] || ''}
                        onChange={(e) =>
                          setDetailForm((f) => ({ ...f, [key]: e.target.value }))
                        }
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                  ))}
                </div>
                {selectedDeal.stage === 'closed_lost' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Lost reason</label>
                    <textarea
                      value={detailForm.lost_reason || ''}
                      onChange={(e) =>
                        setDetailForm((f) => ({ ...f, lost_reason: e.target.value }))
                      }
                      rows={2}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                )}
                <button
                  type="submit"
                  disabled={savingDetail}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium"
                >
                  {savingDetail ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save changes
                </button>
              </form>

              <div>
                <h3 className="font-semibold text-slate-900 mb-4">Activity timeline</h3>
                <DealTimeline dealId={selectedDeal.id} agentId={agent.id} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

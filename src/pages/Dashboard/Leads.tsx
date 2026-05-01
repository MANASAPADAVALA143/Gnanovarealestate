import React, { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { supabase, type Call } from '../../lib/supabase'
import { Search, Filter, Phone, Mail, Calendar, X, PenTool, UserRound } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'

type LeadJoin = {
  id: string
  agent_id: string | null
  lead_type?: string | null
  urgency?: string | null
  nudge_count?: number | null
  nudge_sent_at?: string | null
  lead_score?: number | null
  score_label?: string | null
} | null
type CallWithLead = Call & { leads?: LeadJoin }

type AgentPick = { id: string; full_name: string | null }

type ResolvedLeadRow = {
  id: string
  agent_id: string | null
  lead_type?: string | null
  urgency?: string | null
  nudge_count?: number | null
  nudge_sent_at?: string | null
}

export default function LeadsPage() {
  const { agent } = useAuth()
  const navigate = useNavigate()
  const [leads, setLeads] = useState<CallWithLead[]>([])
  const [filteredLeads, setFilteredLeads] = useState<CallWithLead[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedLead, setSelectedLead] = useState<CallWithLead | null>(null)
  const [agents, setAgents] = useState<AgentPick[]>([])
  const [resolvedLead, setResolvedLead] = useState<ResolvedLeadRow | null>(null)
  const [reassignSaving, setReassignSaving] = useState(false)

  useEffect(() => {
    if (agent) {
      fetchLeads()
      loadAgents()
    }
  }, [agent])

  useEffect(() => {
    filterLeads()
  }, [leads, searchQuery, statusFilter])

  async function loadAgents() {
    try {
      let res = await supabase.from('agents').select('id, full_name').eq('is_available', true).order('full_name')
      if (res.error) {
        res = await supabase.from('agents').select('id, full_name').order('full_name')
      }
      if (res.error) throw res.error
      setAgents((res.data as AgentPick[]) || [])
    } catch (e) {
      console.error('Error loading agents:', e)
      setAgents([])
    }
  }

  async function fetchLeads() {
    try {
      const { data, error } = await supabase
        .from('calls')
        .select(
          '*, leads ( id, agent_id, lead_type, urgency, nudge_count, nudge_sent_at, lead_score, score_label )'
        )
        .eq('agent_id', agent!.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setLeads((data as CallWithLead[]) || [])
    } catch (error) {
      console.error('Error fetching leads:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    async function resolveLead() {
      if (!selectedLead) {
        setResolvedLead(null)
        return
      }
      if (selectedLead.leads?.id) {
        if (!cancelled) {
          const lj = selectedLead.leads
          setResolvedLead({
            id: lj.id,
            agent_id: lj.agent_id,
            lead_type: lj.lead_type,
            urgency: lj.urgency,
            nudge_count: lj.nudge_count,
            nudge_sent_at: lj.nudge_sent_at,
          })
        }
        return
      }
      const phone = selectedLead.lead_phone?.trim()
      if (!phone) {
        if (!cancelled) setResolvedLead(null)
        return
      }
      const { data } = await supabase
        .from('leads')
        .select('id, agent_id, lead_type, urgency, nudge_count, nudge_sent_at')
        .eq('phone', phone)
        .maybeSingle()
      if (!cancelled) {
        setResolvedLead(data ? (data as ResolvedLeadRow) : null)
      }
    }
    resolveLead()
    return () => {
      cancelled = true
    }
  }, [selectedLead])

  async function handleReassignAgent(agentId: string) {
    if (!resolvedLead?.id) return
    setReassignSaving(true)
    try {
      const { error } = await supabase
        .from('leads')
        .update({ agent_id: agentId || null, updated_at: new Date().toISOString() } as never)
        .eq('id', resolvedLead.id)
      if (error) throw error
      setResolvedLead({ ...resolvedLead, agent_id: agentId || null })
      await fetchLeads()
    } catch (e) {
      console.error('Reassign failed:', e)
    } finally {
      setReassignSaving(false)
    }
  }

  function filterLeads() {
    let filtered = [...leads]

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (lead) =>
          lead.lead_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          lead.lead_phone?.includes(searchQuery) ||
          lead.lead_email?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((lead) => lead.lead_status === statusFilter)
    }

    setFilteredLeads(filtered)
  }

  function handleGenerateListing(lead: CallWithLead) {
    const locPref = lead.location_preference
    const locationStr = Array.isArray(locPref) ? locPref.join(', ') : typeof locPref === 'string' ? locPref : ''
    const beds =
      lead.bedrooms_max != null
        ? String(lead.bedrooms_max)
        : lead.bedrooms_min != null
          ? String(lead.bedrooms_min)
          : ''
    // Navigate to Listing Writer with lead's preferences pre-filled
    navigate('/dashboard/listing-writer', {
      state: {
        propertyData: {
          location: locationStr,
          price: lead.budget_max ? lead.budget_max.toString() : '',
          bedrooms: beds,
          bathrooms: '',
          sqft: '',
          features: [],
          sellingPoints: `Property matching lead preferences: Budget up to $${lead.budget_max?.toLocaleString()}, ${beds || 'N/A'} bedrooms${locationStr ? ', in ' + locationStr : ''}.`
        }
      }
    })
    setSelectedLead(null)
  }

  const statusCounts = {
    all: leads.length,
    hot: leads.filter((l) => l.lead_status === 'hot').length,
    warm: leads.filter((l) => l.lead_status === 'warm').length,
    cold: leads.filter((l) => l.lead_status === 'cold').length,
  }

  function leadTypeBadgeClass(lt: string | null | undefined): string {
    const t = (lt || 'buyer').toLowerCase()
    if (t === 'seller') return 'bg-purple-100 text-purple-800'
    if (t === 'renter') return 'bg-amber-100 text-amber-900'
    if (t === 'vendor') return 'bg-slate-200 text-slate-700'
    return 'bg-blue-100 text-blue-800'
  }

  function leadTypeLabel(lt: string | null | undefined): string {
    const t = (lt || 'buyer').toLowerCase()
    return t.charAt(0).toUpperCase() + t.slice(1)
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading leads...</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Leads</h1>
        <p className="text-slate-600 mt-1">Manage and follow up with your qualified leads</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, phone, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            {(['all', 'hot', 'warm', 'cold'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  statusFilter === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)} ({statusCounts[status]})
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">
                  Lead Info
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">
                  Budget
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">
                  Timeline
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">
                  Lead type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">
                  Score
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">
                  Last Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                    {searchQuery || statusFilter !== 'all'
                      ? 'No leads match your filters'
                      : 'No leads yet. Start calling to see them here!'}
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="hover:bg-slate-50 cursor-pointer"
                    onClick={() => setSelectedLead(lead)}
                  >
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-slate-900">{lead.lead_name || 'Unknown'}</p>
                        <p className="text-sm text-slate-600">{lead.lead_phone}</p>
                        {lead.lead_email && (
                          <p className="text-xs text-slate-500">{lead.lead_email}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          lead.lead_status === 'hot'
                            ? 'bg-orange-100 text-orange-800'
                            : lead.lead_status === 'warm'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {lead.lead_status || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {lead.budget_min && lead.budget_max
                        ? `$${(lead.budget_min / 1000).toFixed(0)}K - $${(lead.budget_max / 1000).toFixed(0)}K`
                        : 'Not specified'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {lead.timeline || 'Not specified'}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${leadTypeBadgeClass(
                          lead.leads?.lead_type
                        )}`}
                      >
                        {leadTypeLabel(lead.leads?.lead_type)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-slate-700">{lead.ai_score || 0}%</span>
                        {lead.lead_status === 'hot' && lead.leads?.urgency === 'high' && (
                          <span className="text-red-600" title="High urgency">
                            🔴
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            window.location.href = `tel:${lead.lead_phone}`
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="Call"
                        >
                          <Phone className="w-4 h-4" />
                        </button>
                        {lead.lead_email && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              window.location.href = `mailto:${lead.lead_email}`
                            }}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                            title="Email"
                          >
                            <Mail className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lead Detail Modal */}
      {selectedLead && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Lead Details</h2>
              <button
                onClick={() => setSelectedLead(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Lead Info */}
              <div>
                <h3 className="font-semibold text-slate-900 mb-3">Contact Information</h3>
                <div className="space-y-2">
                  <p><span className="text-slate-600">Name:</span> <span className="font-medium">{selectedLead.lead_name || 'Unknown'}</span></p>
                  <p><span className="text-slate-600">Phone:</span> <span className="font-medium">{selectedLead.lead_phone}</span></p>
                  {selectedLead.lead_email && (
                    <p><span className="text-slate-600">Email:</span> <span className="font-medium">{selectedLead.lead_email}</span></p>
                  )}
                </div>
              </div>

              {/* Assigned agent */}
              <div>
                <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                  <UserRound className="w-4 h-4" />
                  Assigned agent
                </h3>
                {resolvedLead ? (
                  <div className="space-y-2">
                    <p className="text-sm text-slate-700">
                      Current:{' '}
                      <span className="font-medium">
                        {agents.find((a) => a.id === resolvedLead.agent_id)?.full_name || 'Unassigned'}
                      </span>
                    </p>
                    <label className="block text-xs font-medium text-slate-500">Reassign to</label>
                    <select
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                      value={resolvedLead.agent_id || ''}
                      disabled={reassignSaving}
                      onChange={(e) => handleReassignAgent(e.target.value)}
                    >
                      <option value="">Unassigned</option>
                      {agents.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.full_name || a.id.slice(0, 8)}
                        </option>
                      ))}
                    </select>
                    {reassignSaving && <p className="text-xs text-slate-500">Saving…</p>}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">
                    No CRM lead row linked to this call (no <code className="text-xs">lead_id</code> and phone did not
                    match a lead). Import or link the lead to enable reassignment.
                  </p>
                )}
              </div>

              {/* Lead CRM signals (call embed or phone-matched lead) */}
              {resolvedLead && (
                <div>
                  <h3 className="font-semibold text-slate-900 mb-3">CRM</h3>
                  <div className="flex flex-wrap gap-2 items-center mb-2">
                    <span
                      className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${leadTypeBadgeClass(
                        resolvedLead.lead_type
                      )}`}
                    >
                      {leadTypeLabel(resolvedLead.lead_type)}
                    </span>
                    {resolvedLead.urgency === 'high' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        <span className="text-red-600">🔴</span> High urgency
                      </span>
                    ) : (
                      <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                        Normal urgency
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-700">
                    <span className="text-slate-600">Nudges:</span>{' '}
                    <span className="font-medium">
                      {resolvedLead.nudge_count != null && resolvedLead.nudge_count > 0
                        ? resolvedLead.nudge_count === 1
                          ? '1 nudge sent'
                          : `${resolvedLead.nudge_count} nudges sent`
                        : 'No nudges yet'}
                    </span>
                  </p>
                  {resolvedLead.nudge_sent_at && (
                    <p className="text-sm text-slate-600 mt-1">
                      Last nudge:{' '}
                      {format(new Date(resolvedLead.nudge_sent_at), 'MMM d, yyyy h:mm a')}
                    </p>
                  )}
                </div>
              )}

              {/* Qualification */}
              <div>
                <h3 className="font-semibold text-slate-900 mb-3">Qualification Details</h3>
                <div className="space-y-2">
                  <p><span className="text-slate-600">Budget:</span> <span className="font-medium">
                    {selectedLead.budget_min && selectedLead.budget_max
                      ? `$${(selectedLead.budget_min / 1000).toFixed(0)}K - $${(selectedLead.budget_max / 1000).toFixed(0)}K`
                      : 'Not specified'}
                  </span></p>
                  <p><span className="text-slate-600">Timeline:</span> <span className="font-medium">{selectedLead.timeline || 'Not specified'}</span></p>
                  <p><span className="text-slate-600">Pre-approved:</span> <span className="font-medium">{selectedLead.pre_approved ? 'Yes' : 'No'}</span></p>
                  <p><span className="text-slate-600">AI Score:</span> <span className="font-medium">{selectedLead.ai_score}%</span></p>
                </div>
              </div>

              {/* AI Summary */}
              {selectedLead.ai_summary && (
                <div>
                  <h3 className="font-semibold text-slate-900 mb-3">AI Summary</h3>
                  <p className="text-slate-700">{selectedLead.ai_summary}</p>
                </div>
              )}

              {/* Transcript */}
              {selectedLead.transcript && (
                <div>
                  <h3 className="font-semibold text-slate-900 mb-3">Call Transcript</h3>
                  <div className="bg-slate-50 p-4 rounded-lg max-h-60 overflow-y-auto">
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{selectedLead.transcript}</p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-3">
                <div className="flex gap-3">
                  <button
                    onClick={() => window.location.href = `tel:${selectedLead.lead_phone}`}
                    className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Phone className="w-4 h-4 inline mr-2" />
                    Call Lead
                  </button>
                  {selectedLead.lead_email && (
                    <button
                      onClick={() => window.location.href = `mailto:${selectedLead.lead_email}`}
                      className="flex-1 py-2 px-4 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
                    >
                      <Mail className="w-4 h-4 inline mr-2" />
                      Send Email
                    </button>
                  )}
                </div>
                <button
                  onClick={() => handleGenerateListing(selectedLead)}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 font-medium transition-all"
                >
                  <PenTool className="w-4 h-4 inline mr-2" />
                  Generate Listing for Lead's Budget
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}








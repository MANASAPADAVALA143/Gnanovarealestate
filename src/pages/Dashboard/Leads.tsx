import React, { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase, type Call } from '../../lib/supabase'
import { Search, Filter, Phone, Mail, Calendar, X } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export default function LeadsPage() {
  const { agent } = useAuth()
  const [leads, setLeads] = useState<Call[]>([])
  const [filteredLeads, setFilteredLeads] = useState<Call[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedLead, setSelectedLead] = useState<Call | null>(null)

  useEffect(() => {
    if (agent) {
      fetchLeads()
    }
  }, [agent])

  useEffect(() => {
    filterLeads()
  }, [leads, searchQuery, statusFilter])

  async function fetchLeads() {
    try {
      const { data, error } = await supabase
        .from('calls')
        .select('*')
        .eq('agent_id', agent!.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setLeads(data || [])
    } catch (error) {
      console.error('Error fetching leads:', error)
    } finally {
      setLoading(false)
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

  const statusCounts = {
    all: leads.length,
    hot: leads.filter((l) => l.lead_status === 'hot').length,
    warm: leads.filter((l) => l.lead_status === 'warm').length,
    cold: leads.filter((l) => l.lead_status === 'cold').length,
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
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
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
                      <div className="flex items-center">
                        <span className="text-sm font-medium text-slate-700">{lead.ai_score || 0}%</span>
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
            </div>
          </div>
        </div>
      )}
    </div>
  )
}








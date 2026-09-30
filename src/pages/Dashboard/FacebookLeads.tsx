import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Loader2, Facebook, Instagram, Phone, Mail, MapPin, RefreshCw, ExternalLink, Zap } from 'lucide-react'
import { format } from 'date-fns'

type Lead = {
  id: string
  name: string
  phone: string | null
  email: string | null
  location: string | null
  source: string | null
  status: string | null
  timeline: string | null
  created_at: string
  ad_name?: string | null
  campaign_name?: string | null
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  contacted: 'bg-yellow-100 text-yellow-700',
  qualified: 'bg-green-100 text-green-700',
  lost: 'bg-red-100 text-red-700',
  converted: 'bg-purple-100 text-purple-700',
}

export default function FacebookLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'facebook' | 'instagram'>('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadLeads()
  }, [])

  async function loadLeads() {
    setLoading(true)
    const { data, error } = await supabase
      .from('leads')
      .select('id, name, phone, email, location, source, status, timeline, created_at, ad_name, campaign_name')
      .in('source', ['facebook', 'instagram', 'meta', 'facebook_lead_ads'])
      .order('created_at', { ascending: false })
    if (!error && data) setLeads(data as Lead[])
    setLoading(false)
  }

  const filtered = leads.filter((l) => {
    const matchSource =
      filter === 'all' ||
      (filter === 'facebook' && (l.source === 'facebook' || l.source === 'facebook_lead_ads')) ||
      (filter === 'instagram' && l.source === 'instagram')
    const matchSearch =
      !search ||
      l.name?.toLowerCase().includes(search.toLowerCase()) ||
      l.phone?.includes(search) ||
      l.email?.toLowerCase().includes(search.toLowerCase())
    return matchSource && matchSearch
  })

  const fbCount = leads.filter((l) => l.source === 'facebook' || l.source === 'facebook_lead_ads').length
  const igCount = leads.filter((l) => l.source === 'instagram').length
  const todayCount = leads.filter(
    (l) => new Date(l.created_at).toDateString() === new Date().toDateString()
  ).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Facebook &amp; Instagram Leads</h1>
          <p className="text-slate-500 text-sm mt-1">Leads captured from Meta Lead Ads</p>
        </div>
        <button
          onClick={loadLeads}
          className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 text-sm"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <p className="text-2xl font-bold text-slate-900">{leads.length}</p>
          <p className="text-sm text-slate-500 mt-1">Total Meta Leads</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Facebook className="w-4 h-4 text-blue-600" />
            <p className="text-2xl font-bold text-slate-900">{fbCount}</p>
          </div>
          <p className="text-sm text-slate-500">From Facebook</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Instagram className="w-4 h-4 text-pink-500" />
            <p className="text-2xl font-bold text-slate-900">{igCount}</p>
          </div>
          <p className="text-sm text-slate-500">From Instagram</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-4 h-4 text-yellow-500" />
            <p className="text-2xl font-bold text-slate-900">{todayCount}</p>
          </div>
          <p className="text-sm text-slate-500">Today</p>
        </div>
      </div>

      {/* Webhook Setup Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <p className="font-semibold mb-1">Webhook URL for Facebook Lead Ads</p>
        <code className="bg-blue-100 px-2 py-1 rounded text-xs break-all">
          https://your-domain.com/api/webhooks/facebook-leads
        </code>
        <p className="mt-2 text-blue-600">
          Verify Token: <code className="bg-blue-100 px-1 rounded">gnanova_verify_token_2025</code>
          {' '}(or set <code className="bg-blue-100 px-1 rounded">FACEBOOK_VERIFY_TOKEN</code> in .env)
        </p>
      </div>

      {/* Filters + Search */}
      <div className="flex flex-wrap gap-3 items-center">
        {(['all', 'facebook', 'instagram'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors ${
              filter === f
                ? 'bg-blue-600 text-white border-blue-600'
                : 'border-slate-200 text-slate-600 hover:border-slate-400'
            }`}
          >
            {f === 'facebook' && <Facebook className="w-3.5 h-3.5" />}
            {f === 'instagram' && <Instagram className="w-3.5 h-3.5" />}
            {f === 'all' ? 'All Sources' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, phone, email..."
          className="ml-auto border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
        />
      </div>

      {/* Leads Table */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <Facebook className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No Facebook/Instagram leads yet</p>
          <p className="text-sm mt-1">Set up your webhook in Facebook Business Manager to start capturing leads</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Lead</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Contact</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Source</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Campaign</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Date</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((lead) => (
                <tr key={lead.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{lead.name}</p>
                    {lead.location && (
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" /> {lead.location}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {lead.phone && (
                      <a href={`tel:${lead.phone}`} className="flex items-center gap-1 text-slate-700 hover:text-blue-600">
                        <Phone className="w-3.5 h-3.5" /> {lead.phone}
                      </a>
                    )}
                    {lead.email && (
                      <a href={`mailto:${lead.email}`} className="flex items-center gap-1 text-slate-500 hover:text-blue-600 mt-0.5 text-xs">
                        <Mail className="w-3 h-3" /> {lead.email}
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {lead.source === 'instagram' ? (
                      <span className="flex items-center gap-1 text-pink-600 font-medium">
                        <Instagram className="w-4 h-4" /> Instagram
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-blue-600 font-medium">
                        <Facebook className="w-4 h-4" /> Facebook
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {lead.campaign_name ? (
                      <div>
                        <p className="text-slate-700 font-medium text-xs">{lead.campaign_name}</p>
                        {lead.ad_name && <p className="text-slate-400 text-xs mt-0.5">{lead.ad_name}</p>}
                      </div>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[lead.status || 'new'] || STATUS_COLORS.new}`}>
                      {lead.status || 'new'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {format(new Date(lead.created_at), 'dd MMM, HH:mm')}
                  </td>
                  <td className="px-4 py-3">
                    <a href={`/dashboard/leads`} className="text-slate-400 hover:text-blue-600">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

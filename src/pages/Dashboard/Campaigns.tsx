import React, { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import {
  addLeadsToCampaign,
  createCampaign,
  findAudienceLeads,
  pauseCampaign,
  startCampaign,
  type ScoreBand,
} from '../../api/campaigns'
import { 
  Play, 
  Pause, 
  PlusCircle, 
  Users, 
  Phone, 
  CheckCircle, 
  XCircle,
  Clock,
  TrendingUp
} from 'lucide-react'

interface Campaign {
  id: string
  name: string
  description?: string
  status: 'draft' | 'active' | 'paused' | 'completed'
  lead_filter_status: string[]
  launch_filters?: { sources?: string[]; location?: string; bands?: string[] } | null
  leads_count: number
  calls_made: number
  calls_completed: number
  calls_failed: number
  created_at: string
  started_at?: string
  completed_at?: string
}

interface CampaignProgress {
  total_leads: number
  pending: number
  calling: number
  completed: number
  failed: number
  progress_percentage: number
}

export default function Campaigns() {
  const { agent } = useAuth()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null)
  const [campaignProgress, setCampaignProgress] = useState<Record<string, CampaignProgress>>({})

  useEffect(() => {
    fetchCampaigns()
  }, [agent])

  async function fetchCampaigns() {
    try {
      setLoading(true)
      const result = await Promise.race([
        supabase.from('outbound_campaigns').select('*').order('created_at', { ascending: false }),
        new Promise<never>((_, reject) => {
          window.setTimeout(() => reject(new Error('timeout')), 8000)
        }),
      ])
      if (result.error) throw result.error
      const rows = result.data || []
      setCampaigns(rows)
      for (const campaign of rows) {
        await fetchCampaignProgress(campaign.id)
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error)
      setCampaigns([])
    } finally {
      setLoading(false)
    }
  }

  async function fetchCampaignProgress(campaignId: string) {
    try {
      const { data, error } = await supabase
        .rpc('get_campaign_progress', { campaign_uuid: campaignId })

      if (error) throw error

      if (data && data[0]) {
        setCampaignProgress(prev => ({
          ...prev,
          [campaignId]: data[0]
        }))
      }
    } catch (error) {
      console.error('Error fetching campaign progress:', error)
    }
  }

  async function handleStartCampaign(campaignId: string) {
    if (!confirm('Start this voice campaign? Pending leads with a phone number will be called.')) return
    const result = await startCampaign(campaignId, agent?.id)
    if (result.success) {
      alert('Campaign started. Calls are being placed to pending leads.')
      fetchCampaigns()
    } else {
      alert(result.error || 'The campaign could not be started.')
    }
  }

  async function handlePauseCampaign(campaignId: string) {
    const result = await pauseCampaign(campaignId)
    if (result.success) {
      alert('Campaign paused')
      fetchCampaigns()
    } else {
      alert(result.error || 'The campaign could not be paused.')
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'completed':
        return 'bg-blue-100 text-blue-800'
      case 'paused':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'active':
        return <Play className="w-4 h-4" />
      case 'completed':
        return <CheckCircle className="w-4 h-4" />
      case 'paused':
        return <Pause className="w-4 h-4" />
      default:
        return <Clock className="w-4 h-4" />
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading campaigns...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campaign Studio</h1>
          <p className="text-sm text-gray-600 mt-1">
            Voice campaigns for a chosen audience. Delivery counts come from saved campaign records.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <PlusCircle className="w-5 h-5" />
          New Campaign
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Campaigns</p>
              <p className="text-2xl font-bold text-gray-900">{campaigns.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Play className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Active</p>
              <p className="text-2xl font-bold text-gray-900">
                {campaigns.filter(c => c.status === 'active').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Phone className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Calls Made</p>
              <p className="text-2xl font-bold text-gray-900">
                {campaigns.reduce((sum, c) => sum + c.calls_made, 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-gray-900">
                {campaigns.filter(c => c.status === 'completed').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Campaigns List */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">All Campaigns</h2>
        </div>

        {campaigns.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No campaigns yet</h3>
            <p className="text-gray-600 mb-4">
              Create your first campaign to start calling old leads
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Create Campaign
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {campaigns.map((campaign) => {
              const progress = campaignProgress[campaign.id]
              const progressPercentage = progress?.progress_percentage || 0

              return (
                <div key={campaign.id} className="p-6 hover:bg-gray-50 transition">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {campaign.name}
                        </h3>
                        <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(campaign.status)}`}>
                          {getStatusIcon(campaign.status)}
                          {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                        </span>
                      </div>

                      {campaign.description && (
                        <p className="text-sm text-gray-600 mb-3">{campaign.description}</p>
                      )}

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div>
                          <p className="text-xs text-gray-500">Total Leads</p>
                          <p className="text-lg font-semibold text-gray-900">
                            {campaign.leads_count}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Calls Made</p>
                          <p className="text-lg font-semibold text-gray-900">
                            {campaign.calls_made}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Completed</p>
                          <p className="text-lg font-semibold text-green-600">
                            {campaign.calls_completed}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Failed</p>
                          <p className="text-lg font-semibold text-red-600">
                            {campaign.calls_failed}
                          </p>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      {campaign.status === 'active' && progress && (
                        <div className="mb-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-gray-600">Progress</span>
                            <span className="text-sm font-medium text-gray-900">
                              {progressPercentage.toFixed(0)}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${progressPercentage}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between mt-1 text-xs text-gray-500">
                            <span>Pending: {progress.pending}</span>
                            <span>Calling: {progress.calling}</span>
                            <span>Done: {progress.completed + progress.failed}</span>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>Target: {(campaign.lead_filter_status || []).join(', ') || 'all statuses'}</span>
                        {campaign.launch_filters?.location ? <span> · {campaign.launch_filters.location}</span> : null}
                        {campaign.launch_filters?.bands && campaign.launch_filters.bands.length > 0 ? (
                          <span> · {campaign.launch_filters.bands.join(', ')}</span>
                        ) : null}
                        <span>•</span>
                        <span>Created {new Date(campaign.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 ml-4">
                      {campaign.status === 'draft' && (
                        <button
                          onClick={() => handleStartCampaign(campaign.id)}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                        >
                          <Play className="w-4 h-4" />
                          Start
                        </button>
                      )}

                      {campaign.status === 'active' && (
                        <button
                          onClick={() => handlePauseCampaign(campaign.id)}
                          className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition"
                        >
                          <Pause className="w-4 h-4" />
                          Pause
                        </button>
                      )}

                      {campaign.status === 'paused' && (
                        <button
                          onClick={() => handleStartCampaign(campaign.id)}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                        >
                          <Play className="w-4 h-4" />
                          Resume
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Create Campaign Modal */}
      {showCreateModal && (
        <CreateCampaignModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false)
            fetchCampaigns()
          }}
        />
      )}
    </div>
  )
}

// Create Campaign Modal Component
function CreateCampaignModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: () => void
}) {
  const { agent } = useAuth()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [leadStatuses, setLeadStatuses] = useState<string[]>(['cold'])
  const [sources, setSources] = useState<string[]>([])
  const [sourceOptions, setSourceOptions] = useState<string[]>([])
  const [location, setLocation] = useState('')
  const [bands, setBands] = useState<ScoreBand[]>([])
  const [loading, setLoading] = useState(false)
  const [leadsCount, setLeadsCount] = useState(0)
  const [withPhone, setWithPhone] = useState(0)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('leads')
      .select('source')
      .order('created_at', { ascending: false })
      .limit(500)
      .then(({ data }) => {
        if (cancelled) return
        const unique = [...new Set((data || []).map((row) => (row.source || '').trim()).filter(Boolean))]
        setSourceOptions(unique.sort())
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    findAudienceLeads(leadStatuses, { sources, location, bands }).then((result) => {
      if (cancelled) return
      setLeadsCount(result.leads.length)
      setWithPhone(result.withPhone)
    })
    return () => {
      cancelled = true
    }
  }, [leadStatuses, sources, location, bands])

  function toggleStatus(status: string) {
    setLeadStatuses((current) =>
      current.includes(status) ? current.filter((item) => item !== status) : [...current, status]
    )
  }

  function toggleSource(source: string) {
    setSources((current) =>
      current.includes(source) ? current.filter((item) => item !== source) : [...current, source]
    )
  }

  function toggleBand(band: ScoreBand) {
    setBands((current) => (current.includes(band) ? current.filter((item) => item !== band) : [...current, band]))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!name.trim()) {
      setFormError('Enter a campaign name.')
      return
    }
    if (leadStatuses.length === 0) {
      setFormError('Select at least one lead status.')
      return
    }
    if (leadsCount === 0) {
      setFormError('No leads match this audience.')
      return
    }

    setLoading(true)
    const created = await createCampaign({
      name: name.trim(),
      description,
      leadFilterStatus: leadStatuses,
      agentId: agent?.id,
      audience: { sources, location, bands },
    })
    if (!created.success || !created.campaign) {
      setLoading(false)
      setFormError(created.error || 'The campaign could not be saved.')
      return
    }
    const attached = await addLeadsToCampaign(created.campaign.id)
    setLoading(false)
    if (!attached.success) {
      setFormError(attached.error || 'The campaign was saved, but the audience could not be attached.')
      return
    }
    onSuccess()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">New voice campaign</h2>
        <p className="text-sm text-gray-500 mb-4">Saves a draft and the matching leads. Starting it places real calls.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{formError}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Campaign name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Re-engage cold leads"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this campaign is for"
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Lead status</label>
            <div className="flex flex-wrap gap-3">
              {['cold', 'warm', 'new', 'hot'].map((status) => (
                <label key={status} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={leadStatuses.includes(status)}
                    onChange={() => toggleStatus(status)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 capitalize">{status}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Score band</label>
            <div className="flex flex-wrap gap-3">
              {(['hot', 'warm', 'cold', 'unscored'] as ScoreBand[]).map((band) => (
                <label key={band} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bands.includes(band)}
                    onChange={() => toggleBand(band)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 capitalize">{band}</span>
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-gray-500">Leave all unchecked to include every score.</p>
          </div>
          {sourceOptions.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Source</label>
              <div className="flex flex-wrap gap-3">
                {sourceOptions.map((source) => (
                  <label key={source} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sources.includes(source)}
                      onChange={() => toggleSource(source)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{source}</span>
                  </label>
                ))}
              </div>
              <p className="mt-1 text-xs text-gray-500">Leave all unchecked to include every source.</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location contains</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Tirupathi"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm font-medium text-gray-900">{leadsCount} leads match</p>
            <p className="text-xs text-gray-600">{withPhone} have a phone number and can be called</p>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              disabled={loading || leadsCount === 0}
            >
              {loading ? 'Saving...' : 'Save draft'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

import React, { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { X } from 'lucide-react'
import {
  fetchPipelineLeads,
  updateLeadPipelineStage,
  type PipelineLead,
  type PipelineStage,
} from '../../lib/crm'
import PipelineKanban from '../../components/crm/PipelineKanban'
import LeadTimeline from '../../components/crm/LeadTimeline'
import ConsentBadge from '../../components/crm/ConsentBadge'

export default function PipelinePage() {
  const { agent, loading: authLoading } = useAuth()
  const [leads, setLeads] = useState<PipelineLead[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLead, setSelectedLead] = useState<PipelineLead | null>(null)

  useEffect(() => {
    if (authLoading || !agent) {
      setLoading(false)
      return
    }
    loadLeads()
  }, [agent, authLoading])

  async function loadLeads() {
    setLoading(true)
    try {
      const data = await fetchPipelineLeads(agent!.id)
      setLeads(data)
    } catch (e) {
      console.error('Pipeline fetch failed:', e)
    } finally {
      setLoading(false)
    }
  }

  async function handleStageChange(leadId: string, stage: PipelineStage) {
    await updateLeadPipelineStage(leadId, stage)
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, pipeline_stage: stage } : l))
    )
    if (selectedLead?.id === leadId) {
      setSelectedLead((prev) => (prev ? { ...prev, pipeline_stage: stage } : null))
    }
  }

  if (authLoading) {
    return <div className="flex items-center justify-center h-64 text-slate-600">Loading…</div>
  }

  if (!agent) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-950 max-w-lg">
        <h2 className="font-semibold text-lg">No agent profile</h2>
        <p className="mt-2 text-sm">Sign in with an agent account to view the pipeline.</p>
      </div>
    )
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading pipeline…</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Deal Pipeline</h1>
        <p className="text-slate-600 mt-1">
          Drag leads between stages. Click a card to open the Lead 360 timeline.
        </p>
      </div>

      <PipelineKanban
        leads={leads}
        onStageChange={handleStageChange}
        onCardClick={setSelectedLead}
      />

      {selectedLead && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[85vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{selectedLead.name}</h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  <ConsentBadge leadId={selectedLead.id} />
                  <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700">
                    {selectedLead.source || 'Unknown'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedLead(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <h3 className="font-semibold text-slate-900 mb-4">Lead 360 Timeline</h3>
              <LeadTimeline leadId={selectedLead.id} agentId={agent.id} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

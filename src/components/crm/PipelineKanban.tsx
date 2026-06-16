import React, { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import {
  PIPELINE_STAGES,
  PIPELINE_STAGE_LABELS,
  type PipelineLead,
  type PipelineStage,
} from '../../lib/crm'

type Props = {
  leads: PipelineLead[]
  onStageChange: (leadId: string, stage: PipelineStage) => Promise<void>
  onCardClick: (lead: PipelineLead) => void
}

function propertyLabel(lead: PipelineLead): string {
  return lead.property_address || lead.interested_in || '—'
}

function KanbanCard({
  lead,
  onDragStart,
  onClick,
}: {
  lead: PipelineLead
  onDragStart: (e: React.DragEvent, leadId: string) => void
  onClick: () => void
}) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, lead.id)}
      onClick={onClick}
      className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm cursor-grab active:cursor-grabbing hover:border-blue-300 hover:shadow transition-all"
    >
      <p className="font-medium text-slate-900 text-sm truncate">{lead.name}</p>
      <p className="text-xs text-slate-500 mt-1">{lead.source || 'Unknown source'}</p>
      <p className="text-xs text-slate-600 mt-1 truncate">
        Agent: {lead.agents?.full_name || 'Unassigned'}
      </p>
      <p className="text-xs text-slate-500 mt-1 truncate" title={propertyLabel(lead)}>
        Property: {propertyLabel(lead)}
      </p>
      <p className="text-xs text-slate-400 mt-2">
        {lead.last_activity_at
          ? formatDistanceToNow(new Date(lead.last_activity_at), { addSuffix: true })
          : 'No activity'}
      </p>
    </div>
  )
}

export default function PipelineKanban({ leads, onStageChange, onCardClick }: Props) {
  const [dragLeadId, setDragLeadId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<PipelineStage | null>(null)
  const [moving, setMoving] = useState(false)

  function handleDragStart(e: React.DragEvent, leadId: string) {
    setDragLeadId(leadId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', leadId)
  }

  function handleDragOver(e: React.DragEvent, stage: PipelineStage) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropTarget(stage)
  }

  function handleDragLeave() {
    setDropTarget(null)
  }

  async function handleDrop(e: React.DragEvent, stage: PipelineStage) {
    e.preventDefault()
    setDropTarget(null)
    const leadId = e.dataTransfer.getData('text/plain') || dragLeadId
    if (!leadId) return

    const lead = leads.find((l) => l.id === leadId)
    if (!lead || lead.pipeline_stage === stage) {
      setDragLeadId(null)
      return
    }

    setMoving(true)
    try {
      await onStageChange(leadId, stage)
    } finally {
      setMoving(false)
      setDragLeadId(null)
    }
  }

  const byStage = (stage: PipelineStage) =>
    leads.filter((l) => (l.pipeline_stage || 'new') === stage)

  return (
    <div className="relative">
      {moving && (
        <div className="absolute inset-0 bg-white/60 z-10 flex items-center justify-center rounded-xl">
          <span className="text-sm text-slate-600">Updating stage…</span>
        </div>
      )}
      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[480px]">
        {PIPELINE_STAGES.map((stage) => {
          const columnLeads = byStage(stage)
          const isDropTarget = dropTarget === stage
          return (
            <div
              key={stage}
              className={`flex-shrink-0 w-72 rounded-xl border ${
                isDropTarget ? 'border-blue-400 bg-blue-50/50' : 'border-slate-200 bg-slate-50'
              }`}
              onDragOver={(e) => handleDragOver(e, stage)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, stage)}
            >
              <div className="p-3 border-b border-slate-200 bg-white rounded-t-xl">
                <h3 className="font-semibold text-sm text-slate-800">
                  {PIPELINE_STAGE_LABELS[stage]}
                </h3>
                <span className="text-xs text-slate-500">{columnLeads.length} leads</span>
              </div>
              <div className="p-2 space-y-2 min-h-[120px] max-h-[calc(100vh-280px)] overflow-y-auto">
                {columnLeads.map((lead) => (
                  <KanbanCard
                    key={lead.id}
                    lead={lead}
                    onDragStart={handleDragStart}
                    onClick={() => onCardClick(lead)}
                  />
                ))}
                {columnLeads.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-6">Drop leads here</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

import React, { useState } from 'react'
import { differenceInDays, formatDistanceToNow } from 'date-fns'
import {
  DEAL_STAGES,
  DEAL_STAGE_LABELS,
  dealDisplayName,
  formatAed,
  type DealRow,
  type DealStage,
} from '../../lib/deals'

type Props = {
  deals: DealRow[]
  onStageChange: (dealId: string, stage: DealStage) => Promise<void>
  onCardClick: (deal: DealRow) => void
}

function KanbanCard({
  deal,
  onDragStart,
  onClick,
}: {
  deal: DealRow
  onDragStart: (e: React.DragEvent, dealId: string) => void
  onClick: () => void
}) {
  const daysInStage = differenceInDays(new Date(), new Date(deal.stage_entered_at))

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, deal.id)}
      onClick={onClick}
      className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm cursor-grab active:cursor-grabbing hover:border-emerald-300 hover:shadow transition-all"
    >
      <p className="font-medium text-slate-900 text-sm truncate">{dealDisplayName(deal)}</p>
      <p className="text-xs text-slate-500 mt-1 truncate">
        {deal.unit_number ? `Unit ${deal.unit_number}` : 'No unit'}
        {deal.project_name ? ` · ${deal.project_name}` : ''}
      </p>
      <p className="text-xs font-semibold text-emerald-700 mt-1">{formatAed(deal.sale_value)}</p>
      <p className="text-xs text-slate-600 mt-1 truncate">
        Agent: {deal.agents?.full_name || 'Unassigned'}
      </p>
      <p className="text-xs text-slate-400 mt-2">
        {daysInStage === 0
          ? 'Entered stage today'
          : `${daysInStage}d in stage · ${formatDistanceToNow(new Date(deal.stage_entered_at), { addSuffix: true })}`}
      </p>
    </div>
  )
}

export default function DealsKanban({ deals, onStageChange, onCardClick }: Props) {
  const [dragDealId, setDragDealId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<DealStage | null>(null)
  const [moving, setMoving] = useState(false)

  function handleDragStart(e: React.DragEvent, dealId: string) {
    setDragDealId(dealId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', dealId)
  }

  function handleDragOver(e: React.DragEvent, stage: DealStage) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropTarget(stage)
  }

  function handleDragLeave() {
    setDropTarget(null)
  }

  async function handleDrop(e: React.DragEvent, stage: DealStage) {
    e.preventDefault()
    setDropTarget(null)
    const dealId = e.dataTransfer.getData('text/plain') || dragDealId
    if (!dealId) return

    const deal = deals.find((d) => d.id === dealId)
    if (!deal || deal.stage === stage) {
      setDragDealId(null)
      return
    }

    setMoving(true)
    try {
      await onStageChange(dealId, stage)
    } finally {
      setMoving(false)
      setDragDealId(null)
    }
  }

  const byStage = (stage: DealStage) => deals.filter((d) => d.stage === stage)

  return (
    <div className="relative">
      {moving && (
        <div className="absolute inset-0 bg-white/60 z-10 flex items-center justify-center rounded-xl">
          <span className="text-sm text-slate-600">Updating stage…</span>
        </div>
      )}
      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[480px]">
        {DEAL_STAGES.map((stage) => {
          const columnDeals = byStage(stage)
          const isDropTarget = dropTarget === stage
          return (
            <div
              key={stage}
              className={`flex-shrink-0 w-72 rounded-xl border ${
                isDropTarget ? 'border-emerald-400 bg-emerald-50/50' : 'border-slate-200 bg-slate-50'
              }`}
              onDragOver={(e) => handleDragOver(e, stage)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, stage)}
            >
              <div className="p-3 border-b border-slate-200 bg-white rounded-t-xl">
                <h3 className="font-semibold text-sm text-slate-800">{DEAL_STAGE_LABELS[stage]}</h3>
                <span className="text-xs text-slate-500">{columnDeals.length} deals</span>
              </div>
              <div className="p-2 space-y-2 min-h-[120px] max-h-[calc(100vh-280px)] overflow-y-auto">
                {columnDeals.map((deal) => (
                  <KanbanCard
                    key={deal.id}
                    deal={deal}
                    onDragStart={handleDragStart}
                    onClick={() => onCardClick(deal)}
                  />
                ))}
                {columnDeals.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-6">Drop deals here</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

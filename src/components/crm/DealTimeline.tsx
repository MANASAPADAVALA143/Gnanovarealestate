import React, { useEffect, useState } from 'react'
import { GitBranch, StickyNote, DollarSign, FileText, Loader2, Settings, BadgeCheck } from 'lucide-react'
import { format } from 'date-fns'
import { addDealNote, fetchDealActivities, type DealActivity } from '../../lib/deals'

const ACTIVITY_ICONS: Record<DealActivity['activity_type'], React.ElementType> = {
  stage_change: GitBranch,
  note: StickyNote,
  amount_update: DollarSign,
  document: FileText,
  system: Settings,
  commission_status_change: BadgeCheck,
}

const ACTIVITY_COLORS: Record<DealActivity['activity_type'], string> = {
  stage_change: 'bg-slate-200 text-slate-700',
  note: 'bg-amber-100 text-amber-800',
  amount_update: 'bg-emerald-100 text-emerald-700',
  document: 'bg-indigo-100 text-indigo-700',
  system: 'bg-blue-100 text-blue-700',
  commission_status_change: 'bg-violet-100 text-violet-800',
}

type Props = {
  dealId: string
  agentId?: string | null
  activityTypes?: DealActivity['activity_type'][]
  showNoteForm?: boolean
}

export default function DealTimeline({
  dealId,
  agentId,
  activityTypes,
  showNoteForm = true,
}: Props) {
  const [activities, setActivities] = useState<DealActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const rows = await fetchDealActivities(dealId)
      setActivities(rows)
    } catch (e) {
      console.error('Failed to load deal timeline:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [dealId])

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault()
    if (!note.trim()) return
    setSaving(true)
    try {
      await addDealNote(dealId, note.trim(), agentId)
      setNote('')
      await load()
    } catch (err) {
      console.error('Failed to add deal note:', err)
    } finally {
      setSaving(false)
    }
  }

  const visibleActivities = activityTypes?.length
    ? activities.filter((a) => activityTypes.includes(a.activity_type))
    : activities

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading timeline…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {showNoteForm && (
        <form onSubmit={handleAddNote} className="flex gap-2">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note…"
            className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            type="submit"
            disabled={saving || !note.trim()}
            className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Add'}
          </button>
        </form>
      )}

      {visibleActivities.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-6">No activity yet for this deal.</p>
      ) : (
        <ul className="space-y-3">
          {visibleActivities.map((activity) => {
            const Icon = ACTIVITY_ICONS[activity.activity_type] || StickyNote
            const colorClass =
              ACTIVITY_COLORS[activity.activity_type] || 'bg-slate-100 text-slate-700'
            return (
              <li key={activity.id} className="flex gap-3">
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${colorClass}`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0 pb-3 border-b border-slate-100 last:border-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                      {activity.activity_type.replace('_', ' ')}
                    </span>
                    <time className="text-xs text-slate-400">
                      {format(new Date(activity.created_at), 'MMM d, yyyy h:mm a')}
                    </time>
                  </div>
                  <p className="text-sm text-slate-800 mt-1 whitespace-pre-wrap">
                    {activity.description}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

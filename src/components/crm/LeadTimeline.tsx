import React, { useEffect, useState } from 'react'
import {
  Phone,
  MessageCircle,
  Mail,
  StickyNote,
  GitBranch,
  Home,
  CheckSquare,
  Loader2,
} from 'lucide-react'
import { format } from 'date-fns'
import { addLeadNote, fetchLeadActivities, type LeadActivity, type LeadActivityType } from '../../lib/crm'

const ACTIVITY_ICONS: Record<LeadActivityType, React.ElementType> = {
  call: Phone,
  whatsapp: MessageCircle,
  email: Mail,
  note: StickyNote,
  stage_change: GitBranch,
  viewing: Home,
  task: CheckSquare,
}

const ACTIVITY_COLORS: Record<LeadActivityType, string> = {
  call: 'bg-blue-100 text-blue-700',
  whatsapp: 'bg-green-100 text-green-700',
  email: 'bg-purple-100 text-purple-700',
  note: 'bg-amber-100 text-amber-800',
  stage_change: 'bg-slate-200 text-slate-700',
  viewing: 'bg-indigo-100 text-indigo-700',
  task: 'bg-teal-100 text-teal-700',
}

type Props = {
  leadId: string
  agentId?: string | null
}

export default function LeadTimeline({ leadId, agentId }: Props) {
  const [activities, setActivities] = useState<LeadActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const rows = await fetchLeadActivities(leadId)
      setActivities(rows)
    } catch (e) {
      console.error('Failed to load activities:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [leadId])

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault()
    if (!note.trim()) return
    setSaving(true)
    try {
      await addLeadNote(leadId, note.trim(), agentId)
      setNote('')
      await load()
    } catch (err) {
      console.error('Failed to add note:', err)
    } finally {
      setSaving(false)
    }
  }

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
      <form onSubmit={handleAddNote} className="flex gap-2">
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note…"
          className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={saving || !note.trim()}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Add'}
        </button>
      </form>

      {activities.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-6">No activity yet for this lead.</p>
      ) : (
        <ul className="space-y-3">
          {activities.map((activity) => {
            const Icon = ACTIVITY_ICONS[activity.type] || StickyNote
            const colorClass = ACTIVITY_COLORS[activity.type] || 'bg-slate-100 text-slate-700'
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
                      {activity.type.replace('_', ' ')}
                    </span>
                    <time className="text-xs text-slate-400">
                      {format(new Date(activity.created_at), 'MMM d, yyyy h:mm a')}
                    </time>
                  </div>
                  <p className="text-sm text-slate-800 mt-1 whitespace-pre-wrap">{activity.content}</p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

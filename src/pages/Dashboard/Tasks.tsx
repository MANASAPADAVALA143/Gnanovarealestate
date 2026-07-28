import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { format, isToday, isPast } from 'date-fns'
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react'
import { completeLeadTask, fetchLeadTasks, type LeadTask } from '../../lib/crm'

type AgentPick = { id: string; full_name: string | null }

function taskTypeLabel(type: string): string {
  switch (type) {
    case 'follow_up_24h':
      return '24h Follow-up'
    case 'follow_up_48h':
      return '48h Follow-up'
    case 'viewing_reminder':
      return 'Viewing Reminder'
    default:
      return 'Custom Task'
  }
}

export default function TasksPage() {
  const { agent, loading: authLoading } = useAuth()
  const [tasks, setTasks] = useState<LeadTask[]>([])
  const [agents, setAgents] = useState<AgentPick[]>([])
  const [filterAgentId, setFilterAgentId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [completingId, setCompletingId] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading || !agent) {
      setLoading(false)
      return
    }
    loadAgents()
    loadTasks()
  }, [agent, authLoading, filterAgentId])

  async function loadAgents() {
    const { data } = await supabase.from('agents_directory').select('id, full_name').order('full_name')
    setAgents((data as AgentPick[]) || [])
  }

  async function loadTasks() {
    setLoading(true)
    try {
      const rows = await fetchLeadTasks(agent!.id, filterAgentId || null)
      setTasks(rows)
    } catch (e) {
      console.error('Tasks fetch failed:', e)
    } finally {
      setLoading(false)
    }
  }

  const grouped = useMemo(() => {
    const overdue: LeadTask[] = []
    const today: LeadTask[] = []
    const upcoming: LeadTask[] = []

    for (const task of tasks) {
      const due = new Date(task.due_at)
      if (isPast(due) && !isToday(due)) {
        overdue.push(task)
      } else if (isToday(due)) {
        today.push(task)
      } else {
        upcoming.push(task)
      }
    }

    return { overdue, today, upcoming }
  }, [tasks])

  async function handleComplete(task: LeadTask) {
    setCompletingId(task.id)
    try {
      await completeLeadTask(task.id, task.lead_id, agent!.id)
      setTasks((prev) => prev.filter((t) => t.id !== task.id))
    } catch (e) {
      console.error('Complete task failed:', e)
    } finally {
      setCompletingId(null)
    }
  }

  function TaskSection({
    title,
    items,
    variant,
  }: {
    title: string
    items: LeadTask[]
    variant: 'overdue' | 'today' | 'upcoming'
  }) {
    const borderClass =
      variant === 'overdue'
        ? 'border-red-200'
        : variant === 'today'
          ? 'border-amber-200'
          : 'border-slate-200'

    return (
      <div className={`bg-white rounded-xl border ${borderClass}`}>
        <div className="p-4 border-b border-slate-100 flex items-center gap-2">
          {variant === 'overdue' && <AlertCircle className="w-5 h-5 text-red-500" />}
          {variant === 'today' && <Clock className="w-5 h-5 text-amber-500" />}
          {variant === 'upcoming' && <Clock className="w-5 h-5 text-slate-400" />}
          <h2 className="font-semibold text-slate-900">
            {title} ({items.length})
          </h2>
        </div>
        {items.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">None</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((task) => {
              const lead = task.leads
              const isOverdue = variant === 'overdue'
              return (
                <li
                  key={task.id}
                  className={`p-4 flex items-center justify-between gap-4 ${
                    isOverdue ? 'bg-red-50' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <p className={`font-medium ${isOverdue ? 'text-red-900' : 'text-slate-900'}`}>
                      {lead?.name || 'Unknown lead'}
                    </p>
                    <p className="text-sm text-slate-600">{lead?.phone}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {taskTypeLabel(task.type)} · Due{' '}
                      {format(new Date(task.due_at), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                  <button
                    onClick={() => handleComplete(task)}
                    disabled={completingId === task.id}
                    className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {completingId === task.id ? '…' : 'Done'}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    )
  }

  if (authLoading) {
    return <div className="flex items-center justify-center h-64 text-slate-600">Loading…</div>
  }

  if (!agent) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-950 max-w-lg">
        <h2 className="font-semibold text-lg">No agent profile</h2>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tasks & Reminders</h1>
          <p className="text-slate-600 mt-1">Follow-ups due today, overdue, and upcoming</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600">Agent:</label>
          <select
            value={filterAgentId}
            onChange={(e) => setFilterAgentId(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">My tasks</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.full_name || a.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading tasks…</div>
      ) : (
        <div className="space-y-6">
          <TaskSection title="Overdue" items={grouped.overdue} variant="overdue" />
          <TaskSection title="Due Today" items={grouped.today} variant="today" />
          <TaskSection title="Upcoming" items={grouped.upcoming} variant="upcoming" />
        </div>
      )}
    </div>
  )
}

import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { fetchOverdueFollowUpsByAgent, type AgentOverdueCount } from '../../lib/crm'

export default function OverdueFollowUpsWidget() {
  const [rows, setRows] = useState<AgentOverdueCount[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchOverdueFollowUpsByAgent()
        setRows(data)
      } catch (e) {
        console.error('Overdue follow-ups fetch failed:', e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const totalOverdue = rows.reduce((sum, r) => sum + r.overdue_count, 0)

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="p-6 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <h2 className="text-lg font-semibold text-slate-900">Overdue Follow-ups</h2>
        </div>
        <Link to="/dashboard/tasks" className="text-sm text-blue-600 hover:text-blue-700">
          View tasks →
        </Link>
      </div>
      <div className="p-6">
        {loading ? (
          <div className="flex items-center text-slate-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            Loading…
          </div>
        ) : totalOverdue === 0 ? (
          <p className="text-sm text-slate-500">No overdue follow-ups across the team. 🎉</p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-red-600 font-medium">{totalOverdue} overdue task(s) team-wide</p>
            <ul className="space-y-2">
              {rows.map((row) => (
                <li
                  key={row.agent_id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-red-50 border border-red-100"
                >
                  <span className="text-sm font-medium text-slate-800">
                    {row.full_name || row.agent_id.slice(0, 8)}
                  </span>
                  <span className="text-sm font-bold text-red-700">{row.overdue_count}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

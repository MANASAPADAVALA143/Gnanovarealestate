import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Loader2, MessageCircle, Flame, ThermometerSun, Snowflake, RefreshCw } from 'lucide-react'
import { format } from 'date-fns'

type BotSession = {
  id: string
  lead_id: string
  phone: string
  step: number
  answer_1: string | null
  answer_2: string | null
  answer_3: string | null
  score: 'Hot' | 'Warm' | 'Cold' | null
  created_at: string
  leads?: { name: string | null; phone: string | null } | null
}

const SCORE_STYLE = {
  Hot: { bg: 'bg-red-100 text-red-700', icon: Flame, label: 'Hot 🔥' },
  Warm: { bg: 'bg-yellow-100 text-yellow-700', icon: ThermometerSun, label: 'Warm' },
  Cold: { bg: 'bg-blue-100 text-blue-600', icon: Snowflake, label: 'Cold' },
}

const STEP_LABEL = ['Sent Q1', 'Sent Q2', 'Sent Q3', 'Completed']

const INTENT = ['—', 'Self Use', 'Investment']
const BUDGET = ['—', 'Below AED 500K', 'AED 500K–2M', 'Above AED 2M']
const TIMELINE = ['—', 'This week', 'Next week', 'Just exploring']

export default function WhatsAppBotPage() {
  const [sessions, setSessions] = useState<BotSession[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'All' | 'Hot' | 'Warm' | 'Cold' | 'In Progress'>('All')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('whatsapp_bot_sessions')
      .select('*, leads(name, phone)')
      .order('created_at', { ascending: false })
    if (data) setSessions(data as BotSession[])
    setLoading(false)
  }

  const filtered = sessions.filter((s) => {
    if (filter === 'In Progress') return s.score === null
    if (filter === 'All') return true
    return s.score === filter
  })

  const hotCount = sessions.filter((s) => s.score === 'Hot').length
  const warmCount = sessions.filter((s) => s.score === 'Warm').length
  const coldCount = sessions.filter((s) => s.score === 'Cold').length
  const inProgressCount = sessions.filter((s) => s.score === null).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">WhatsApp Qualification Bot</h1>
          <p className="text-slate-500 text-sm mt-1">Auto-qualifies every new lead via WhatsApp</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 text-sm">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* How it works */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-green-800 mb-2">How the bot works</p>
        <div className="flex flex-wrap gap-2 text-xs text-green-700">
          <span className="bg-white border border-green-200 rounded-lg px-3 py-1.5">1️⃣ New lead arrives</span>
          <span className="text-green-400">→</span>
          <span className="bg-white border border-green-200 rounded-lg px-3 py-1.5">2️⃣ Bot sends Q1: Buy intent?</span>
          <span className="text-green-400">→</span>
          <span className="bg-white border border-green-200 rounded-lg px-3 py-1.5">3️⃣ Q2: Budget?</span>
          <span className="text-green-400">→</span>
          <span className="bg-white border border-green-200 rounded-lg px-3 py-1.5">4️⃣ Q3: When to visit?</span>
          <span className="text-green-400">→</span>
          <span className="bg-white border border-green-200 rounded-lg px-3 py-1.5">5️⃣ Scored Hot / Warm / Cold</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <p className="text-2xl font-bold text-slate-900">{sessions.length}</p>
          <p className="text-sm text-slate-500 mt-1">Total Qualified</p>
        </div>
        <div className="bg-red-50 rounded-xl border border-red-100 p-4">
          <p className="text-2xl font-bold text-red-600">{hotCount}</p>
          <p className="text-sm text-red-500 mt-1">🔥 Hot Leads</p>
        </div>
        <div className="bg-yellow-50 rounded-xl border border-yellow-100 p-4">
          <p className="text-2xl font-bold text-yellow-600">{warmCount}</p>
          <p className="text-sm text-yellow-500 mt-1">Warm Leads</p>
        </div>
        <div className="bg-blue-50 rounded-xl border border-blue-100 p-4">
          <p className="text-2xl font-bold text-blue-600">{coldCount}</p>
          <p className="text-sm text-blue-500 mt-1">Cold Leads</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {(['All', 'Hot', 'Warm', 'Cold', 'In Progress'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
              filter === f ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600 hover:border-slate-400'
            }`}>
            {f} {f === 'In Progress' ? `(${inProgressCount})` : ''}
          </button>
        ))}
      </div>

      {/* Sessions Table */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No bot sessions yet</p>
          <p className="text-sm mt-1">Sessions start automatically when new leads arrive with a phone number</p>
          <p className="text-xs mt-1 text-slate-300">Requires Twilio credentials in .env</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Lead</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Intent</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Budget</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Timeline</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Score</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((s) => {
                const scoreInfo = s.score ? SCORE_STYLE[s.score] : null
                return (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{s.leads?.name || '—'}</p>
                      <p className="text-xs text-slate-500">{s.phone}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{INTENT[Number(s.answer_1)] || '—'}</td>
                    <td className="px-4 py-3 text-slate-700">{BUDGET[Number(s.answer_2)] || '—'}</td>
                    <td className="px-4 py-3 text-slate-700">{TIMELINE[Number(s.answer_3)] || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        s.score ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {s.score ? STEP_LABEL[3] : STEP_LABEL[s.step] || 'Pending'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {scoreInfo ? (
                        <span className={`text-xs px-2 py-1 rounded-full font-semibold ${scoreInfo.bg}`}>
                          {scoreInfo.label}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Pending...</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {format(new Date(s.created_at), 'dd MMM, HH:mm')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

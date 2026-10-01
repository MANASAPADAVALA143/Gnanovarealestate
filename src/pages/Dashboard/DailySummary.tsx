import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Loader2, Send, CheckCircle, AlertCircle, Sun, Users, Flame, Building2, CreditCard, Bot } from 'lucide-react'

type Stats = {
  newLeads: number
  totalLeads: number
  hotLeads: number
  botSessions: number
  hotFromBot: number
  availableSuites: number
  dealsToday: number
  paymentsDue: number
}

export default function DailySummaryPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ownerPhone, setOwnerPhone] = useState('')

  useEffect(() => { loadStats() }, [])

  async function loadStats() {
    setLoading(true)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const startISO = today.toISOString()
    const todayStr = new Date().toISOString().split('T')[0]

    const [
      { count: newLeads },
      { count: totalLeads },
      { count: hotLeads },
      { count: botSessions },
      { count: hotFromBot },
      { count: availableSuites },
      { count: dealsToday },
      { count: paymentsDue },
    ] = await Promise.all([
      supabase.from('leads').select('*', { count: 'exact', head: true }).gte('created_at', startISO),
      supabase.from('leads').select('*', { count: 'exact', head: true }),
      supabase.from('leads').select('*', { count: 'exact', head: true }).gte('ai_score', 80),
      supabase.from('whatsapp_bot_sessions').select('*', { count: 'exact', head: true }).gte('created_at', startISO),
      supabase.from('whatsapp_bot_sessions').select('*', { count: 'exact', head: true }).eq('score', 'Hot').gte('created_at', startISO),
      supabase.from('suites').select('*', { count: 'exact', head: true }).eq('status', 'available'),
      supabase.from('deals').select('*', { count: 'exact', head: true }).eq('status', 'closed_won').gte('updated_at', startISO),
      supabase.from('payments').select('*', { count: 'exact', head: true }).eq('due_date', todayStr).eq('status', 'pending'),
    ])

    setStats({
      newLeads: newLeads || 0,
      totalLeads: totalLeads || 0,
      hotLeads: hotLeads || 0,
      botSessions: botSessions || 0,
      hotFromBot: hotFromBot || 0,
      availableSuites: availableSuites || 0,
      dealsToday: dealsToday || 0,
      paymentsDue: paymentsDue || 0,
    })
    setLoading(false)
  }

  async function sendSummary() {
    if (!ownerPhone.trim()) {
      setError('Please enter the owner WhatsApp number')
      return
    }
    setSending(true)
    setError(null)
    try {
      const res = await fetch(
        `https://mhdnoufdloigblgcypjl.supabase.co/functions/v1/daily-summary`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' } }
      )
      if (res.ok) {
        setSent(true)
        setTimeout(() => setSent(false), 5000)
      } else {
        setError('Failed to send. Check OWNER_PHONE in Supabase secrets.')
      }
    } catch {
      setError('Network error — check Supabase function is deployed.')
    }
    setSending(false)
  }

  const today = new Date().toLocaleDateString('en-AE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Daily Summary</h1>
          <p className="text-slate-500 text-sm mt-1">Morning WhatsApp report for the owner — {today}</p>
        </div>
        <button onClick={loadStats} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 text-sm">
          Refresh
        </button>
      </div>

      {/* Send Panel */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Sun className="w-5 h-5 text-green-600" />
          <p className="font-semibold text-green-800">Send Daily Summary via WhatsApp</p>
        </div>
        <p className="text-sm text-green-700 mb-4">
          The owner's phone number is set via <code className="bg-white px-1 rounded">OWNER_PHONE</code> in Supabase secrets. Click Send to dispatch now.
        </p>
        <div className="flex gap-3">
          <button
            onClick={sendSummary}
            disabled={sending || sent}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              sent ? 'bg-green-600 text-white' : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : sent ? <CheckCircle className="w-4 h-4" /> : <Send className="w-4 h-4" />}
            {sending ? 'Sending...' : sent ? 'Sent!' : 'Send Now'}
          </button>
        </div>
        {error && (
          <div className="mt-3 flex items-center gap-2 text-red-600 text-sm">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}
        {sent && (
          <div className="mt-3 flex items-center gap-2 text-green-700 text-sm">
            <CheckCircle className="w-4 h-4" /> Summary sent to owner's WhatsApp!
          </div>
        )}
      </div>

      {/* Stats Grid */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-100 p-4">
              <div className="flex items-center gap-2 mb-2"><Users className="w-4 h-4 text-blue-500" /><span className="text-xs text-slate-500">New Leads Today</span></div>
              <p className="text-3xl font-bold text-slate-900">{stats.newLeads}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-100 p-4">
              <div className="flex items-center gap-2 mb-2"><Flame className="w-4 h-4 text-red-500" /><span className="text-xs text-slate-500">Hot Leads</span></div>
              <p className="text-3xl font-bold text-red-600">{stats.hotLeads}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-100 p-4">
              <div className="flex items-center gap-2 mb-2"><Bot className="w-4 h-4 text-purple-500" /><span className="text-xs text-slate-500">Bot Sessions Today</span></div>
              <p className="text-3xl font-bold text-purple-600">{stats.botSessions}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-100 p-4">
              <div className="flex items-center gap-2 mb-2"><Building2 className="w-4 h-4 text-green-500" /><span className="text-xs text-slate-500">Available Suites</span></div>
              <p className="text-3xl font-bold text-green-600">{stats.availableSuites}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-slate-100 p-4">
              <div className="flex items-center gap-2 mb-2"><Users className="w-4 h-4 text-slate-400" /><span className="text-xs text-slate-500">Total Leads</span></div>
              <p className="text-3xl font-bold text-slate-900">{stats.totalLeads}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-100 p-4">
              <div className="flex items-center gap-2 mb-2"><Flame className="w-4 h-4 text-orange-500" /><span className="text-xs text-slate-500">Hot from Bot Today</span></div>
              <p className="text-3xl font-bold text-orange-600">{stats.hotFromBot}</p>
            </div>
            <div className={`rounded-xl border p-4 ${stats.paymentsDue > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-100'}`}>
              <div className="flex items-center gap-2 mb-2"><CreditCard className={`w-4 h-4 ${stats.paymentsDue > 0 ? 'text-red-500' : 'text-slate-400'}`} /><span className="text-xs text-slate-500">Payments Due Today</span></div>
              <p className={`text-3xl font-bold ${stats.paymentsDue > 0 ? 'text-red-600' : 'text-slate-900'}`}>{stats.paymentsDue}</p>
              {stats.paymentsDue > 0 && <p className="text-xs text-red-500 mt-1">⚠️ Action needed</p>}
            </div>
          </div>

          {/* Preview of WhatsApp message */}
          <div className="bg-slate-900 rounded-xl p-5">
            <p className="text-slate-400 text-xs mb-3 font-medium uppercase tracking-wide">WhatsApp Message Preview</p>
            <pre className="text-green-400 text-sm whitespace-pre-wrap font-mono leading-relaxed">
{`🌅 *Gnanova CRM — Daily Summary*
📅 ${today}

📊 *LEADS*
• New today: ${stats.newLeads}
• Total leads: ${stats.totalLeads}
• 🔥 Hot leads: ${stats.hotLeads}

🤖 *WHATSAPP BOT*
• Sessions today: ${stats.botSessions}
• Hot qualified: ${stats.hotFromBot}

🏢 *INVENTORY*
• Available suites: ${stats.availableSuites}

💰 *DEALS & PAYMENTS*
• Deals closed today: ${stats.dealsToday}
• Payments due today: ${stats.paymentsDue}
${stats.paymentsDue > 0 ? '\n⚠️ *Action needed: ' + stats.paymentsDue + ' payment(s) due today!*' : ''}

Have a great day! 🚀
— Gnanova AI`}
            </pre>
          </div>
        </>
      ) : null}
    </div>
  )
}

import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  MessageCircle, Flame, Thermometer, Snowflake, Clock,
  CheckCircle, XCircle, Settings, BarChart3, Phone, Users,
  RefreshCw, ChevronRight
} from 'lucide-react'

type QualificationScore = 'Hot' | 'Warm' | 'Cold'
type ConvStatus = 'In Progress' | 'Completed' | 'Dropped'

type BotConversation = {
  id: string
  phone: string
  name: string | null
  current_step: number
  budget: string | null
  interest_type: string | null
  timeline: string | null
  source: string | null
  qualification_score: QualificationScore | null
  status: ConvStatus
  completed_at: string | null
  created_at: string
}

const SCORE_STYLES: Record<QualificationScore, { bg: string; text: string; icon: React.ReactNode }> = {
  Hot: {
    bg: 'bg-red-100 border-red-200',
    text: 'text-red-700',
    icon: <Flame className="w-4 h-4 text-red-500" />,
  },
  Warm: {
    bg: 'bg-amber-100 border-amber-200',
    text: 'text-amber-700',
    icon: <Thermometer className="w-4 h-4 text-amber-500" />,
  },
  Cold: {
    bg: 'bg-blue-100 border-blue-200',
    text: 'text-blue-700',
    icon: <Snowflake className="w-4 h-4 text-blue-400" />,
  },
}

const STATUS_STYLES: Record<ConvStatus, string> = {
  'In Progress': 'bg-amber-50 text-amber-700',
  'Completed': 'bg-green-50 text-green-700',
  'Dropped': 'bg-slate-100 text-slate-500',
}

const BOT_STEPS = [
  { step: 1, label: 'Welcome', description: 'Greet and ask for name' },
  { step: 2, label: 'Interest', description: 'Suite / Membership / Both' },
  { step: 3, label: 'Budget', description: 'Up to 15L / 15–30L / 30L+' },
  { step: 4, label: 'Timeline', description: 'Now / 3 months / Exploring' },
  { step: 5, label: 'Qualify', description: 'Score: Hot / Warm / Cold' },
]

const DEFAULT_MESSAGES = {
  welcome: `Hi! Welcome to Venkateswara Suite Rooms 👋\nI'm here to help you find your perfect space.\nWhat's your name?`,
  interest: `Nice to meet you [Name]! \nWhat are you interested in?\n1️⃣ Suite Room Investment\n2️⃣ Club Membership\n3️⃣ Both`,
  budget: `Great choice! What's your investment budget?\n1️⃣ Up to ₹15 Lakhs\n2️⃣ ₹15–30 Lakhs\n3️⃣ ₹30 Lakhs+`,
  timeline: `When are you looking to invest?\n1️⃣ Immediately\n2️⃣ Within 3 months\n3️⃣ Just exploring`,
  hot_response: `Excellent! Based on your requirements, our team will call you within 60 minutes. Thank you [Name]! 🎯`,
  warm_response: `Thank you [Name]! Our team will reach out to you shortly. Meanwhile, here's our project brochure: [link]`,
  cold_response: `Thank you for your interest [Name]! We'll keep you updated on our latest offers. Feel free to reach out anytime! 😊`,
  renewal_reminder: `Hi [Name], your [Tier] membership expires on [Date].\nRenew now to continue enjoying your benefits.\nContact us: +91 9948114343`,
}

export default function BotConfiguration() {
  const [conversations, setConversations] = useState<BotConversation[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'conversations' | 'settings'>('conversations')
  const [filterScore, setFilterScore] = useState<string>('All')
  const [filterStatus, setFilterStatus] = useState<string>('All')
  const [messages, setMessages] = useState(DEFAULT_MESSAGES)
  const [saved, setSaved] = useState(false)

  useEffect(() => { loadConversations() }, [])

  async function loadConversations() {
    setLoading(true)
    const { data } = await supabase
      .from('bot_conversations')
      .select('*')
      .order('created_at', { ascending: false })
    setConversations((data || []) as BotConversation[])
    setLoading(false)
  }

  function handleSaveMessages() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function openWhatsApp(phone: string, name: string | null) {
    const msg = encodeURIComponent(`Hi ${name || 'there'}, following up from VSR team. Can we assist you further?`)
    const p = phone.replace(/\D/g, '')
    window.open(`https://wa.me/${p}?text=${msg}`, '_blank')
  }

  const filtered = conversations.filter(c => {
    const matchScore = filterScore === 'All' || c.qualification_score === filterScore
    const matchStatus = filterStatus === 'All' || c.status === filterStatus
    return matchScore && matchStatus
  })

  const total = conversations.length
  const hotCount = conversations.filter(c => c.qualification_score === 'Hot').length
  const warmCount = conversations.filter(c => c.qualification_score === 'Warm').length
  const coldCount = conversations.filter(c => c.qualification_score === 'Cold').length
  const completedCount = conversations.filter(c => c.status === 'Completed').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">WhatsApp Bot</h1>
          <p className="text-slate-500 text-sm mt-1">Lead qualification bot conversations &amp; configuration</p>
        </div>
        <button onClick={loadConversations} className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{total}</p>
          <p className="text-xs text-slate-500 mt-1">Total</p>
        </div>
        <div className="bg-red-50 rounded-xl border border-red-200 p-4 text-center">
          <p className="text-2xl font-bold text-red-600">{hotCount}</p>
          <p className="text-xs text-red-500 mt-1 flex items-center justify-center gap-1"><Flame className="w-3 h-3" /> Hot</p>
        </div>
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{warmCount}</p>
          <p className="text-xs text-amber-500 mt-1 flex items-center justify-center gap-1"><Thermometer className="w-3 h-3" /> Warm</p>
        </div>
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{coldCount}</p>
          <p className="text-xs text-blue-500 mt-1 flex items-center justify-center gap-1"><Snowflake className="w-3 h-3" /> Cold</p>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-200 p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{completedCount}</p>
          <p className="text-xs text-green-500 mt-1">Completed</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        {(['conversations', 'settings'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition-all ${activeTab === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {tab === 'settings' ? <span className="flex items-center gap-1"><Settings className="w-3.5 h-3.5" /> Bot Settings</span> : <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" /> Conversations</span>}
          </button>
        ))}
      </div>

      {activeTab === 'conversations' && (
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="p-4 border-b border-slate-100 flex flex-wrap gap-3">
            <select value={filterScore} onChange={e => setFilterScore(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm">
              <option value="All">All Scores</option>
              <option>Hot</option><option>Warm</option><option>Cold</option>
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm">
              <option value="All">All Status</option>
              <option>In Progress</option><option>Completed</option><option>Dropped</option>
            </select>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-slate-400">No conversations yet</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filtered.map(c => (
                <div key={c.id} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${c.qualification_score ? SCORE_STYLES[c.qualification_score].bg : 'bg-slate-100'}`}>
                    {c.qualification_score ? SCORE_STYLES[c.qualification_score].icon : <MessageCircle className="w-4 h-4 text-slate-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-900">{c.name || c.phone}</p>
                      {c.qualification_score && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${SCORE_STYLES[c.qualification_score].bg} ${SCORE_STYLES[c.qualification_score].text}`}>
                          {c.qualification_score}
                        </span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLES[c.status]}`}>{c.status}</span>
                    </div>
                    <div className="flex gap-3 mt-0.5 text-xs text-slate-500">
                      {c.phone && <span>{c.phone}</span>}
                      {c.interest_type && <span>• {c.interest_type}</span>}
                      {c.budget && <span>• {c.budget}</span>}
                      {c.timeline && <span>• {c.timeline}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Step {c.current_step}/5</span>
                    <button onClick={() => openWhatsApp(c.phone, c.name)} className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100">
                      <Phone className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="space-y-6">
          {/* Bot Flow Visual */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-slate-500" /> Qualification Flow
            </h3>
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {BOT_STEPS.map((s, i) => (
                <React.Fragment key={s.step}>
                  <div className="flex-shrink-0 w-32 bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                    <div className="w-6 h-6 bg-amber-600 text-white rounded-full flex items-center justify-center text-xs font-bold mx-auto mb-1">{s.step}</div>
                    <p className="text-xs font-semibold text-slate-800">{s.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{s.description}</p>
                  </div>
                  {i < BOT_STEPS.length - 1 && <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Scoring Logic */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-800 mb-3">Scoring Logic</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2"><Flame className="w-4 h-4 text-red-500" /><span className="font-semibold text-red-700">Hot Lead</span></div>
                <p className="text-xs text-red-600">Budget ₹30L+ AND Timeline: Immediately</p>
                <p className="text-xs text-red-500 mt-1 italic">→ Triggers Bolna AI call within 60 min</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2"><Thermometer className="w-4 h-4 text-amber-500" /><span className="font-semibold text-amber-700">Warm Lead</span></div>
                <p className="text-xs text-amber-600">Budget ₹15–30L OR Timeline: Within 3 months</p>
                <p className="text-xs text-amber-500 mt-1 italic">→ Team follows up shortly</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2"><Snowflake className="w-4 h-4 text-blue-400" /><span className="font-semibold text-blue-700">Cold Lead</span></div>
                <p className="text-xs text-blue-600">Budget under ₹15L OR Just exploring</p>
                <p className="text-xs text-blue-500 mt-1 italic">→ Added to nurture list</p>
              </div>
            </div>
          </div>

          {/* Message Editor */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-800 mb-4">Bot Messages</h3>
            <div className="space-y-4">
              {(Object.entries(messages) as [keyof typeof DEFAULT_MESSAGES, string][]).map(([key, val]) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-slate-700 mb-1 capitalize">{key.replace(/_/g, ' ')}</label>
                  <textarea
                    value={val}
                    onChange={e => setMessages(m => ({ ...m, [key]: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono resize-none"
                  />
                </div>
              ))}
            </div>
            <button onClick={handleSaveMessages} className={`mt-4 px-6 py-2 rounded-lg text-sm font-semibold transition-all ${saved ? 'bg-green-600 text-white' : 'bg-amber-600 text-white hover:bg-amber-700'}`}>
              {saved ? '✓ Saved' : 'Save Messages'}
            </button>
            <p className="text-xs text-slate-400 mt-2">Note: Changes here save locally. To apply to the live webhook, update the Edge Function environment variable BOT_MESSAGES.</p>
          </div>
        </div>
      )}
    </div>
  )
}

import React, { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase, type Call } from '../../lib/supabase'
import { Phone, Users, Calendar, Clock, TrendingUp, TrendingDown, Play } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import OverdueFollowUpsWidget from '../../components/crm/OverdueFollowUpsWidget'

type DashboardStats = {
  calls_today: number
  hot_leads: number
  appointments_booked: number
  avg_lead_score: number
}

export default function DashboardHome() {
  const { agent, loading: authLoading } = useAuth()
  const [stats, setStats] = useState<DashboardStats>({
    calls_today: 0,
    hot_leads: 0,
    appointments_booked: 0,
    avg_lead_score: 0,
  })
  const [recentCalls, setRecentCalls] = useState<Call[]>([])
  const [loading, setLoading] = useState(true)
  const [testCallLoading, setTestCallLoading] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!agent) {
      setLoading(false)
      return
    }
    fetchDashboardData()
  }, [agent, authLoading])

  async function fetchDashboardData() {
    try {
      // Fetch stats
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const { data: calls, error } = await supabase
        .from('calls')
        .select('*')
        .eq('agent_id', agent!.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Calculate stats
      const callsToday = calls?.filter(
        (call) => new Date(call.created_at) >= today
      ).length || 0

      const hotLeads = calls?.filter((call) => call.lead_status === 'hot').length || 0
      const appointments = calls?.filter((call) => call.appointment_booked).length || 0
      
      const scores = calls?.filter((call) => call.ai_score !== null).map((call) => call.ai_score!) || []
      const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0

      setStats({
        calls_today: callsToday,
        hot_leads: hotLeads,
        appointments_booked: appointments,
        avg_lead_score: avgScore,
      })

      // Set recent calls (last 10)
      setRecentCalls(calls?.slice(0, 10) || [])
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleTestCall() {
    const phoneNumber = prompt('Enter your phone number (with country code, e.g. +1234567890):')
    
    if (!phoneNumber) return
    
    // Validate phone number format
    if (!/^\+\d{10,15}$/.test(phoneNumber)) {
      alert('Invalid phone number format. Please use format: +1234567890')
      return
    }
    
    setTestCallLoading(true)
    
    try {
      const { initiateCall } = await import('../../api/initiate-call')
      await initiateCall(phoneNumber, 'Test Lead', agent!.id, 'test')
      
      alert('Test call initiated! You should receive a call in a few seconds. Answer to hear your AI assistant!')
    } catch (error) {
      console.error('Error initiating test call:', error)
      alert('Error initiating call. Check console for details.')
    } finally {
      setTestCallLoading(false)
    }
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-600">Loading...</div>
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-950 max-w-lg">
        <h2 className="font-semibold text-lg">No agent profile</h2>
        <p className="mt-2 text-sm text-amber-900/90">
          Add an <code className="rounded bg-amber-100/80 px-1">agents</code> row with id equal to your Supabase user id, or sign up through the app.
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-600">Loading dashboard...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Welcome back, {agent?.full_name?.split(' ')[0] || 'Agent'}! 👋
        </h1>
        <p className="text-slate-600 mt-1">Here's what's happening with your leads today.</p>
      </div>

      {/* Test Call Button */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-blue-900 mb-1">
              Test Your AI Voice Agent
            </h3>
            <p className="text-blue-700 text-sm">
              Make a test call to your own phone to hear how your AI assistant sounds
            </p>
          </div>
          <button
            onClick={handleTestCall}
            disabled={testCallLoading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Phone className="w-5 h-5" />
            {testCallLoading ? 'Calling...' : 'Test Call'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Calls Today */}
        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Phone className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-green-600 text-sm font-medium flex items-center">
              <TrendingUp className="w-4 h-4 mr-1" />
              +12%
            </span>
          </div>
          <div>
            <p className="text-3xl font-bold text-slate-900">{stats.calls_today}</p>
            <p className="text-slate-600 text-sm mt-1">Calls Today</p>
          </div>
        </div>

        {/* Hot Leads */}
        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-orange-600" />
            </div>
            <span className="text-orange-600 text-sm font-medium">
              🔥 Hot
            </span>
          </div>
          <div>
            <p className="text-3xl font-bold text-slate-900">{stats.hot_leads}</p>
            <p className="text-slate-600 text-sm mt-1">Hot Leads</p>
            {stats.hot_leads > 0 && (
              <p className="text-orange-600 text-xs mt-2">{stats.hot_leads} need attention</p>
            )}
          </div>
        </div>

        {/* Appointments */}
        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-6 h-6 text-green-600" />
            </div>
            <span className="text-green-600 text-sm font-medium flex items-center">
              <TrendingUp className="w-4 h-4 mr-1" />
              +24%
            </span>
          </div>
          <div>
            <p className="text-3xl font-bold text-slate-900">{stats.appointments_booked}</p>
            <p className="text-slate-600 text-sm mt-1">Appointments Booked</p>
          </div>
        </div>

        {/* Avg Lead Score */}
        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <div>
            <p className="text-3xl font-bold text-slate-900">{stats.avg_lead_score}%</p>
            <p className="text-slate-600 text-sm mt-1">Avg Lead Score</p>
            <p className="text-slate-500 text-xs mt-2">Response time: 3 mins</p>
          </div>
        </div>
      </div>

      <OverdueFollowUpsWidget />

      {/* Recent Calls */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Recent Calls</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Lead Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Phone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Score
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Recording
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {recentCalls.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    No calls yet. Your AI assistant will start calling leads soon!
                  </td>
                </tr>
              ) : (
                recentCalls.map((call) => (
                  <tr key={call.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {formatDistanceToNow(new Date(call.created_at), { addSuffix: true })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-sm font-medium text-slate-900">
                        {call.lead_name || 'Unknown'}
                      </p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {call.lead_phone}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          call.lead_status === 'hot'
                            ? 'bg-orange-100 text-orange-800'
                            : call.lead_status === 'warm'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {call.lead_status || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-16 bg-slate-200 rounded-full h-2 mr-2">
                          <div
                            className={`h-2 rounded-full ${
                              (call.ai_score || 0) >= 80
                                ? 'bg-green-500'
                                : (call.ai_score || 0) >= 60
                                ? 'bg-yellow-500'
                                : 'bg-slate-400'
                            }`}
                            style={{ width: `${call.ai_score || 0}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium text-slate-700">
                          {call.ai_score || 0}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {call.recording_url ? (
                        <button className="text-blue-600 hover:text-blue-700">
                          <Play className="w-5 h-5" />
                        </button>
                      ) : (
                        <span className="text-slate-400 text-sm">N/A</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}


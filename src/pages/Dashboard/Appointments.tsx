import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase, type BookingRow, type Call } from '../../lib/supabase'
import { fetchCalComSlotsFromServer, generateDefaultSlotsForDate } from '../../lib/calcom-slots'
import {
  Calendar,
  List,
  Plus,
  MapPin,
  User,
  Clock,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  BellRing,
} from 'lucide-react'
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  parseISO,
  startOfWeek,
  endOfWeek,
} from 'date-fns'

type LeadRow = {
  id: string
  name: string | null
  phone: string | null
  email?: string | null
}

type PropertyRow = {
  id: string
  address: string | null
  city: string | null
  state: string | null
}

type AgentMini = { id: string; full_name: string | null }

type CalIntegration = {
  enabled: boolean
  apiKey: string
  username: string
  eventTypeId: string
}

function bookingDateTime(b: BookingRow): Date {
  const d = b.scheduled_date
  let t = (b.scheduled_time || '12:00').toString()
  if (t.length === 5) t = `${t}:00`
  return new Date(`${d}T${t}`)
}

function formatAddress(b: BookingRow): string {
  const p = b.properties
  if (!p) return 'Property'
  return [p.address, p.city, p.state].filter(Boolean).join(', ') || 'Property'
}

function leadName(b: BookingRow): string {
  return b.leads?.name || b.lead_display_name || 'Unknown lead'
}

function leadPhone(b: BookingRow): string {
  return b.leads?.phone || b.lead_display_phone || '—'
}

const STATUS_OPTIONS = ['pending', 'confirmed', 'no_show', 'recovery_sent', 'completed'] as const

function statusBadge(status: string): string {
  switch (status) {
    case 'confirmed':
      return 'bg-emerald-100 text-emerald-800'
    case 'pending':
      return 'bg-amber-100 text-amber-800'
    case 'no_show':
      return 'bg-red-100 text-red-800'
    case 'recovery_sent':
      return 'bg-sky-100 text-sky-800'
    case 'completed':
      return 'bg-slate-100 text-slate-700'
    default:
      return 'bg-slate-100 text-slate-600'
  }
}

export default function AppointmentsPage() {
  const { agent } = useAuth()
  const [view, setView] = useState<'month' | 'list'>('month')
  const [monthCursor, setMonthCursor] = useState(() => new Date())
  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterPropertyId, setFilterPropertyId] = useState<string>('all')
  const [filterAgentId, setFilterAgentId] = useState<string>('all')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')

  const [properties, setProperties] = useState<PropertyRow[]>([])
  const [dashboardAgents, setDashboardAgents] = useState<AgentMini[]>([])
  const [leads, setLeads] = useState<LeadRow[]>([])
  const [calls, setCalls] = useState<Call[]>([])
  const [cal, setCal] = useState<CalIntegration>({
    enabled: false,
    apiKey: '',
    username: '',
    eventTypeId: '',
  })

  const [modalOpen, setModalOpen] = useState(false)
  const [schedulePropertyId, setSchedulePropertyId] = useState('')
  const [scheduleLeadKey, setScheduleLeadKey] = useState('')
  const [scheduleAgentId, setScheduleAgentId] = useState('')
  const [leadSearchQuery, setLeadSearchQuery] = useState('')
  const [scheduleDate, setScheduleDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [scheduleEventType, setScheduleEventType] = useState<'showing' | 'open_house'>('showing')
  const [scheduleNotes, setScheduleNotes] = useState('')
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; time: string } | null>(null)
  const [slots, setSlots] = useState<{ date: string; time: string }[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slotsHint, setSlotsHint] = useState<string | null>(null)
  const [savingBooking, setSavingBooking] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const loadCalIntegration = useCallback(async () => {
    if (!agent) return
    const { data: own } = await supabase
      .from('integration_settings')
      .select('*')
      .eq('integration_type', 'cal_com')
      .eq('agent_id', agent.id)
      .maybeSingle()
    let data = own
    if (!data) {
      const { data: globalRow } = await supabase
        .from('integration_settings')
        .select('*')
        .eq('integration_type', 'cal_com')
        .is('agent_id', null)
        .maybeSingle()
      data = globalRow
    }
    if (data) {
      setCal({
        enabled: Boolean(data.is_enabled),
        apiKey: data.api_key || '',
        username: (data.config as Record<string, string>)?.username || '',
        eventTypeId: (data.config as Record<string, string>)?.event_type_id || '',
      })
    }
  }, [agent])

  const loadSupporting = useCallback(async () => {
    if (!agent) return
    const [propRes, leadsRes, callsRes, agentsRes] = await Promise.all([
      supabase
        .from('properties')
        .select('id, address, city, state')
        .eq('agent_id', agent.id)
        .order('address'),
      supabase.from('leads').select('id, name, phone, email').eq('agent_id', agent.id).order('name'),
      supabase
        .from('calls')
        .select('id, lead_name, lead_phone, created_at')
        .eq('agent_id', agent.id)
        .order('created_at', { ascending: false })
        .limit(80),
      supabase.from('agents_directory').select('id, full_name').order('full_name').limit(200),
    ])
    if (!propRes.error && propRes.data) setProperties(propRes.data as PropertyRow[])
    if (!leadsRes.error && leadsRes.data) setLeads(leadsRes.data as LeadRow[])
    if (!callsRes.error && callsRes.data) setCalls(callsRes.data as Call[])
    if (!agentsRes.error && agentsRes.data?.length) {
      setDashboardAgents(agentsRes.data as AgentMini[])
    } else {
      setDashboardAgents([{ id: agent.id, full_name: agent.full_name }])
    }
  }, [agent])

  const fetchBookings = useCallback(async () => {
    if (!agent) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: qErr } = await supabase
        .from('bookings')
        .select(
          `
          *,
          properties ( id, address, city, state, zip_code, agent_id ),
          leads ( id, name, phone, email ),
          agents ( id, full_name )
        `
        )
        .order('scheduled_date', { ascending: true })
        .order('scheduled_time', { ascending: true })

      if (qErr) throw qErr
      setBookings((data as BookingRow[]) || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load appointments')
      setBookings([])
    } finally {
      setLoading(false)
    }
  }, [agent])

  useEffect(() => {
    loadCalIntegration()
    loadSupporting()
    fetchBookings()
  }, [agent, loadCalIntegration, loadSupporting, fetchBookings])

  const refreshSlotsForDate = useCallback(
    async (dateStr: string) => {
      setSelectedSlot(null)
      setSlotsLoading(true)
      setSlotsHint(null)
      setActionError(null)
      try {
        if (
          cal.enabled &&
          cal.apiKey &&
          cal.username &&
          cal.eventTypeId
        ) {
          const result = await fetchCalComSlotsFromServer({
            apiKey: cal.apiKey,
            username: cal.username,
            eventTypeId: cal.eventTypeId,
            startDate: dateStr,
            endDate: dateStr,
          })
          if (result.ok && result.slots && result.slots.length > 0) {
            setSlots(result.slots)
            setSlotsHint('Loaded from Cal.com')
            return
          }
          if (!result.ok) {
            setSlotsHint(`Cal.com unavailable (${result.error}). Using default business hours.`)
          }
        } else {
          setSlotsHint('Add Cal.com in Integrations for live availability, or use default slots below.')
        }
        setSlots(generateDefaultSlotsForDate(dateStr))
      } finally {
        setSlotsLoading(false)
      }
    },
    [cal]
  )

  useEffect(() => {
    if (modalOpen && scheduleDate) {
      refreshSlotsForDate(scheduleDate)
    }
  }, [modalOpen, scheduleDate, refreshSlotsForDate])

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (filterStatus !== 'all' && b.status !== filterStatus) return false
      if (filterPropertyId !== 'all' && b.property_id !== filterPropertyId) return false
      if (filterAgentId !== 'all' && b.agent_id !== filterAgentId) return false
      const t = bookingDateTime(b)
      if (filterDateFrom && t < parseISO(`${filterDateFrom}T00:00:00`)) return false
      if (filterDateTo && t > parseISO(`${filterDateTo}T23:59:59`)) return false
      return true
    })
  }, [bookings, filterStatus, filterPropertyId, filterAgentId, filterDateFrom, filterDateTo])

  const appointmentCounts = useMemo(() => {
    const todayKey = format(new Date(), 'yyyy-MM-dd')
    const ws = startOfWeek(new Date(), { weekStartsOn: 1 })
    const we = endOfWeek(new Date(), { weekStartsOn: 1 })
    let today = 0
    let week = 0
    let noShows = 0
    bookings.forEach((b) => {
      if (b.status === 'no_show') noShows += 1
      const t = bookingDateTime(b)
      if (b.scheduled_date === todayKey) today += 1
      if (t >= ws && t <= we) week += 1
    })
    return { today, week, noShows }
  }, [bookings])

  const sortedList = useMemo(() => {
    return [...filteredBookings].sort(
      (a, b) => bookingDateTime(a).getTime() - bookingDateTime(b).getTime()
    )
  }, [filteredBookings])

  const monthDays = useMemo(() => {
    const start = startOfMonth(monthCursor)
    const end = endOfMonth(monthCursor)
    return eachDayOfInterval({ start, end })
  }, [monthCursor])

  const bookingsByDay = useMemo(() => {
    const m = new Map<string, number>()
    filteredBookings.forEach((b) => {
      const key = b.scheduled_date
      m.set(key, (m.get(key) || 0) + 1)
    })
    return m
  }, [filteredBookings])

  const clearFilters = () => {
    setFilterStatus('all')
    setFilterPropertyId('all')
    setFilterAgentId('all')
    setFilterDateFrom('')
    setFilterDateTo('')
  }

  const openScheduleModal = () => {
    setModalOpen(true)
    setSchedulePropertyId(properties[0]?.id || '')
    setScheduleLeadKey('')
    setScheduleAgentId(agent?.id || '')
    setLeadSearchQuery('')
    setScheduleNotes('')
    setScheduleEventType('showing')
    setScheduleDate(format(new Date(), 'yyyy-MM-dd'))
    setActionError(null)
  }

  const patchBooking = async (id: string, patch: Record<string, unknown>) => {
    if (!agent) return
    const { error: uErr } = await supabase
      .from('bookings')
      .update({ ...patch, agent_id: agent.id, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (uErr) throw uErr
    await fetchBookings()
  }

  const handleStatusChange = async (id: string, status: string) => {
    setActionError(null)
    try {
      await patchBooking(id, { status })
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Update failed')
    }
  }

  const handleMarkNoShow = async (b: BookingRow) => {
    setActionError(null)
    try {
      await patchBooking(b.id, { status: 'no_show' })
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Update failed')
    }
  }

  const handleNoShowRecover = async (b: BookingRow) => {
    if (!agent) return
    const phone = leadPhone(b)
    const name = leadName(b)
    if (!phone || phone === '—') {
      setActionError('No phone number on file for this appointment.')
      return
    }
    setActionError(null)
    try {
      const { initiateCall } = await import('../../api/initiate-call')
      const firstMessage = `Hi ${name}, we noticed you missed your property viewing today. Would you like to reschedule? We have slots available this week.`
      const systemPrompt = `You are Sarah from the listing agent's team. The prospect missed a scheduled showing. Be brief and kind. Confirm if they want to reschedule; if yes, offer this week. Keep under 2 minutes.`
      await initiateCall(phone, name, agent.id, 'no_show_recovery', {
        firstMessage,
        systemPrompt,
      })
      await patchBooking(b.id, { status: 'recovery_sent' })
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Recovery call failed')
    }
  }

  const handleCreateBooking = async () => {
    if (!agent || !schedulePropertyId || !scheduleLeadKey || !selectedSlot) {
      setActionError('Choose a property, lead, and time slot.')
      return
    }
    setSavingBooking(true)
    setActionError(null)
    try {
      let lead_id: string | null = null
      let call_id: string | null = null
      let lead_display_name: string | null = null
      let lead_display_phone: string | null = null

      if (scheduleLeadKey.startsWith('lead:')) {
        lead_id = scheduleLeadKey.slice(5)
        const L = leads.find((l) => l.id === lead_id)
        lead_display_name = L?.name || null
        lead_display_phone = L?.phone || null
      } else if (scheduleLeadKey.startsWith('call:')) {
        call_id = scheduleLeadKey.slice(5)
        const C = calls.find((c) => c.id === call_id)
        lead_display_name = C?.lead_name || null
        lead_display_phone = C?.lead_phone || null
      }

      const timeStr =
        selectedSlot.time.length === 5 ? `${selectedSlot.time}:00` : selectedSlot.time

      const assignAgentId = scheduleAgentId || agent.id

      const { error: iErr } = await supabase.from('bookings').insert({
        property_id: schedulePropertyId,
        lead_id,
        call_id,
        lead_display_name,
        lead_display_phone,
        agent_id: assignAgentId,
        scheduled_date: selectedSlot.date,
        scheduled_time: timeStr,
        status: 'pending',
        event_type: scheduleEventType,
        notes: scheduleNotes.trim() || null,
      })

      if (iErr) throw iErr
      setModalOpen(false)
      await fetchBookings()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not create appointment')
    } finally {
      setSavingBooking(false)
    }
  }

  const startWeekday = (() => {
    const s = startOfMonth(monthCursor).getDay()
    return s === 0 ? 6 : s - 1
  })()

  if (!agent) {
    return <div className="flex items-center justify-center h-64 text-slate-600">Sign in required.</div>
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-600">
        <div className="h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        Loading appointments…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Appointments</h1>
          <p className="text-slate-600 mt-1">Showings, tours, and open houses</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setView('month')}
              className={`px-3 py-2 text-sm font-medium flex items-center gap-1 ${
                view === 'month' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Calendar className="w-4 h-4" />
              Month
            </button>
            <button
              type="button"
              onClick={() => setView('list')}
              className={`px-3 py-2 text-sm font-medium flex items-center gap-1 border-l border-slate-200 ${
                view === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <List className="w-4 h-4" />
              List
            </button>
          </div>
          <button
            type="button"
            onClick={openScheduleModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Schedule showing
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800 text-sm">{error}</div>
      )}
      {actionError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 text-sm">
          {actionError}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex-1 min-w-[140px]">
          <p className="text-xs text-slate-500 font-medium uppercase">Today</p>
          <p className="text-2xl font-bold text-slate-900">{appointmentCounts.today}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex-1 min-w-[140px]">
          <p className="text-xs text-slate-500 font-medium uppercase">This week</p>
          <p className="text-2xl font-bold text-slate-900">{appointmentCounts.week}</p>
        </div>
        <div className="rounded-xl border border-red-200 px-4 py-3 flex-1 min-w-[140px] bg-red-50/60">
          <p className="text-xs text-red-700 font-medium uppercase">No-shows</p>
          <p className="text-2xl font-bold text-red-800">{appointmentCounts.noShows}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="font-medium text-slate-800">Filters</span>
          <button type="button" onClick={clearFilters} className="ml-auto text-sm text-blue-600 font-medium">
            Clear
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Agent</label>
            <select
              value={filterAgentId}
              onChange={(e) => setFilterAgentId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm"
            >
              <option value="all">All agents</option>
              {dashboardAgents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.full_name || a.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm"
            >
              <option value="all">All</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Property</label>
            <select
              value={filterPropertyId}
              onChange={(e) => setFilterPropertyId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm"
            >
              <option value="all">All properties</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {[p.address, p.city].filter(Boolean).join(', ') || p.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">From</label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">To</label>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
        </div>
      </div>

      {view === 'month' ? (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={() => setMonthCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
              className="p-2 rounded-lg hover:bg-slate-100"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-semibold text-slate-900">{format(monthCursor, 'MMMM yyyy')}</h2>
            <button
              type="button"
              onClick={() => setMonthCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
              className="p-2 rounded-lg hover:bg-slate-100"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-500 mb-2">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: startWeekday }).map((_, i) => (
              <div key={`pad-${i}`} className="h-20" />
            ))}
            {monthDays.map((day) => {
              const key = format(day, 'yyyy-MM-dd')
              const count = bookingsByDay.get(key) || 0
              const inMonth = isSameMonth(day, monthCursor)
              return (
                <div
                  key={key}
                  className={`h-20 rounded-lg border p-1 text-left text-sm ${
                    inMonth ? 'border-slate-200 bg-slate-50/50' : 'border-transparent'
                  }`}
                >
                  <span className="text-slate-700 font-medium">{format(day, 'd')}</span>
                  {count > 0 && (
                    <div className="mt-1 flex flex-wrap gap-0.5">
                      {Array.from({ length: Math.min(count, 3) }).map((_, j) => (
                        <span key={j} className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                      ))}
                      {count > 3 && <span className="text-[10px] text-slate-500">+{count - 3}</span>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <p className="text-xs text-slate-500 mt-3">
            Dots indicate scheduled appointments (after filters). Switch to List for details.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedList.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 py-16 text-center text-slate-500">
              No appointments match filters. Schedule a showing or adjust filters.
            </div>
          ) : (
            sortedList.map((b) => (
              <div
                key={b.id}
                className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col lg:flex-row lg:items-start gap-4"
              >
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusBadge(b.status)}`}>
                      {b.status.replace('_', ' ')}
                    </span>
                    {b.event_type === 'open_house' && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                        Open house
                      </span>
                    )}
                    {b.no_show_follow_up_at && (
                      <span className="text-xs text-slate-500">Follow-up logged</span>
                    )}
                  </div>
                  <div className="flex items-start gap-2 text-slate-900">
                    <Clock className="w-4 h-4 mt-0.5 text-slate-400" />
                    <div>
                      <p className="font-semibold">{format(bookingDateTime(b), 'EEE, MMM d · h:mm a')}</p>
                      <p className="text-sm text-slate-600 flex items-center gap-1 mt-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {formatAddress(b)}
                      </p>
                      <p className="text-sm text-slate-600 flex items-center gap-1 mt-1">
                        <User className="w-3.5 h-3.5" />
                        {leadName(b)} · {leadPhone(b)}
                      </p>
                      <p className="text-sm text-slate-500 mt-1">
                        Agent: {b.agents?.full_name || agent.full_name}
                      </p>
                    </div>
                  </div>
                  {b.notes && <p className="text-sm text-slate-600 italic">{b.notes}</p>}
                </div>
                <div className="flex flex-col gap-2 min-w-[200px]">
                  <label className="text-xs text-slate-500">Status</label>
                  <select
                    value={b.status}
                    onChange={(e) => handleStatusChange(b.id, e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                  {b.status !== 'no_show' && (
                    <button
                      type="button"
                      onClick={() => handleMarkNoShow(b)}
                      className="text-sm text-red-600 hover:text-red-800 font-medium text-left"
                    >
                      Mark no-show
                    </button>
                  )}
                  {b.status === 'no_show' && (
                    <button
                      type="button"
                      onClick={() => handleNoShowRecover(b)}
                      className="inline-flex items-center gap-2 px-3 py-2 bg-slate-900 text-white rounded-lg text-sm hover:bg-slate-800"
                    >
                      <BellRing className="w-4 h-4" />
                      Recover (AI call)
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Schedule modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-lg font-bold text-slate-900">Schedule showing</h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
                aria-label="Close"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {properties.length === 0 && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  Add properties under Properties first — bookings must link to your listings.
                </p>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Property</label>
                <select
                  value={schedulePropertyId}
                  onChange={(e) => setSchedulePropertyId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  <option value="">Select property</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {[p.address, p.city].filter(Boolean).join(', ')}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Search leads</label>
                <input
                  type="search"
                  value={leadSearchQuery}
                  onChange={(e) => setLeadSearchQuery(e.target.value)}
                  placeholder="Type name or phone…"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mb-2"
                />
                <label className="block text-xs font-medium text-slate-500 mb-1">Lead (CRM or call log)</label>
                <select
                  value={scheduleLeadKey}
                  onChange={(e) => setScheduleLeadKey(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white max-h-40"
                >
                  <option value="">Select lead</option>
                  <optgroup label="Leads">
                    {leads
                      .filter((l) => {
                        const q = leadSearchQuery.trim().toLowerCase()
                        if (!q) return true
                        return (
                          (l.name || '').toLowerCase().includes(q) || (l.phone || '').toLowerCase().includes(q)
                        )
                      })
                      .map((l) => (
                        <option key={l.id} value={`lead:${l.id}`}>
                          {l.name || 'Unnamed'} · {l.phone || 'no phone'}
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Recent calls">
                    {calls
                      .filter((c) => {
                        const q = leadSearchQuery.trim().toLowerCase()
                        if (!q) return true
                        return (
                          (c.lead_name || '').toLowerCase().includes(q) ||
                          (c.lead_phone || '').toLowerCase().includes(q)
                        )
                      })
                      .map((c) => (
                        <option key={c.id} value={`call:${c.id}`}>
                          {c.lead_name || 'Unknown'} · {c.lead_phone}
                        </option>
                      ))}
                  </optgroup>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Assigned agent</label>
                <select
                  value={scheduleAgentId || agent.id}
                  onChange={(e) => setScheduleAgentId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  {dashboardAgents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.full_name || a.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Event type</label>
                <select
                  value={scheduleEventType}
                  onChange={(e) => setScheduleEventType(e.target.value as 'showing' | 'open_house')}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  <option value="showing">Showing / tour</option>
                  <option value="open_house">Open house</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Date</label>
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
                {slotsHint && <p className="text-xs text-slate-500 mt-1">{slotsHint}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Time slot</label>
                {slotsLoading ? (
                  <p className="text-sm text-slate-500 py-4 text-center">Loading slots…</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {slots.length === 0 ? (
                      <p className="text-sm text-slate-500">No slots for this day (weekend or blocked).</p>
                    ) : (
                      slots.map((s) => {
                        const active =
                          selectedSlot?.date === s.date && selectedSlot?.time === s.time
                        return (
                          <button
                            key={`${s.date}-${s.time}`}
                            type="button"
                            onClick={() => setSelectedSlot(s)}
                            className={`px-3 py-2 rounded-lg text-sm font-medium border ${
                              active
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'
                            }`}
                          >
                            {s.time}
                          </button>
                        )
                      })
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
                <textarea
                  value={scheduleNotes}
                  onChange={(e) => setScheduleNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  placeholder="Gate code, parking, special instructions…"
                />
              </div>
              {actionError && <p className="text-sm text-red-600">{actionError}</p>}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 py-2 px-4 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateBooking}
                  disabled={savingBooking || !properties.length}
                  className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingBooking ? 'Saving…' : 'Create appointment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

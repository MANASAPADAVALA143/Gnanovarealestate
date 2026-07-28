import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import {
  Plus,
  Filter,
  X,
  Home,
  Users,
  Loader2,
  Phone,
  Calendar,
  ChevronRight,
  Radio,
  Link2,
  Copy,
  Check,
} from 'lucide-react'
import { format, parseISO, addHours } from 'date-fns'
import { ConsentCheckbox, useConsentGate } from '../../components/ConsentCheckbox'

type OhEvent = {
  id: string
  property_id: string | null
  agent_id: string | null
  address: string
  scheduled_at: string
  ends_at: string
  status: string
  created_at: string
  properties?: { address: string | null; city: string | null } | null
}

type Attendee = {
  id: string
  name: string
  phone: string
  email: string | null
  checked_in_at: string
  follow_up_status: string
  lead_id: string | null
}

type PropertyRow = { id: string; address: string | null; city: string | null }

function displayEventStatus(e: OhEvent): string {
  if (e.status === 'cancelled' || e.status === 'completed') return e.status
  const now = Date.now()
  const s = new Date(e.scheduled_at).getTime()
  const en = new Date(e.ends_at).getTime()
  if (now >= s && now < en) return 'active'
  return e.status
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'upcoming':
      return 'bg-blue-100 text-blue-800'
    case 'active':
      return 'bg-emerald-100 text-emerald-800'
    case 'completed':
      return 'bg-slate-100 text-slate-700'
    case 'cancelled':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-slate-100 text-slate-600'
  }
}

function followBadgeClass(s: string): string {
  switch (s) {
    case 'pending':
      return 'bg-amber-100 text-amber-800'
    case 'call_triggered':
      return 'bg-emerald-100 text-emerald-800'
    case 'call_failed':
      return 'bg-red-100 text-red-800'
    case 'opted_out':
      return 'bg-slate-100 text-slate-600'
    default:
      return 'bg-slate-100 text-slate-600'
  }
}

export default function OpenHousePage() {
  const { agent } = useAuth()
  const [events, setEvents] = useState<OhEvent[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [properties, setProperties] = useState<PropertyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    address: '',
    property_id: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    start_time: '10:00',
    end_time: '12:00',
  })
  const [propSearch, setPropSearch] = useState('')

  const [drawerEvent, setDrawerEvent] = useState<OhEvent | null>(null)
  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [attLoading, setAttLoading] = useState(false)
  const [checkIn, setCheckIn] = useState({ name: '', phone: '', email: '' })
  const [checkInErr, setCheckInErr] = useState<string | null>(null)
  const [triggerBusy, setTriggerBusy] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  const {
    consentGiven: checkInConsent,
    setConsentGiven: setCheckInConsent,
    showConsentError: showCheckInConsentError,
    checkConsent: checkCheckInConsent,
    logConsent: logCheckInConsent,
  } = useConsentGate(supabase)

  const loadAll = useCallback(async () => {
    if (!agent) return
    setLoading(true)
    setError(null)
    try {
      const [evRes, propRes] = await Promise.all([
        supabase
          .from('open_house_events')
          .select('*, properties ( address, city )')
          .order('scheduled_at', { ascending: false }),
        supabase.from('properties').select('id, address, city').eq('agent_id', agent.id).order('address'),
      ])
      if (evRes.error) throw evRes.error
      if (propRes.error) throw propRes.error
      const evs = (evRes.data as OhEvent[]) || []
      setEvents(evs)
      setProperties((propRes.data as PropertyRow[]) || [])

      if (evs.length) {
        const ids = evs.map((e) => e.id)
        const { data: rows } = await supabase.from('open_house_attendees').select('open_house_id').in('open_house_id', ids)
        const map: Record<string, number> = {}
        ;(rows as { open_house_id: string }[] | null)?.forEach((r) => {
          map[r.open_house_id] = (map[r.open_house_id] || 0) + 1
        })
        setCounts(map)
      } else {
        setCounts({})
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [agent])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const loadAttendees = async (eventId: string) => {
    setAttLoading(true)
    try {
      const { data, error: qErr } = await supabase
        .from('open_house_attendees')
        .select('*')
        .eq('open_house_id', eventId)
        .order('checked_in_at', { ascending: false })
      if (qErr) throw qErr
      setAttendees((data as Attendee[]) || [])
    } catch {
      setAttendees([])
    } finally {
      setAttLoading(false)
    }
  }

  useEffect(() => {
    if (drawerEvent) loadAttendees(drawerEvent.id)
  }, [drawerEvent?.id])

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (filterStatus !== 'all' && displayEventStatus(e) !== filterStatus) return false
      const t = new Date(e.scheduled_at)
      if (filterFrom && t < new Date(`${filterFrom}T00:00:00`)) return false
      if (filterTo && t > new Date(`${filterTo}T23:59:59`)) return false
      return true
    })
  }, [events, filterStatus, filterFrom, filterTo])

  const filteredProperties = useMemo(() => {
    const q = propSearch.trim().toLowerCase()
    if (!q) return properties
    return properties.filter(
      (p) =>
        (p.address || '').toLowerCase().includes(q) ||
        (p.city || '').toLowerCase().includes(q)
    )
  }, [properties, propSearch])

  const openCreate = () => {
    if (!agent) return
    setForm({
      address: '',
      property_id: properties[0]?.id || '',
      date: format(new Date(), 'yyyy-MM-dd'),
      start_time: '10:00',
      end_time: '12:00',
    })
    setPropSearch('')
    setCreateOpen(true)
    setError(null)
  }

  const syncEndFromStart = (start: string) => {
    try {
      const [h, m] = start.split(':').map(Number)
      const base = new Date()
      base.setHours(h, m, 0, 0)
      const end = addHours(base, 2)
      setForm((f) => ({ ...f, end_time: format(end, 'HH:mm') }))
    } catch {
      /* ignore */
    }
  }

  const saveEvent = async () => {
    if (!agent) return
    if (!form.address.trim()) {
      setError('Address is required')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const scheduled_at = new Date(`${form.date}T${form.start_time}:00`).toISOString()
      const ends_at = new Date(`${form.date}T${form.end_time}:00`).toISOString()
      const { error: iErr } = await supabase.from('open_house_events').insert({
        property_id: form.property_id || null,
        agent_id: agent.id,
        address: form.address.trim(),
        scheduled_at,
        ends_at,
        status: 'upcoming',
      } as never)
      if (iErr) throw iErr
      setCreateOpen(false)
      await loadAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const submitCheckIn = async () => {
    if (!drawerEvent) return
    if (!checkIn.name.trim() || !checkIn.phone.trim()) {
      setCheckInErr('Name and phone are required')
      return
    }
    if (!checkCheckInConsent()) {
      setCheckInErr(null)
      return
    }
    setCheckInErr(null)
    const { data: inserted, error: cErr } = await supabase
      .from('open_house_attendees')
      .insert({
        open_house_id: drawerEvent.id,
        name: checkIn.name.trim(),
        phone: checkIn.phone.trim(),
        email: checkIn.email.trim() || null,
      } as never)
      .select('id')
      .single()
    if (cErr) {
      setCheckInErr(cErr.message.includes('duplicate') ? 'This phone is already checked in for this event.' : cErr.message)
      return
    }
    await logCheckInConsent({
      lead_id: inserted?.id,
      phone: checkIn.phone.trim(),
      email: checkIn.email.trim() || undefined,
      context: 'openhouse',
    })
    setCheckIn({ name: '', phone: '', email: '' })
    setCheckInConsent(false)
    await loadAttendees(drawerEvent.id)
    await loadAll()
  }

  const publicCheckInUrl = drawerEvent
    ? `${window.location.origin}/open-house/${drawerEvent.id}/check-in`
    : ''

  const copyCheckInLink = async () => {
    if (!publicCheckInUrl) return
    try {
      await navigator.clipboard.writeText(publicCheckInUrl)
      setLinkCopied(true)
      window.setTimeout(() => setLinkCopied(false), 2000)
    } catch {
      setCheckInErr('Could not copy link — copy it manually from the field below.')
    }
  }

  const triggerFollowups = async (eventId: string) => {
    setTriggerBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/open-house/trigger-followups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ open_house_id: eventId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
      await loadAttendees(eventId)
      await loadAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Trigger failed')
    } finally {
      setTriggerBusy(false)
    }
  }

  if (!agent) {
    return <div className="flex items-center justify-center h-64 text-slate-600">Sign in required.</div>
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2 text-slate-600">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        Loading open houses…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Open House</h1>
          <p className="text-slate-600 mt-1">Schedule events, check in visitors, and trigger AI follow-up calls</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          New Open House
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800 text-sm">{error}</div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="font-medium text-slate-800">Filters</span>
          <button
            type="button"
            className="ml-auto text-sm text-blue-600 font-medium"
            onClick={() => {
              setFilterStatus('all')
              setFilterFrom('')
              setFilterTo('')
            }}
          >
            Clear
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
            <select
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">All</option>
              <option value="upcoming">Upcoming</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">From</label>
            <input
              type="date"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">To</label>
            <input
              type="date"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px]">
            <thead className="bg-slate-50 text-left text-xs font-medium text-slate-600 uppercase">
              <tr>
                <th className="px-4 py-3">Address</th>
                <th className="px-4 py-3">Property</th>
                <th className="px-4 py-3">Agent</th>
                <th className="px-4 py-3">Starts</th>
                <th className="px-4 py-3">Ends</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Attendees</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    No open house events. Create one to get started.
                  </td>
                </tr>
              ) : (
                filteredEvents.map((e) => {
                  const st = displayEventStatus(e)
                  const propLabel = e.properties
                    ? [e.properties.address, e.properties.city].filter(Boolean).join(', ')
                    : '—'
                  const agentName = agent.full_name || 'Agent'
                  return (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900 max-w-[220px]">{e.address}</td>
                      <td className="px-4 py-3 text-slate-600">{propLabel}</td>
                      <td className="px-4 py-3 text-slate-700">{agentName}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {format(parseISO(e.scheduled_at), 'MMM d, yyyy h:mm a')}
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {format(parseISO(e.ends_at), 'MMM d, yyyy h:mm a')}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadgeClass(
                            st
                          )}`}
                        >
                          {st === 'active' && (
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                            </span>
                          )}
                          {st}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{counts[e.id] ?? 0}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setDrawerEvent(e)}
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Attendees
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {createOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Home className="w-5 h-5" />
                New open house
              </h2>
              <button type="button" onClick={() => setCreateOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Address</label>
                <input
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="Street, area, city"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Search properties</label>
                <input
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-2"
                  value={propSearch}
                  onChange={(e) => setPropSearch(e.target.value)}
                  placeholder="Filter by address or city…"
                />
                <label className="block text-xs font-medium text-slate-500 mb-1">Property</label>
                <select
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                  value={form.property_id}
                  onChange={(e) => setForm((f) => ({ ...f, property_id: e.target.value }))}
                >
                  <option value="">None</option>
                  {filteredProperties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {[p.address, p.city].filter(Boolean).join(', ') || p.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Hosting agent</label>
                <p className="text-sm text-slate-800 border border-slate-200 rounded-lg px-3 py-2 bg-slate-50">
                  {agent.full_name || 'You'}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Date</label>
                  <input
                    type="date"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    value={form.date}
                    onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Start</label>
                  <input
                    type="time"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    value={form.start_time}
                    onChange={(e) => {
                      const v = e.target.value
                      setForm((f) => ({ ...f, start_time: v }))
                      syncEndFromStart(v)
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">End</label>
                  <input
                    type="time"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    value={form.end_time}
                    onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="flex-1 py-2 border border-slate-300 rounded-lg text-slate-700 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={saveEvent}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {drawerEvent && (
        <>
          <button
            type="button"
            className="fixed inset-0 bg-slate-900/40 z-40"
            aria-label="Close"
            onClick={() => setDrawerEvent(null)}
          />
          <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white shadow-2xl border-l border-slate-200 flex flex-col">
            <div className="p-4 border-b border-slate-200 flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-slate-900 leading-snug">{drawerEvent.address}</h2>
                <p className="text-sm text-slate-500 mt-1 flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  Attendees ({counts[drawerEvent.id] ?? attendees.length})
                </p>
              </div>
              <button type="button" onClick={() => setDrawerEvent(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              <div>
                <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                  <Link2 className="w-4 h-4" />
                  Guest check-in link
                </h3>
                <p className="text-xs text-slate-500 mb-2">
                  Share this link or QR-friendly URL so visitors can check in on their phones.
                </p>
                <div className="flex gap-2">
                  <input
                    readOnly
                    className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-700 bg-slate-50"
                    value={publicCheckInUrl}
                    onFocus={(e) => e.target.select()}
                  />
                  <button
                    type="button"
                    onClick={copyCheckInLink}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    {linkCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    {linkCopied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <a
                  href={publicCheckInUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-xs font-medium text-blue-600 hover:underline"
                >
                  Open public check-in page →
                </a>
              </div>

              <div>
                <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Check in
                </h3>
                <div className="space-y-2">
                  <input
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    placeholder="Name"
                    value={checkIn.name}
                    onChange={(e) => setCheckIn((c) => ({ ...c, name: e.target.value }))}
                  />
                  <input
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    placeholder="Phone (required)"
                    value={checkIn.phone}
                    onChange={(e) => setCheckIn((c) => ({ ...c, phone: e.target.value }))}
                  />
                  <input
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    placeholder="Email (optional)"
                    value={checkIn.email}
                    onChange={(e) => setCheckIn((c) => ({ ...c, email: e.target.value }))}
                  />
                  <ConsentCheckbox
                    checked={checkInConsent}
                    onChange={setCheckInConsent}
                    showError={showCheckInConsentError}
                    context="openhouse"
                  />
                  {checkInErr && <p className="text-xs text-red-600">{checkInErr}</p>}
                  <button
                    type="button"
                    onClick={submitCheckIn}
                    className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                  >
                    Check In
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Attendee list
                  </h3>
                  <button
                    type="button"
                    disabled={triggerBusy}
                    onClick={() => triggerFollowups(drawerEvent.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-50"
                  >
                    <Radio className="w-3.5 h-3.5" />
                    {triggerBusy ? 'Triggering…' : 'Trigger follow-ups now'}
                  </button>
                </div>
                {attLoading ? (
                  <p className="text-sm text-slate-500 py-4">Loading…</p>
                ) : attendees.length === 0 ? (
                  <p className="text-sm text-slate-500">No check-ins yet.</p>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-xs text-slate-600">
                        <tr>
                          <th className="text-left px-3 py-2">Name</th>
                          <th className="text-left px-3 py-2">Phone</th>
                          <th className="text-left px-3 py-2">Checked in</th>
                          <th className="text-left px-3 py-2">Follow-up</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {attendees.map((a) => (
                          <tr key={a.id}>
                            <td className="px-3 py-2 font-medium text-slate-900">{a.name}</td>
                            <td className="px-3 py-2 text-slate-600">{a.phone}</td>
                            <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                              {format(parseISO(a.checked_in_at), 'MMM d, h:mm a')}
                            </td>
                            <td className="px-3 py-2">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${followBadgeClass(
                                  a.follow_up_status
                                )}`}
                              >
                                {a.follow_up_status.replace(/_/g, ' ')}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </>
      )}
    </div>
  )
}

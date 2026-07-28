import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import OpenHouseCheckIn from '../components/OpenHouseCheckIn'

type PublicEvent = {
  id: string
  address: string
  agent_id: string | null
  scheduled_at: string
  ends_at: string
  status: string
}

export default function OpenHouseCheckInPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const [event, setEvent] = useState<PublicEvent | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!eventId) {
      setError('Missing event id')
      setLoading(false)
      return
    }

    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/open-house/${eventId}`)
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(json.error || 'Event not found')
        }
        if (!cancelled) setEvent(json.event as PublicEvent)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load event')
          setEvent(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [eventId])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f1117] text-slate-300">
        Loading check-in…
      </div>
    )
  }

  if (error || !event || !eventId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0f1117] px-6 text-center">
        <h1 className="mb-2 text-xl font-bold text-slate-100">Open house unavailable</h1>
        <p className="max-w-sm text-sm text-slate-400">
          {error || 'This check-in link is invalid or the event was removed.'}
        </p>
      </div>
    )
  }

  return (
    <OpenHouseCheckIn
      eventId={event.id}
      propertyAddress={event.address}
      agentId={event.agent_id || ''}
    />
  )
}

import React, { useEffect, useState } from 'react'
import { ShieldCheck, ShieldX, Loader2 } from 'lucide-react'
import { fetchLeadConsent, type LeadConsent } from '../../lib/crm'

type Props = {
  leadId: string | null | undefined
}

export default function ConsentBadge({ leadId }: Props) {
  const [consent, setConsent] = useState<LeadConsent | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!leadId) {
      setConsent(null)
      return
    }
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const row = await fetchLeadConsent(leadId!)
        if (!cancelled) setConsent(row)
      } catch (e) {
        console.error('Consent fetch failed:', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [leadId])

  if (!leadId) return null

  if (loading) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-500">
        <Loader2 className="w-3 h-3 animate-spin" />
        Consent…
      </span>
    )
  }

  if (!consent) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
        <ShieldX className="w-3 h-3" />
        No consent log
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
        consent.opted_in ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
      }`}
      title={`${consent.source} via ${consent.channel}`}
    >
      {consent.opted_in ? <ShieldCheck className="w-3 h-3" /> : <ShieldX className="w-3 h-3" />}
      {consent.opted_in ? 'Opted in' : 'Opted out'} · {consent.source}
    </span>
  )
}

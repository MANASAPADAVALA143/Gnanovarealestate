import { useState } from 'react'
import { ConsentCheckbox, useConsentGate } from './ConsentCheckbox'
import { supabase } from '../lib/supabase'

interface CheckInData {
  name: string
  phone: string
  email: string
  looking_for: string
  budget: string
  timeline: string
}

interface Props {
  eventId: string
  propertyAddress: string
  agentId: string
}

export default function OpenHouseCheckIn({ eventId, propertyAddress, agentId }: Props) {
  const [formData, setFormData] = useState<CheckInData>({
    name: '',
    phone: '',
    email: '',
    looking_for: 'Buy',
    budget: '',
    timeline: 'ASAP',
  })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const { consentGiven, setConsentGiven, showConsentError, checkConsent, logConsent } =
    useConsentGate(supabase)

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!checkConsent()) return
    setLoading(true)
    try {
      const res = await fetch(`/api/open-house/${eventId}/attendees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          agent_id: agentId,
          consent_given: true,
          consent_timestamp: new Date().toISOString(),
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || 'Check-in failed')
      }
      const data = await res.json()
      await logConsent({
        lead_id: data.attendee_id,
        phone: formData.phone,
        email: formData.email || undefined,
        context: 'openhouse',
      })
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Check-in failed. Please ask the agent for help.')
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setSuccess(false)
    setConsentGiven(false)
    setFormData({
      name: '',
      phone: '',
      email: '',
      looking_for: 'Buy',
      budget: '',
      timeline: 'ASAP',
    })
  }

  if (success) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0f1117] px-6 py-8 text-center">
        <div className="mb-4 text-5xl">🏠</div>
        <h2 className="mb-2 text-2xl font-bold text-slate-100">Welcome!</h2>
        <p className="mb-6 max-w-sm text-sm leading-relaxed text-slate-400">
          You&apos;re checked in. Our agent will be in touch with more information about this property and
          similar listings.
        </p>
        <button
          type="button"
          onClick={resetForm}
          className="rounded-lg border border-slate-700 px-5 py-2.5 text-sm text-slate-300 hover:border-slate-500"
        >
          Check in another guest
        </button>
      </div>
    )
  }

  const fieldClass =
    'w-full rounded-lg border border-slate-700 bg-[#0f1117] px-3.5 py-2.5 text-sm text-slate-200 outline-none focus:border-sky-500'

  return (
    <div className="flex min-h-screen flex-col items-center bg-[#0f1117] px-4 py-8 pb-16">
      <div className="mb-7 w-full max-w-md text-center">
        <span className="mb-3 inline-block rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-sky-400">
          Open House
        </span>
        <h1 className="text-xl font-bold text-slate-100">{propertyAddress}</h1>
        <p className="mt-1 text-sm text-slate-500">Please fill in your details to check in.</p>
      </div>

      <div className="w-full max-w-md rounded-xl border border-slate-800 bg-[#1a1f2e] p-6">
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label htmlFor="oh-name" className="mb-1.5 block text-xs font-medium text-slate-400">
              Full name *
            </label>
            <input
              id="oh-name"
              name="name"
              type="text"
              value={formData.name}
              onChange={handleChange}
              placeholder="Your name"
              required
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor="oh-phone" className="mb-1.5 block text-xs font-medium text-slate-400">
              Mobile number *
            </label>
            <input
              id="oh-phone"
              name="phone"
              type="tel"
              value={formData.phone}
              onChange={handleChange}
              placeholder="+971 50 000 0000"
              required
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor="oh-email" className="mb-1.5 block text-xs font-medium text-slate-400">
              Email address
            </label>
            <input
              id="oh-email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="you@example.com"
              className={fieldClass}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="oh-looking" className="mb-1.5 block text-xs font-medium text-slate-400">
                I&apos;m looking to
              </label>
              <select
                id="oh-looking"
                name="looking_for"
                value={formData.looking_for}
                onChange={handleChange}
                className={fieldClass}
              >
                {['Buy', 'Rent', 'Invest', 'Just exploring'].map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="oh-timeline" className="mb-1.5 block text-xs font-medium text-slate-400">
                Timeline
              </label>
              <select
                id="oh-timeline"
                name="timeline"
                value={formData.timeline}
                onChange={handleChange}
                className={fieldClass}
              >
                {['ASAP', '1–3 months', '3–6 months', '6+ months'].map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="oh-budget" className="mb-1.5 block text-xs font-medium text-slate-400">
              Budget (AED)
            </label>
            <input
              id="oh-budget"
              name="budget"
              type="text"
              value={formData.budget}
              onChange={handleChange}
              placeholder="e.g. 1,500,000 – 2,000,000"
              className={fieldClass}
            />
          </div>

          <ConsentCheckbox
            checked={consentGiven}
            onChange={setConsentGiven}
            showError={showConsentError}
            context="openhouse"
            variant="dark"
          />

          {error && <p className="text-xs text-orange-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-purple-700 py-3.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Checking in…' : 'Check in →'}
          </button>
        </form>
      </div>
    </div>
  )
}

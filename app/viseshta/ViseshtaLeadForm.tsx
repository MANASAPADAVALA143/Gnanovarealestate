'use client'

import { useState, type FormEvent } from 'react'

type Fields = { name: string; phone: string; email: string; city: string; company: string }

const EMPTY: Fields = { name: '', phone: '', email: '', city: '', company: '' }

export default function ViseshtaLeadForm() {
  const [fields, setFields] = useState<Fields>(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const set = (key: keyof Fields) => (e: { target: { value: string } }) =>
    setFields((f) => ({ ...f, [key]: e.target.value }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const utm = new URLSearchParams(window.location.search)
      const res = await fetch('/api/public/viseshta-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...fields,
          source: utm.get('utm_source') || 'Instagram',
          campaign: utm.get('utm_campaign') || undefined,
        }),
      })
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(j.error || 'Could not submit. Please try again.')
      setDone(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not submit. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl bg-white p-6 text-center text-slate-900 shadow-2xl sm:p-8">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl">
          ✓
        </div>
        <h2 className="text-xl font-bold">Thank you!</h2>
        <p className="mt-2 text-sm text-slate-600">
          You will receive the brochure on WhatsApp shortly. Our team will call you within 60 seconds.
        </p>
      </div>
    )
  }

  const input =
    'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-300'

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl bg-white p-6 text-slate-900 shadow-2xl sm:p-8">
      <div>
        <h2 className="text-lg font-bold">Get your free financial breakdown</h2>
        <p className="mt-1 text-sm text-slate-500">Brochure on WhatsApp + a quick call from our team.</p>
      </div>

      <label className="block text-sm font-medium text-slate-700">
        Full Name
        <input required autoComplete="name" value={fields.name} onChange={set('name')} className={input} />
      </label>

      <label className="block text-sm font-medium text-slate-700">
        Phone Number
        <div className="mt-1 flex">
          <span className="inline-flex items-center rounded-l-lg border border-r-0 border-slate-300 bg-slate-50 px-3 text-base text-slate-500">
            +91
          </span>
          <input
            required
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="98765 43210"
            value={fields.phone}
            onChange={set('phone')}
            className={`${input} mt-0 rounded-l-none`}
          />
        </div>
      </label>

      <label className="block text-sm font-medium text-slate-700">
        Email
        <input type="email" autoComplete="email" value={fields.email} onChange={set('email')} className={input} />
      </label>

      <label className="block text-sm font-medium text-slate-700">
        City
        <input autoComplete="address-level2" value={fields.city} onChange={set('city')} className={input} />
      </label>

      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={fields.company}
        onChange={set('company')}
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
      />

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-amber-400 px-4 py-3.5 text-base font-bold text-[#0a1430] transition hover:bg-amber-300 disabled:opacity-60"
      >
        {submitting ? 'Submitting…' : 'Get Free Financial Breakdown'}
      </button>

      <p className="text-center text-[11px] leading-snug text-slate-500">
        By submitting, you agree to be contacted by phone, WhatsApp and email about Viseshta Avenues.
      </p>
    </form>
  )
}

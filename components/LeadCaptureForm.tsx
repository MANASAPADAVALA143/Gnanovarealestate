import { useState } from 'react'
import { ConsentCheckbox, useConsentGate } from '@/src/components/ConsentCheckbox'
import { supabase } from '@/src/lib/supabase'

type LeadCaptureFormProps = {
  /** Dark theme for Gnanova landing; light keeps HomePage / legacy styling */
  variant?: 'light' | 'dark'
}

export default function LeadCaptureForm({ variant = 'light' }: LeadCaptureFormProps) {
  const dark = variant === 'dark'
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    location: '',
    timeline: 'Immediately',
  })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const { consentGiven, setConsentGiven, showConsentError, checkConsent, logConsent } =
    useConsentGate(supabase)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setResult(null)
    if (!checkConsent()) return

    setLoading(true)

    try {
      const response = await fetch('/api/leads/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          source: 'website',
          consent_given: true,
          consent_timestamp: new Date().toISOString(),
        }),
      })

      if (!response.ok) {
        let errorMessage = 'Failed to create lead'
        try {
          const data = await response.json()
          errorMessage = data.error || errorMessage
        } catch {
          errorMessage = `Server error: ${response.status} ${response.statusText}`
        }
        setResult({
          type: 'error',
          message: errorMessage,
        })
        return
      }

      const data = await response.json()

      await logConsent({
        lead_id: data.leadId,
        email: formData.email,
        phone: formData.phone,
        context: 'lead',
      })

      setResult({
        type: 'success',
        message: data.message || 'Lead captured. AI will call within 2 minutes.',
      })
      setFormData({ name: '', email: '', phone: '', location: '', timeline: 'Immediately' })
      setConsentGiven(false)
    } catch (error: any) {
      console.error('Network error:', error)
      let errorMessage = 'Network error. Please try again.'

      if (error.message) {
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          errorMessage =
            'Cannot connect to server. Please make sure the backend server is running on port 3001.'
        } else {
          errorMessage = error.message
        }
      }

      setResult({
        type: 'error',
        message: errorMessage,
      })
    } finally {
      setLoading(false)
    }
  }

  const labelCls = dark
    ? 'block text-sm font-medium mb-1 text-[#94A3B8]'
    : 'block text-sm font-medium mb-1'
  const inputCls = dark
    ? 'w-full px-4 py-2.5 rounded-[10px] bg-[#243447] border border-white/10 text-white placeholder:text-[#64748B] focus:outline-none focus:border-[#7C3AED]'
    : 'w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500'
  const wrapCls = dark
    ? 'w-full'
    : 'max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg'

  return (
    <div className={wrapCls}>
      {!dark && (
        <h2 className="text-2xl font-bold mb-4 text-center">🏠 Get Instant Consultation</h2>
      )}

      {result && (
        <div
          className={`mb-4 p-4 rounded-lg text-sm ${
            result.type === 'success'
              ? dark
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                : 'bg-green-100 text-green-800'
              : dark
                ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                : 'bg-red-100 text-red-800'
          }`}
        >
          {result.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelCls}>Name *</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            className={inputCls}
            placeholder="Ahmed Al Maktoum"
          />
        </div>

        <div>
          <label className={labelCls}>Email *</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
            className={inputCls}
            placeholder="ahmed@example.com"
          />
        </div>

        <div>
          <label className={labelCls}>Phone *</label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            required
            className={inputCls}
            placeholder="+971-50-123-4567"
          />
        </div>

        <div>
          <label className={labelCls}>Location *</label>
          <input
            type="text"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            required
            className={inputCls}
            placeholder="Dubai Marina, Dubai"
          />
        </div>

        <div>
          <label className={labelCls}>Timeline</label>
          <select
            value={formData.timeline}
            onChange={(e) => setFormData({ ...formData, timeline: e.target.value })}
            className={inputCls}
          >
            <option>Immediately</option>
            <option>1-3 months</option>
            <option>3-6 months</option>
            <option>6+ months</option>
          </select>
        </div>

        <div className={dark ? 'text-[#94A3B8] [&_label]:text-[#94A3B8] [&_a]:text-[#A78BFA]' : ''}>
          <ConsentCheckbox
            checked={consentGiven}
            onChange={setConsentGiven}
            showError={showConsentError}
            context="lead"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className={
            dark
              ? 'w-full py-3 gn-btn-gradient disabled:opacity-50 disabled:shadow-none'
              : 'w-full py-3 bg-blue-600 text-white rounded font-semibold hover:bg-blue-700 disabled:bg-gray-400'
          }
        >
          {loading ? 'Calling…' : 'Call Me Now'}
        </button>
      </form>
    </div>
  )
}

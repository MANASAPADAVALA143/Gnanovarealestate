import { useState } from 'react'
import { ConsentCheckbox, useConsentGate } from '@/src/components/ConsentCheckbox'
import { supabase } from '@/src/lib/supabase'

export default function LeadCaptureForm() {
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
          errorMessage = 'Cannot connect to server. Please make sure the backend server is running on port 3001.'
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

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4 text-center">
        🏠 Get Instant Consultation
      </h2>

      {result && (
        <div className={`mb-4 p-4 rounded ${result.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {result.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Name *</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            required
            className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
            placeholder="John Smith"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Email *</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
            required
            className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
            placeholder="john@example.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Phone *</label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({...formData, phone: e.target.value})}
            required
            className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
            placeholder="+1-555-123-4567"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Location *</label>
          <input
            type="text"
            value={formData.location}
            onChange={(e) => setFormData({...formData, location: e.target.value})}
            required
            className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
            placeholder="Dubai Marina, Dubai"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Timeline</label>
          <select
            value={formData.timeline}
            onChange={(e) => setFormData({...formData, timeline: e.target.value})}
            className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
          >
            <option>Immediately</option>
            <option>1-3 months</option>
            <option>3-6 months</option>
            <option>6+ months</option>
          </select>
        </div>

        <ConsentCheckbox
          checked={consentGiven}
          onChange={setConsentGiven}
          showError={showConsentError}
          context="lead"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-blue-600 text-white rounded font-semibold hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? '⏳ Calling...' : '📞 Call Me Now'}
        </button>
      </form>
    </div>
  )
}


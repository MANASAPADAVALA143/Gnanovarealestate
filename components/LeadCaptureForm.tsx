import { useState } from 'react'

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setResult(null)

    try {
      const response = await fetch('/api/vapi/initiate-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (response.ok) {
        setResult({
          type: 'success',
          message: `Success! You'll receive a call at ${formData.phone} shortly!`,
        })
        setFormData({ name: '', email: '', phone: '', location: '', timeline: 'Immediately' })
      } else {
        setResult({
          type: 'error',
          message: data.error || 'Failed to initiate call',
        })
      }
    } catch (error) {
      setResult({
        type: 'error',
        message: 'Network error. Please try again.',
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
            placeholder="New York, NY"
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


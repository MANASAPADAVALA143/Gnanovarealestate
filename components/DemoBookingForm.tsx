import { useState } from 'react'

export default function DemoBookingForm() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    country: '',
    preferredTime: '',
    message: '',
  })

  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  
  const countries = [
    { code: 'IN', name: 'India', flag: '🇮🇳', phonePrefix: '+91' },
    { code: 'US', name: 'United States', flag: '🇺🇸', phonePrefix: '+1' },
    { code: 'UK', name: 'United Kingdom', flag: '🇬🇧', phonePrefix: '+44' },
    { code: 'AU', name: 'Australia', flag: '🇦🇺', phonePrefix: '+61' },
    { code: 'AE', name: 'UAE/Dubai', flag: '🇦🇪', phonePrefix: '+971' },
  ]

  const timeSlots = [
    '9:00 AM - 9:30 AM',
    '10:00 AM - 10:30 AM',
    '11:00 AM - 11:30 AM',
    '2:00 PM - 2:30 PM',
    '3:00 PM - 3:30 PM',
    '4:00 PM - 4:30 PM',
    '5:00 PM - 5:30 PM',
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setResult(null)

    try {
      const response = await fetch('/api/schedule-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (response.ok) {
        setResult({
          type: 'success',
          message: 'Demo scheduled successfully! Check your email for confirmation.',
        })

        setFormData({
          name: '',
          email: '',
          phone: '',
          company: '',
          country: '',
          preferredTime: '',
          message: '',
        })
      } else {
        setResult({
          type: 'error',
          message: data.error || 'Failed to schedule demo',
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const selectedCountry = countries.find((c) => c.code === formData.country)

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-xl">
      <div className="text-center mb-8">
        <h2 className="text-4xl font-bold mb-3 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Schedule Your 30-Minute Demo
        </h2>
        <p className="text-lg text-gray-600">See Gnanova AI Voice Agent in action!</p>
      </div>

      {result && (
        <div
          className={`mb-6 p-4 rounded-lg border-2 ${
            result.type === 'success'
              ? 'bg-green-50 border-green-500 text-green-800'
              : 'bg-red-50 border-red-500 text-red-800'
          }`}
        >
          <p className="font-semibold flex items-center gap-2">
            {result.type === 'success' ? '✅' : '❌'}
            {result.type === 'success' ? 'Success!' : 'Error'}
          </p>
          <p className="text-sm mt-1">{result.message}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name *</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none transition"
            placeholder="John Smith"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address *</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none transition"
            placeholder="john@company.com"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Country *</label>
          <select
            name="country"
            value={formData.country}
            onChange={handleChange}
            required
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none transition"
          >
            <option value="">Select your country</option>
            {countries.map((country) => (
              <option key={country.code} value={country.code}>
                {country.flag} {country.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Phone Number *</label>
          <div className="flex gap-3">
            {selectedCountry && (
              <div className="px-4 py-3 bg-gray-100 border-2 border-gray-300 rounded-lg text-gray-700 font-semibold min-w-[100px] flex items-center justify-center">
                {selectedCountry.flag} {selectedCountry.phonePrefix}
              </div>
            )}
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              required
              className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none transition"
              placeholder={selectedCountry ? '9876543210' : 'Select country first'}
            />
          </div>
          {selectedCountry && (
            <p className="text-xs text-gray-500 mt-2">
              Full number: {selectedCountry.phonePrefix}
              {formData.phone || 'XXXXXXXXXX'}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Company Name</label>
          <input
            type="text"
            name="company"
            value={formData.company}
            onChange={handleChange}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none transition"
            placeholder="Your Real Estate Company"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Preferred Time Slot *</label>
          <select
            name="preferredTime"
            value={formData.preferredTime}
            onChange={handleChange}
            required
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none transition"
          >
            <option value="">Select time slot</option>
            {timeSlots.map((slot) => (
              <option key={slot} value={slot}>
                {slot}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-2">⏰ All times shown in your local timezone</p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Additional Notes (Optional)</label>
          <textarea
            name="message"
            value={formData.message}
            onChange={handleChange}
            rows={4}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none transition"
            placeholder="Tell us about your requirements or ask any questions..."
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`w-full py-4 px-6 rounded-lg font-bold text-lg text-white transition-all ${
            loading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 hover:shadow-xl transform hover:-translate-y-0.5'
          }`}
        >
          {loading ? '⏳ Scheduling Your Demo...' : '📅 Schedule My 30-Minute Demo'}
        </button>
      </form>

      <div className="mt-8 p-5 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border-2 border-blue-200">
        <p className="font-semibold text-blue-900 mb-3">🎯 What You'll See in the Demo:</p>
        <ul className="space-y-2 text-sm text-blue-800">
          <li className="flex items-start gap-2">
            <span className="text-blue-600">✓</span>
            <span>Live AI voice agent calling and qualifying leads</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600">✓</span>
            <span>Real-time dashboard with lead scoring and analytics</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600">✓</span>
            <span>Custom setup walkthrough for your business</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600">✓</span>
            <span>Integration options (CRM, calendar, email)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600">✓</span>
            <span>Q&A session with our team</span>
          </li>
        </ul>
      </div>
    </div>
  )
}


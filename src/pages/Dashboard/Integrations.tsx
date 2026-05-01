import React, { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { 
  Check, 
  X, 
  Link as LinkIcon, 
  Facebook, 
  Phone, 
  Settings,
  Save,
  Eye,
  EyeOff,
  Calendar,
} from 'lucide-react'

interface IntegrationSetting {
  id?: string
  integration_type: string
  is_enabled: boolean
  api_key?: string
  api_secret?: string
  webhook_url?: string
  config?: any
}

export default function Integrations() {
  const { agent } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // GoHighLevel settings
  const [ghlEnabled, setGhlEnabled] = useState(false)
  const [ghlApiKey, setGhlApiKey] = useState('')
  const [ghlLocationId, setGhlLocationId] = useState('')
  const [showGhlKey, setShowGhlKey] = useState(false)
  
  // Facebook settings
  const [fbEnabled, setFbEnabled] = useState(false)
  const [fbVerifyToken, setFbVerifyToken] = useState('')
  const [fbAppSecret, setFbAppSecret] = useState('')
  const [showFbSecret, setShowFbSecret] = useState(false)
  
  // VAPI Inbound settings
  const [vapiEnabled, setVapiEnabled] = useState(false)
  const [vapiPhoneNumber, setVapiPhoneNumber] = useState('')

  // Cal.com (appointment slots)
  const [calEnabled, setCalEnabled] = useState(false)
  const [calApiKey, setCalApiKey] = useState('')
  const [calUsername, setCalUsername] = useState('')
  const [calEventTypeId, setCalEventTypeId] = useState('')
  const [showCalKey, setShowCalKey] = useState(false)

  useEffect(() => {
    fetchIntegrationSettings()
  }, [agent])

  async function fetchIntegrationSettings() {
    try {
      setLoading(true)
      
      // Fetch all integration settings
      const { data, error } = await supabase
        .from('integration_settings')
        .select('*')
        .or(`agent_id.eq.${agent?.id},agent_id.is.null`)

      if (error) throw error

      // Map settings to state
      if (data) {
        data.forEach((setting: IntegrationSetting) => {
          switch (setting.integration_type) {
            case 'gohighlevel':
              setGhlEnabled(setting.is_enabled)
              setGhlApiKey(setting.api_key || '')
              setGhlLocationId(setting.config?.location_id || '')
              break
            case 'facebook':
              setFbEnabled(setting.is_enabled)
              setFbVerifyToken(setting.api_key || '')
              setFbAppSecret(setting.api_secret || '')
              break
            case 'vapi_inbound':
              setVapiEnabled(setting.is_enabled)
              setVapiPhoneNumber(setting.config?.phone_number || '')
              break
            case 'cal_com':
              setCalEnabled(setting.is_enabled)
              setCalApiKey(setting.api_key || '')
              setCalUsername(setting.config?.username || '')
              setCalEventTypeId(setting.config?.event_type_id || '')
              break
          }
        })
      }
    } catch (error) {
      console.error('Error fetching integration settings:', error)
    } finally {
      setLoading(false)
    }
  }

  async function saveIntegration(
    type: string,
    enabled: boolean,
    apiKey?: string,
    apiSecret?: string,
    config?: any
  ) {
    try {
      setSaving(true)

      // Check if integration exists
      const { data: existing } = await supabase
        .from('integration_settings')
        .select('id')
        .eq('integration_type', type)
        .or(`agent_id.eq.${agent?.id},agent_id.is.null`)
        .single()

      const integrationData = {
        agent_id: agent?.id || null,
        integration_type: type,
        is_enabled: enabled,
        api_key: apiKey || null,
        api_secret: apiSecret || null,
        config: config || {},
        updated_at: new Date().toISOString(),
      }

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('integration_settings')
          .update(integrationData)
          .eq('id', existing.id)

        if (error) throw error
      } else {
        // Insert new
        const { error } = await supabase
          .from('integration_settings')
          .insert({
            ...integrationData,
            created_at: new Date().toISOString(),
          })

        if (error) throw error
      }

      alert('Integration settings saved successfully!')
    } catch (error: any) {
      console.error('Error saving integration:', error)
      alert(`Error: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveGHL() {
    if (ghlEnabled && !ghlApiKey) {
      alert('Please enter GoHighLevel API Key')
      return
    }

    await saveIntegration(
      'gohighlevel',
      ghlEnabled,
      ghlApiKey,
      undefined,
      { location_id: ghlLocationId }
    )
  }

  async function handleSaveFacebook() {
    if (fbEnabled && (!fbVerifyToken || !fbAppSecret)) {
      alert('Please enter Facebook Verify Token and App Secret')
      return
    }

    await saveIntegration(
      'facebook',
      fbEnabled,
      fbVerifyToken,
      fbAppSecret
    )
  }

  async function handleSaveVAPI() {
    if (vapiEnabled && !vapiPhoneNumber) {
      alert('Please enter VAPI phone number')
      return
    }

    await saveIntegration(
      'vapi_inbound',
      vapiEnabled,
      undefined,
      undefined,
      { phone_number: vapiPhoneNumber }
    )
  }

  async function handleSaveCalCom() {
    if (calEnabled && (!calApiKey || !calUsername || !calEventTypeId)) {
      alert('Cal.com requires API key, username, and event type ID')
      return
    }

    await saveIntegration('cal_com', calEnabled, calApiKey, undefined, {
      username: calUsername,
      event_type_id: calEventTypeId,
    })
  }

  async function testGHLConnection() {
    if (!ghlApiKey) {
      alert('Please enter API key first')
      return
    }

    try {
      const response = await fetch('http://localhost:3001/api/test/gohighlevel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Test Contact',
          phone: '+1234567890',
          email: 'test@example.com',
          source: 'test',
        }),
      })

      const result = await response.json()

      if (result.success) {
        alert('✅ GoHighLevel connection successful!')
      } else {
        alert(`❌ Connection failed: ${result.error}`)
      }
    } catch (error: any) {
      alert(`❌ Error: ${error.message}`)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading integrations...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
        <p className="text-sm text-gray-600 mt-1">
          Connect external services to supercharge your lead management
        </p>
      </div>

      {/* GoHighLevel Integration */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-100 rounded-lg">
                <LinkIcon className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">GoHighLevel CRM</h2>
                <p className="text-sm text-gray-600">
                  Automatically sync all leads to your GHL CRM
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {ghlEnabled ? (
                <span className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                  <Check className="w-4 h-4" />
                  Connected
                </span>
              ) : (
                <span className="flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
                  <X className="w-4 h-4" />
                  Disabled
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Enable Toggle */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">
              Enable GoHighLevel Sync
            </label>
            <button
              onClick={() => setGhlEnabled(!ghlEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                ghlEnabled ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  ghlEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* API Key */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              API Key
            </label>
            <div className="relative">
              <input
                type={showGhlKey ? 'text' : 'password'}
                value={ghlApiKey}
                onChange={(e) => setGhlApiKey(e.target.value)}
                placeholder="Enter your GoHighLevel API Key"
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={!ghlEnabled}
              />
              <button
                type="button"
                onClick={() => setShowGhlKey(!showGhlKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showGhlKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Location ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Location ID (Optional)
            </label>
            <input
              type="text"
              value={ghlLocationId}
              onChange={(e) => setGhlLocationId(e.target.value)}
              placeholder="Enter Location ID"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={!ghlEnabled}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4">
            <button
              onClick={handleSaveGHL}
              disabled={saving || !ghlEnabled}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
            <button
              onClick={testGHLConnection}
              disabled={!ghlEnabled || !ghlApiKey}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
            >
              Test Connection
            </button>
          </div>

          {/* Instructions */}
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <h4 className="text-sm font-medium text-blue-900 mb-2">Setup Instructions:</h4>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>Go to GoHighLevel Settings → API</li>
              <li>Generate a new API Key with Contacts permission</li>
              <li>Copy and paste the API Key above</li>
              <li>Optional: Add your Location ID for multi-location accounts</li>
              <li>Click "Save Settings" and test the connection</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Facebook Lead Ads Integration */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Facebook className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Facebook Lead Ads</h2>
                <p className="text-sm text-gray-600">
                  Automatically call leads from Facebook Ad campaigns
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {fbEnabled ? (
                <span className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                  <Check className="w-4 h-4" />
                  Connected
                </span>
              ) : (
                <span className="flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
                  <X className="w-4 h-4" />
                  Disabled
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Enable Toggle */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">
              Enable Facebook Lead Ads
            </label>
            <button
              onClick={() => setFbEnabled(!fbEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                fbEnabled ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  fbEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Webhook URL (Read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Webhook URL
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value="https://your-domain.com/api/webhooks/facebook-leads"
                readOnly
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText('https://your-domain.com/api/webhooks/facebook-leads')
                  alert('Webhook URL copied to clipboard!')
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Copy
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Use this URL in your Facebook App webhook settings
            </p>
          </div>

          {/* Verify Token */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Verify Token
            </label>
            <input
              type="text"
              value={fbVerifyToken}
              onChange={(e) => setFbVerifyToken(e.target.value)}
              placeholder="Enter verification token"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={!fbEnabled}
            />
          </div>

          {/* App Secret */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              App Secret
            </label>
            <div className="relative">
              <input
                type={showFbSecret ? 'text' : 'password'}
                value={fbAppSecret}
                onChange={(e) => setFbAppSecret(e.target.value)}
                placeholder="Enter Facebook App Secret"
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={!fbEnabled}
              />
              <button
                type="button"
                onClick={() => setShowFbSecret(!showFbSecret)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showFbSecret ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4">
            <button
              onClick={handleSaveFacebook}
              disabled={saving || !fbEnabled}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>

          {/* Instructions */}
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <h4 className="text-sm font-medium text-blue-900 mb-2">Setup Instructions:</h4>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>Create a Facebook App in Facebook Developers Console</li>
              <li>Add Webhooks product to your app</li>
              <li>Subscribe to "leadgen" events</li>
              <li>Set the webhook URL to the one shown above</li>
              <li>Enter your verify token and app secret</li>
              <li>Save settings and verify in Facebook</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Cal.com — agent availability for Appointments */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-violet-100 rounded-lg">
                <Calendar className="w-6 h-6 text-violet-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Cal.com</h2>
                <p className="text-sm text-gray-600">
                  Pull real availability into Schedule showing (Appointments page)
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {calEnabled ? (
                <span className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                  <Check className="w-4 h-4" />
                  Connected
                </span>
              ) : (
                <span className="flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
                  <X className="w-4 h-4" />
                  Disabled
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">Enable Cal.com slots</label>
            <button
              type="button"
              onClick={() => setCalEnabled(!calEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                calEnabled ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  calEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">API key</label>
            <div className="relative">
              <input
                type={showCalKey ? 'text' : 'password'}
                value={calApiKey}
                onChange={(e) => setCalApiKey(e.target.value)}
                placeholder="Cal.com API key"
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={!calEnabled}
              />
              <button
                type="button"
                onClick={() => setShowCalKey(!showCalKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showCalKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cal.com username</label>
            <input
              type="text"
              value={calUsername}
              onChange={(e) => setCalUsername(e.target.value)}
              placeholder="your-handle"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={!calEnabled}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Event type ID</label>
            <input
              type="text"
              value={calEventTypeId}
              onChange={(e) => setCalEventTypeId(e.target.value)}
              placeholder="Numeric event type ID from Cal.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={!calEnabled}
            />
            <p className="text-xs text-gray-500 mt-1">
              Slots are requested via your backend at <code className="text-gray-600">/api/calcom/slots</code>{' '}
              (dev: webhook server on port 3001).
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleSaveCalCom}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Cal.com'}
            </button>
          </div>
        </div>
      </div>

      {/* VAPI Inbound Integration */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <Phone className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">VAPI Inbound Calls</h2>
                <p className="text-sm text-gray-600">
                  AI receptionist answers incoming calls automatically
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {vapiEnabled ? (
                <span className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                  <Check className="w-4 h-4" />
                  Active
                </span>
              ) : (
                <span className="flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
                  <X className="w-4 h-4" />
                  Disabled
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Enable Toggle */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">
              Enable Inbound AI Receptionist
            </label>
            <button
              onClick={() => setVapiEnabled(!vapiEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                vapiEnabled ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  vapiEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Phone Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              VAPI Phone Number
            </label>
            <input
              type="text"
              value={vapiPhoneNumber}
              onChange={(e) => setVapiPhoneNumber(e.target.value)}
              placeholder="+1234567890"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={!vapiEnabled}
            />
            <p className="text-xs text-gray-500 mt-1">
              Your VAPI inbound phone number
            </p>
          </div>

          {/* Webhook URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Inbound Webhook URL
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value="https://your-domain.com/api/vapi/inbound"
                readOnly
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText('https://your-domain.com/api/vapi/inbound')
                  alert('Webhook URL copied to clipboard!')
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Copy
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4">
            <button
              onClick={handleSaveVAPI}
              disabled={saving || !vapiEnabled}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>

          {/* Instructions */}
          <div className="mt-4 p-4 bg-green-50 rounded-lg">
            <h4 className="text-sm font-medium text-green-900 mb-2">How it Works:</h4>
            <ul className="text-sm text-green-800 space-y-1 list-disc list-inside">
              <li>When someone calls your VAPI number, Sarah answers automatically</li>
              <li>She qualifies the lead with the same questions as outbound calls</li>
              <li>Properties are searched in real-time during the call</li>
              <li>Appointments can be booked directly</li>
              <li>All call data is saved to your dashboard</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

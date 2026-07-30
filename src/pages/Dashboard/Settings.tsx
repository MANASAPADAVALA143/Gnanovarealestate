import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { User, Bell, Mic, Phone } from 'lucide-react'

type AgentSettings = {
  voice_gender: string
  voice_accent: string
  greeting_message: string
  notify_hot_leads: boolean
  notify_daily_summary: boolean
  notify_post_call_email: boolean
  notification_email: string
  notification_phone: string
}

export default function SettingsPage() {
  const { agent } = useAuth()
  const [activeTab, setActiveTab] = useState('profile')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  
  const [settings, setSettings] = useState<AgentSettings>({
    voice_gender: 'female',
    voice_accent: 'american',
    greeting_message: "Hi! This is calling from {agent_name}'s team...",
    notify_hot_leads: true,
    notify_daily_summary: true,
    notify_post_call_email: true,
    notification_email: agent?.email || '',
    notification_phone: agent?.phone || '',
  })

  useEffect(() => {
    if (agent) {
      fetchSettings()
    }
  }, [agent])

  async function fetchSettings() {
    try {
      const { data, error } = await supabase
        .from('agent_settings')
        .select('*')
        .eq('agent_id', agent!.id)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      
      if (data) {
        setSettings({
          voice_gender: data.voice_gender || 'female',
          voice_accent: data.voice_accent || 'american',
          greeting_message: data.greeting_message || settings.greeting_message,
          notify_hot_leads: data.notify_hot_leads ?? true,
          notify_daily_summary: data.notify_daily_summary ?? true,
          notify_post_call_email: data.notify_post_call_email ?? true,
          notification_email: data.notification_email || agent!.email,
          notification_phone: data.notification_phone || agent!.phone || '',
        })
      }
    } catch (error) {
      console.error('Error fetching settings:', error)
    }
  }

  async function saveSettings() {
    setLoading(true)
    setSaved(false)

    try {
      const { error } = await supabase
        .from('agent_settings')
        .upsert({
          agent_id: agent!.id,
          ...settings,
        })

      if (error) throw error

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      console.error('Error saving settings:', error)
      alert('Error saving settings')
    } finally {
      setLoading(false)
    }
  }

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'voice', label: 'AI Voice', icon: Mic },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'phone', label: 'Phone Number', icon: Phone },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-600 mt-1">Manage your account and AI preferences</p>
      </div>

      <div className="flex gap-6">
        {/* Tabs */}
        <div className="w-64 flex-shrink-0">
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                <span className="font-medium">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 p-6">
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Profile Information</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Full Name</label>
                    <input
                      type="text"
                      value={agent?.full_name || ''}
                      disabled
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                    <input
                      type="email"
                      value={agent?.email || ''}
                      disabled
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Phone</label>
                    <input
                      type="tel"
                      value={agent?.phone || ''}
                      disabled
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Location</label>
                    <input
                      type="text"
                      value={agent?.location || ''}
                      disabled
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Subscription</label>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                        {agent?.subscription_tier || 'Trial'}
                      </span>
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                        {agent?.subscription_status || 'Active'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'voice' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 mb-4">AI Voice Configuration</h2>
                <p className="text-sm text-slate-600 mb-6">
                  Customize how your AI assistant sounds when calling leads.
                </p>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Voice Gender</label>
                    <div className="flex gap-4">
                      {['female', 'male'].map((gender) => (
                        <button
                          key={gender}
                          onClick={() => setSettings({ ...settings, voice_gender: gender })}
                          className={`px-6 py-3 rounded-lg border-2 transition-colors ${
                            settings.voice_gender === gender
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {gender.charAt(0).toUpperCase() + gender.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Voice Accent</label>
                    <select
                      value={settings.voice_accent}
                      onChange={(e) => setSettings({ ...settings, voice_accent: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                    >
                      <option value="american">American</option>
                      <option value="british">British</option>
                      <option value="australian">Australian</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Greeting Message
                    </label>
                    <textarea
                      value={settings.greeting_message}
                      onChange={(e) => setSettings({ ...settings, greeting_message: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                      placeholder="Hi! This is calling from {agent_name}'s team..."
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Use {'{agent_name}'} to insert your name automatically
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Notification Preferences</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
                    <div>
                      <p className="font-medium text-slate-900">Hot Lead Alerts</p>
                      <p className="text-sm text-slate-600">Get notified when AI identifies a hot lead</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.notify_hot_leads}
                        onChange={(e) =>
                          setSettings({ ...settings, notify_hot_leads: e.target.checked })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
                    <div>
                      <p className="font-medium text-slate-900">Daily Summary</p>
                      <p className="text-sm text-slate-600">Receive a daily summary of your leads</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.notify_daily_summary}
                        onChange={(e) =>
                          setSettings({ ...settings, notify_daily_summary: e.target.checked })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
                    <div>
                      <p className="font-medium text-slate-900">Send post-call follow-up emails</p>
                      <p className="text-sm text-slate-600">
                        Automatically email leads after a VAPI call ends (requires Resend API key)
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.notify_post_call_email}
                        onChange={(e) =>
                          setSettings({ ...settings, notify_post_call_email: e.target.checked })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Notification Email
                    </label>
                    <input
                      type="email"
                      value={settings.notification_email}
                      onChange={(e) =>
                        setSettings({ ...settings, notification_email: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Notification Phone (for SMS)
                    </label>
                    <input
                      type="tel"
                      value={settings.notification_phone}
                      onChange={(e) =>
                        setSettings({ ...settings, notification_phone: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'phone' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Phone Number</h2>
                <p className="text-sm text-slate-600 mb-6">
                  This is the number your AI assistant uses to call leads.
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-blue-900 font-mono text-lg">+1 (754) XXX-XXXX</p>
                  <p className="text-sm text-blue-700 mt-2">
                    Your VAPI phone number is configured and ready to use.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Save Button */}
          {(activeTab === 'voice' || activeTab === 'notifications') && (
            <div className="mt-6 flex items-center gap-4">
              <button
                onClick={saveSettings}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
              {saved && (
                <span className="text-green-600 text-sm font-medium">✓ Settings saved!</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}








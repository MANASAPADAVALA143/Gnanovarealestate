import { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

export type ConsentContext = 'lead' | 'demo' | 'openhouse'

export const CONSENT_TEXT: Record<ConsentContext, string> = {
  lead: `I agree to be contacted by a Gnanova AI voice agent and human agents about my property enquiry. My name, phone number, and preferences will be stored and may be shared with VAPI (call processing) and Twilio (WhatsApp). I have read the Privacy Policy and consent to my data being processed.`,
  demo: `I agree that my name, email, and company details will be used to schedule and follow up on this demo. I have read the Privacy Policy and consent to my data being processed by Gnanova Pro.`,
  openhouse: `I consent to Gnanova collecting my contact information for post-event follow-up via WhatsApp, SMS, or phone call. I have read the Privacy Policy.`,
}

export interface ConsentRecord {
  lead_id?: string
  email?: string
  phone?: string
  context: ConsentContext
}

export async function logConsentToDb(
  supabaseClient: SupabaseClient | null | undefined,
  record: ConsentRecord
): Promise<void> {
  if (!supabaseClient) return
  try {
    const { error } = await supabaseClient.from('consent_log').insert({
      ...record,
      consented_at: new Date().toISOString(),
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    })
    if (error) console.warn('Consent log failed (non-blocking):', error.message)
  } catch (err) {
    console.warn('Consent log failed (non-blocking):', err)
  }
}

export function useConsentGate(supabaseClient?: SupabaseClient | null) {
  const [consentGiven, setConsentGiven] = useState(false)
  const [showConsentError, setShowConsentError] = useState(false)

  function checkConsent(): boolean {
    if (!consentGiven) {
      setShowConsentError(true)
      return false
    }
    return true
  }

  async function logConsent(record: ConsentRecord): Promise<void> {
    await logConsentToDb(supabaseClient, record)
  }

  return {
    consentGiven,
    setConsentGiven,
    showConsentError,
    checkConsent,
    logConsent,
  }
}

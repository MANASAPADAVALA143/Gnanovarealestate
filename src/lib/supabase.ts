import { createClient } from '@supabase/supabase-js'

// Support both Vite (import.meta.env) and Node.js (process.env) contexts
const getEnvVar = (key: string): string | undefined => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[key]
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key]
  }
  return undefined
}

// Lazy initialization - don't create client at import time!
let supabaseClient: ReturnType<typeof createClient> | null = null
let initAttempted = false

function initSupabase() {
  if (initAttempted) return supabaseClient
  initAttempted = true

  const supabaseUrl = getEnvVar('VITE_SUPABASE_URL') || getEnvVar('SUPABASE_URL') || ''
  const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY') || getEnvVar('SUPABASE_ANON_KEY') || ''

  if (supabaseUrl && supabaseAnonKey && 
      supabaseUrl !== 'your-supabase-url' && 
      supabaseAnonKey !== 'your-supabase-anon-key') {
    try {
      supabaseClient = createClient(supabaseUrl, supabaseAnonKey)
      console.log('✅ Supabase client initialized successfully')
    } catch (error: any) {
      console.error('❌ Supabase client failed to initialize:', error.message)
    }
  }

  return supabaseClient
}

let warnedOffline = false

/** Lets the Vite app render when .env is missing; auth stays logged-out until keys are set. */
function offlineSupabaseStub(): ReturnType<typeof createClient> {
  if (!warnedOffline && typeof console !== 'undefined') {
    warnedOffline = true
    console.warn(
      '[Gnanova] Supabase URL/anon key not set — running in offline UI mode. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env then restart npm run dev.'
    )
  }

  const notConfigured = { message: 'Supabase is not configured', code: 'not_configured' as const }

  const stubAuth = {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: (callback: (event: string, session: unknown) => void) => {
      queueMicrotask(() => callback('INITIAL_SESSION', null))
      return { data: { subscription: { unsubscribe: () => {} } } }
    },
    signInWithPassword: async () => ({
      data: { user: null, session: null },
      error: notConfigured,
    }),
    signUp: async () => ({
      data: { user: null, session: null },
      error: notConfigured,
    }),
    signOut: async () => ({ error: null }),
  }

  const stubFrom = () => ({
    select: () => ({
      eq: () => ({
        single: async () => ({ data: null, error: notConfigured }),
      }),
    }),
    insert: async () => ({ data: null, error: notConfigured }),
  })

  return new Proxy({} as ReturnType<typeof createClient>, {
    get(_target, prop) {
      if (prop === 'auth') return stubAuth as unknown
      if (prop === 'from') return stubFrom as unknown
      return undefined
    },
  }) as ReturnType<typeof createClient>
}

// Export a proxy that initializes on first use (or falls back to an offline stub)
export const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get(_target, prop) {
    const client = initSupabase()
    if (!client) {
      const stub = offlineSupabaseStub()
      return (stub as unknown as Record<string | symbol, unknown>)[prop]
    }
    const value = (client as Record<string | symbol, unknown>)[prop]
    return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(client) : value
  },
})

// Types for our database
export type Agent = {
  id: string
  full_name: string
  email: string
  phone: string | null
  company_name: string | null
  location: string | null
  subscription_tier: string
  subscription_status: string
  created_at: string
}

/** Call log row (Vapi webhook + inbound paths; column set may vary by insert path) */
export type Call = {
  id: string
  created_at: string
  /** When the dial started (if set); otherwise UI falls back to created_at */
  started_at?: string | null
  agent_id: string | null
  lead_id?: string | null
  /** Denormalized or portal source on the call row when present */
  source?: string | null
  duration_seconds?: number | null
  lead_name: string | null
  lead_phone: string | null
  lead_email: string | null
  lead_source: string | null
  ai_score: number | null
  lead_status: string | null
  budget_min: number | null
  budget_max: number | null
  timeline: string | null
  pre_approved: boolean | null
  appointment_booked: boolean
  recording_url: string | null
  transcript: string | null
  ai_summary: string | null
  call_duration?: number | null
  call_status?: string | null
  vapi_call_id?: string | null
  call_type?: string | null
  location_preference?: string[] | null
  property_type?: string[] | string | null
  bedrooms_min?: number | null
  bedrooms_max?: number | null
  first_time_buyer?: boolean | null
  working_with_other_agent?: boolean | null
  appointment_date?: string | null
  /** Inbound path may use legacy columns */
  duration?: number | null
  outcome?: string | null
  status?: string | null
  call_outcome?: string | null
  response_time_seconds?: number | null
}

export type BookingRow = {
  id: string
  property_id: string
  lead_id: string | null
  scheduled_date: string
  scheduled_time: string
  status: string
  notes: string | null
  agent_id?: string | null
  agents?: { id?: string; full_name: string | null } | null
  event_type?: string | null
  cal_com_uid?: string | null
  call_id?: string | null
  lead_display_name?: string | null
  lead_display_phone?: string | null
  no_show_follow_up_at?: string | null
  updated_at?: string | null
  properties?: {
    id?: string
    address: string | null
    city: string | null
    state: string | null
    zip_code?: string | null
    agent_id?: string | null
  } | null
  leads?: { id?: string; name: string | null; phone: string | null; email: string | null } | null
}


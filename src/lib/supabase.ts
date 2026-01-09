import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file')
}

if (supabaseUrl === 'your-supabase-url' || supabaseAnonKey === 'your-supabase-anon-key') {
  throw new Error('Please replace the placeholder values in your .env file with your actual Supabase credentials')
}

if (!supabaseUrl.startsWith('http://') && !supabaseUrl.startsWith('https://')) {
  throw new Error(`Invalid Supabase URL format. Expected HTTP/HTTPS URL, got: ${supabaseUrl}`)
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

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

export type Call = {
  id: string
  created_at: string
  agent_id: string
  lead_name: string | null
  lead_phone: string
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
}


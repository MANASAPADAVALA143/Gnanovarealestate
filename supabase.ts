import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Lead {
  id: string;
  name: string;
  email?: string;
  phone: string;
  location?: string;
  budget?: string;
  property_type?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Call {
  id: string;
  lead_id: string;
  status: 'active' | 'ringing' | 'completed' | 'failed' | 'no_answer' | 'queued';
  outcome?: 'scheduled' | 'not_interested' | 'callback' | 'no_answer';
  duration: number;
  transcript: string;
  recording_url?: string;
  started_at?: string;
  ended_at?: string;
  created_at: string;
}

export interface CallSettings {
  id: string;
  user_id: string;
  vapi_api_key: string;
  phone_number: string;
  ai_assistant_id: string;
  created_at: string;
  updated_at: string;
}

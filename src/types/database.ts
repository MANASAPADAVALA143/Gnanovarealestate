/**
 * Supabase `Database` shape for typed clients (`createClient<Database>(...)`).
 * Extend here when migrations add tables or columns.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      leads: {
        Row: {
          id: string
          name: string
          email: string | null
          phone: string
          location: string | null
          status: string
          source: string | null
          ghl_contact_id: string | null
          timeline: string | null
          agent_id: string | null
          property_id: string | null
          created_at: string
          updated_at: string
          lead_score: number | null
          score_label: string | null
          call_transcript: string | null
          sentiment: string | null
          last_outbound_at: string | null
          outbound_attempt_count: number | null
          manual_call_done: boolean | null
          manual_called_at: string | null
          budget_mentioned: string | null
          follow_up_action: string | null
          interested_in: string | null
        }
        Insert: {
          id?: string
          name: string
          email?: string | null
          phone: string
          location?: string | null
          status?: string
          source?: string | null
          ghl_contact_id?: string | null
          timeline?: string | null
          agent_id?: string | null
          property_id?: string | null
          created_at?: string
          updated_at?: string
          lead_score?: number | null
          score_label?: string | null
          call_transcript?: string | null
          sentiment?: string | null
          last_outbound_at?: string | null
          outbound_attempt_count?: number | null
          manual_call_done?: boolean | null
          manual_called_at?: string | null
          budget_mentioned?: string | null
          follow_up_action?: string | null
          interested_in?: string | null
        }
        Update: {
          id?: string
          name?: string
          email?: string | null
          phone?: string
          location?: string | null
          status?: string
          source?: string | null
          ghl_contact_id?: string | null
          timeline?: string | null
          agent_id?: string | null
          property_id?: string | null
          created_at?: string
          updated_at?: string
          lead_score?: number | null
          score_label?: string | null
          call_transcript?: string | null
          sentiment?: string | null
          last_outbound_at?: string | null
          outbound_attempt_count?: number | null
          manual_call_done?: boolean | null
          manual_called_at?: string | null
          budget_mentioned?: string | null
          follow_up_action?: string | null
          interested_in?: string | null
        }
        Relationships: []
      }
      outbound_campaigns: {
        Row: {
          id: string
          name: string
          description: string | null
          status: string | null
          lead_filter_status: string[] | null
          leads_count: number | null
          total_leads: number | null
          calls_made: number | null
          calls_completed: number | null
          calls_connected: number | null
          calls_failed: number | null
          agent_id: string | null
          created_at: string | null
          updated_at: string | null
          started_at: string | null
          completed_at: string | null
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          status?: string | null
          lead_filter_status?: string[] | null
          leads_count?: number | null
          total_leads?: number | null
          calls_made?: number | null
          calls_completed?: number | null
          calls_connected?: number | null
          calls_failed?: number | null
          agent_id?: string | null
          created_at?: string | null
          updated_at?: string | null
          started_at?: string | null
          completed_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          status?: string | null
          lead_filter_status?: string[] | null
          leads_count?: number | null
          total_leads?: number | null
          calls_made?: number | null
          calls_completed?: number | null
          calls_connected?: number | null
          calls_failed?: number | null
          agent_id?: string | null
          created_at?: string | null
          updated_at?: string | null
          started_at?: string | null
          completed_at?: string | null
        }
        Relationships: []
      }
      campaign_leads: {
        Row: {
          id: string
          campaign_id: string
          lead_id: string
          status: string | null
          call_id: string | null
          vapi_call_id: string | null
          called_at: string | null
          result: string | null
          duration_seconds: number | null
          lead_score: number | null
          score_label: string | null
          transcript: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          campaign_id: string
          lead_id: string
          status?: string | null
          call_id?: string | null
          vapi_call_id?: string | null
          called_at?: string | null
          result?: string | null
          duration_seconds?: number | null
          lead_score?: number | null
          score_label?: string | null
          transcript?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          campaign_id?: string
          lead_id?: string
          status?: string | null
          call_id?: string | null
          vapi_call_id?: string | null
          called_at?: string | null
          result?: string | null
          duration_seconds?: number | null
          lead_score?: number | null
          score_label?: string | null
          transcript?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']

/**
 * Outbound Campaign System
 * 
 * Allows agents to create campaigns to call old/cold leads
 * - Create campaign
 * - Add leads to campaign
 * - Start campaign (calls all leads)
 * - Track progress
 * - Get campaign results
 */

import { supabase } from '../lib/supabase'
import { initiateCall } from './initiate-call'

export interface Campaign {
  id: string
  name: string
  description?: string
  status: 'draft' | 'active' | 'paused' | 'completed'
  lead_filter_status: string[]
  leads_count: number
  calls_made: number
  calls_completed: number
  calls_failed: number
  agent_id?: string
  created_at: string
  updated_at: string
  started_at?: string
  completed_at?: string
}

export interface CampaignLead {
  id: string
  campaign_id: string
  lead_id: string
  status: 'pending' | 'calling' | 'completed' | 'failed' | 'skipped'
  call_id?: string
  called_at?: string
  result?: string
  created_at: string
  updated_at: string
}

/**
 * Create a new outbound campaign
 */
export async function createCampaign(data: {
  name: string
  description?: string
  leadFilterStatus: string[]
  agentId?: string
}): Promise<{ success: boolean; campaign?: Campaign; error?: string }> {
  try {
    console.log('📋 Creating new campaign:', data.name)

    // Count leads that match the filter
    let query = supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })

    if (data.leadFilterStatus.length > 0) {
      query = query.in('status', data.leadFilterStatus)
    }

    const { count } = await query

    // Create campaign
    const { data: campaign, error } = await supabase
      .from('outbound_campaigns')
      .insert({
        name: data.name,
        description: data.description || null,
        status: 'draft',
        lead_filter_status: data.leadFilterStatus,
        leads_count: count || 0,
        agent_id: data.agentId || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }

    console.log('✅ Campaign created:', campaign.id)

    return { success: true, campaign }
  } catch (error: any) {
    console.error('❌ Error creating campaign:', error.message)
    return { success: false, error: error.message }
  }
}

/**
 * Add leads to campaign based on filter
 */
export async function addLeadsToCampaign(
  campaignId: string
): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    console.log('➕ Adding leads to campaign:', campaignId)

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from('outbound_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaign) {
      throw new Error('Campaign not found')
    }

    // Get leads based on filter
    let query = supabase.from('leads').select('id, name, phone, status')

    if (campaign.lead_filter_status.length > 0) {
      query = query.in('status', campaign.lead_filter_status)
    }

    const { data: leads, error: leadsError } = await query

    if (leadsError) {
      throw new Error(`Error fetching leads: ${leadsError.message}`)
    }

    if (!leads || leads.length === 0) {
      throw new Error('No leads found matching the filter')
    }

    // Add leads to campaign_leads table
    const campaignLeads = leads.map(lead => ({
      campaign_id: campaignId,
      lead_id: lead.id,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }))

    const { error: insertError } = await supabase
      .from('campaign_leads')
      .insert(campaignLeads)

    if (insertError) {
      // Handle duplicate entries gracefully
      if (insertError.code === '23505') {
        console.log('⚠️ Some leads already in campaign')
      } else {
        throw new Error(`Error adding leads: ${insertError.message}`)
      }
    }

    // Update campaign leads count
    await supabase
      .from('outbound_campaigns')
      .update({
        leads_count: leads.length,
        updated_at: new Date().toISOString(),
      })
      .eq('id', campaignId)

    console.log(`✅ Added ${leads.length} leads to campaign`)

    return { success: true, count: leads.length }
  } catch (error: any) {
    console.error('❌ Error adding leads to campaign:', error.message)
    return { success: false, error: error.message }
  }
}

/**
 * Start campaign - begin calling all leads
 */
export async function startCampaign(
  campaignId: string,
  agentId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('🚀 Starting campaign:', campaignId)

    // Update campaign status
    const { error: updateError } = await supabase
      .from('outbound_campaigns')
      .update({
        status: 'active',
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', campaignId)

    if (updateError) {
      throw new Error(`Error updating campaign: ${updateError.message}`)
    }

    // Get pending leads from campaign
    const { data: campaignLeads, error: leadsError } = await supabase
      .from('campaign_leads')
      .select(`
        id,
        lead_id,
        leads (
          id,
          name,
          phone,
          email,
          location,
          timeline
        )
      `)
      .eq('campaign_id', campaignId)
      .eq('status', 'pending')

    if (leadsError) {
      throw new Error(`Error fetching campaign leads: ${leadsError.message}`)
    }

    if (!campaignLeads || campaignLeads.length === 0) {
      throw new Error('No pending leads in campaign')
    }

    console.log(`📞 Calling ${campaignLeads.length} leads...`)

    // Start calling leads (async process)
    processcampaignCalls(campaignId, campaignLeads, agentId)

    return { success: true }
  } catch (error: any) {
    console.error('❌ Error starting campaign:', error.message)
    return { success: false, error: error.message }
  }
}

/**
 * Process campaign calls (async)
 * Calls all leads in the campaign one by one
 */
async function processcampaignCalls(
  campaignId: string,
  campaignLeads: any[],
  agentId?: string
): Promise<void> {
  for (const campaignLead of campaignLeads) {
    const lead = campaignLead.leads

    if (!lead || !lead.phone) {
      console.warn(`⚠️ Skipping lead ${campaignLead.lead_id} - no phone number`)
      
      // Mark as skipped
      await supabase
        .from('campaign_leads')
        .update({
          status: 'skipped',
          result: 'no_phone',
          updated_at: new Date().toISOString(),
        })
        .eq('id', campaignLead.id)
      
      continue
    }

    try {
      // Update status to calling
      await supabase
        .from('campaign_leads')
        .update({
          status: 'calling',
          called_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', campaignLead.id)

      console.log(`📞 Calling lead: ${lead.name} (${lead.phone})`)

      // Initiate VAPI call
      const callResult = await initiateCall(
        lead.phone,
        lead.name,
        agentId || 'system',
        'outbound_campaign'
      )

      // Create call record
      const { data: callRecord, error: callError } = await supabase
        .from('calls')
        .insert({
          lead_id: lead.id,
          campaign_id: campaignId,
          call_type: 'outbound',
          status: 'queued',
          vapi_call_id: callResult.callId,
          created_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (callError) {
        throw new Error(`Failed to create call record: ${callError.message}`)
      }

      // Update campaign lead with call ID
      await supabase
        .from('campaign_leads')
        .update({
          status: 'completed',
          call_id: callRecord.id,
          result: 'called',
          updated_at: new Date().toISOString(),
        })
        .eq('id', campaignLead.id)

      console.log(`✅ Call initiated for: ${lead.name}`)

      // Add delay between calls (2 seconds)
      await new Promise(resolve => setTimeout(resolve, 2000))
    } catch (error: any) {
      console.error(`❌ Error calling lead ${lead.name}:`, error.message)

      // Mark as failed
      await supabase
        .from('campaign_leads')
        .update({
          status: 'failed',
          result: error.message,
          updated_at: new Date().toISOString(),
        })
        .eq('id', campaignLead.id)
    }
  }

  // Mark campaign as completed
  await supabase
    .from('outbound_campaigns')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaignId)

  console.log('✅ Campaign completed:', campaignId)
}

/**
 * Pause campaign
 */
export async function pauseCampaign(
  campaignId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('outbound_campaigns')
      .update({
        status: 'paused',
        updated_at: new Date().toISOString(),
      })
      .eq('id', campaignId)

    if (error) throw error

    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Get campaign details with progress
 */
export async function getCampaignDetails(
  campaignId: string
): Promise<{ success: boolean; campaign?: any; error?: string }> {
  try {
    const { data: campaign, error: campaignError } = await supabase
      .from('outbound_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()

    if (campaignError) throw campaignError

    // Get progress using the database function
    const { data: progress } = await supabase
      .rpc('get_campaign_progress', { campaign_uuid: campaignId })

    return {
      success: true,
      campaign: {
        ...campaign,
        progress: progress?.[0] || null,
      },
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Get all campaigns
 */
export async function getAllCampaigns(agentId?: string): Promise<{
  success: boolean
  campaigns?: Campaign[]
  error?: string
}> {
  try {
    let query = supabase
      .from('outbound_campaigns')
      .select('*')
      .order('created_at', { ascending: false })

    if (agentId) {
      query = query.eq('agent_id', agentId)
    }

    const { data, error } = await query

    if (error) throw error

    return { success: true, campaigns: data }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

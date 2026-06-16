import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export type CrmOnLeadCreatedParams = {
  leadId: string
  agentId?: string | null
  source: string
  channel?: string
  consentText?: string
  optedIn?: boolean
  ipAddress?: string | null
  status?: string | null
}

const DEFAULT_CONSENT_TEXT =
  'By submitting this form, you consent to be contacted by phone, SMS, WhatsApp, and email regarding real estate services.'

function getServiceSupabase(): SupabaseClient | null {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

/** Record consent, initial activity, and optional follow-up task for a new lead. */
export async function onLeadCreated(
  supabaseOrParams: SupabaseClient | CrmOnLeadCreatedParams,
  maybeParams?: CrmOnLeadCreatedParams
): Promise<void> {
  const supabase =
    maybeParams != null ? (supabaseOrParams as SupabaseClient) : getServiceSupabase()
  const params = (maybeParams ?? supabaseOrParams) as CrmOnLeadCreatedParams

  if (!supabase) {
    console.warn('[crm] No Supabase client for onLeadCreated')
    return
  }

  const {
    leadId,
    agentId,
    source,
    channel = source,
    consentText = DEFAULT_CONSENT_TEXT,
    optedIn = true,
    ipAddress = null,
    status,
  } = params

  const { data: existingConsent } = await supabase
    .from('lead_consent')
    .select('id')
    .eq('lead_id', leadId)
    .limit(1)
    .maybeSingle()

  if (!existingConsent) {
    try {
      await supabase.from('lead_consent').insert({
        lead_id: leadId,
        source,
        channel,
        consent_text: consentText,
        opted_in: optedIn,
        ip_address: ipAddress,
      } as never)
    } catch (e) {
      console.error('[crm] consent insert failed:', e)
    }

    try {
      await supabase.from('lead_activities').insert({
        lead_id: leadId,
        type: 'note',
        content: `Lead captured via ${source}`,
      } as never)
    } catch (e) {
      console.error('[crm] initial activity insert failed:', e)
    }
  }

  const shouldCreateFollowUp =
    status === 'no_response' || status === 'new' || status == null || status === ''

  if (shouldCreateFollowUp && agentId) {
    const { data: existingTask } = await supabase
      .from('lead_tasks')
      .select('id')
      .eq('lead_id', leadId)
      .eq('type', 'follow_up_24h')
      .eq('status', 'pending')
      .limit(1)
      .maybeSingle()

    if (!existingTask) {
      const dueAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      try {
        await supabase.from('lead_tasks').insert({
          lead_id: leadId,
          agent_id: agentId,
          due_at: dueAt,
          type: 'follow_up_24h',
          status: 'pending',
        } as never)
      } catch (e) {
        console.error('[crm] follow-up task insert failed:', e)
      }
    }
  }
}

export async function recordLeadActivity(
  supabase: SupabaseClient,
  params: {
    leadId: string
    type: string
    content: string
    createdBy?: string | null
  }
): Promise<void> {
  try {
    await supabase.from('lead_activities').insert({
      lead_id: params.leadId,
      type: params.type,
      content: params.content,
      created_by: params.createdBy ?? null,
    } as never)
  } catch (e) {
    console.error('[crm] activity insert failed:', e)
  }
}

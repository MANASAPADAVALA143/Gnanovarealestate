import type { SupabaseClient } from '@supabase/supabase-js'
import {
  sendWhatsAppDocument,
  sendWhatsAppOutbound,
  sendWhatsAppTemplate,
} from '../server/lib/whatsapp-inbox.ts'
import { startBolnaCall } from './bolna'
import { normalizePhone } from './bulk-import-helpers'
import { recordLeadActivity } from './crm-hooks'
import { toE164 } from './phone-e164'
import { getWorkspaceById, type ResolvedWorkspace } from './workspace-server'

export type AutomationLead = {
  id: string
  name: string
  phone: string
  source: string | null
  location: string | null
  custom_fields?: Record<string, unknown> | null
}

export type AutomationStatus = 'done' | 'skipped' | 'failed'

export type AutomationOptions = {
  /** Lead created because they replied with this keyword (e.g. "INFO"): answer it instead of the welcome. */
  replyKeyword?: string
}

export type AutomationOutcome = {
  bolnaCall: AutomationStatus
  whatsappWelcome: AutomationStatus
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

async function runBolnaCall(
  supabase: SupabaseClient,
  workspace: ResolvedWorkspace,
  lead: AutomationLead
): Promise<AutomationStatus> {
  const cfg = workspace.automations.bolnaCall
  if (!cfg) return 'skipped'

  const agentId = process.env[cfg.agentIdEnv]
  if (!agentId || !process.env.BOLNA_API_KEY) {
    await recordLeadActivity(supabase, {
      leadId: lead.id,
      type: 'note',
      content: `${cfg.agentName} call skipped: set BOLNA_API_KEY and ${cfg.agentIdEnv}.`,
    })
    return 'skipped'
  }

  try {
    const custom = lead.custom_fields || {}
    const result = await startBolnaCall({
      agentId,
      phone: lead.phone,
      userData: {
        lead_id: lead.id,
        lead_name: lead.name,
        project: workspace.name,
        source: lead.source,
        city: lead.location,
        investment_budget: typeof custom.investment_budget === 'string' ? custom.investment_budget : null,
        languages: cfg.languages.join(', '),
      },
    })
    await recordLeadActivity(supabase, {
      leadId: lead.id,
      type: 'call',
      content: `${cfg.agentName} (${cfg.languages.join(' + ')}) outbound call queued${
        result.executionId ? ` — Bolna execution ${result.executionId}` : ''
      }`,
    })
    return 'done'
  } catch (e) {
    console.error('[automations] Bolna call failed:', e)
    await recordLeadActivity(supabase, {
      leadId: lead.id,
      type: 'note',
      content: `${cfg.agentName} call failed: ${errorMessage(e)}`,
    })
    return 'failed'
  }
}

async function runWhatsAppWelcome(
  supabase: SupabaseClient,
  workspace: ResolvedWorkspace,
  lead: AutomationLead,
  options: AutomationOptions
): Promise<AutomationStatus> {
  const cfg = workspace.automations.whatsappWelcome
  if (!cfg) return 'skipped'

  const to = toE164(lead.phone)
  try {
    // A keyword reply opens Meta's 24h window, so it can be answered with free text.
    const keywordReply = options.replyKeyword
      ? cfg.keywordReplies[options.replyKeyword.trim().toUpperCase()]
      : undefined
    const text = keywordReply ?? cfg.message
    const template = keywordReply ? undefined : process.env[cfg.templateEnv]
    const welcomeId = template
      ? await sendWhatsAppTemplate(to, template, process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'en')
      : await sendWhatsAppOutbound(to, text)
    if (!welcomeId) {
      await recordLeadActivity(supabase, {
        leadId: lead.id,
        type: 'note',
        content: 'WhatsApp welcome skipped: WHATSAPP_TOKEN is not configured.',
      })
      return 'skipped'
    }

    const brochureUrl = process.env[cfg.brochureUrlEnv]
    const brochureId = brochureUrl
      ? await sendWhatsAppDocument(
          to,
          brochureUrl,
          `${workspace.name.replace(/\s+/g, '-')}-Brochure.pdf`,
          `${workspace.name} brochure`
        )
      : null

    await recordLeadActivity(supabase, {
      leadId: lead.id,
      type: 'whatsapp',
      content: `Auto WhatsApp sent${template ? ` (template ${template})` : ''}: ${text}${
        brochureId ? '\n+ brochure PDF' : ''
      }`,
    })

    if (brochureId && workspace.pipelineStages.includes('brochure_sent')) {
      await supabase
        .from('leads')
        .update({ pipeline_stage: 'brochure_sent', updated_at: new Date().toISOString() })
        .eq('id', lead.id)
        .eq('pipeline_stage', 'new')
    }
    return 'done'
  } catch (e) {
    console.error('[automations] WhatsApp welcome failed:', e)
    await recordLeadActivity(supabase, {
      leadId: lead.id,
      type: 'note',
      content: `WhatsApp welcome failed: ${errorMessage(e)}`,
    })
    return 'failed'
  }
}

/**
 * Workspace "new lead" automations (instant voice call + WhatsApp welcome).
 * Awaited by callers so serverless functions don't freeze before the requests go out.
 */
export async function runNewLeadAutomations(
  supabase: SupabaseClient,
  workspace: ResolvedWorkspace,
  lead: AutomationLead,
  options: AutomationOptions = {}
): Promise<AutomationOutcome> {
  const [bolnaCall, whatsappWelcome] = await Promise.all([
    runBolnaCall(supabase, workspace, lead),
    runWhatsAppWelcome(supabase, workspace, lead, options),
  ])
  return { bolnaCall, whatsappWelcome }
}

/** Answer workspace keywords (e.g. "INFO") sent by a lead on WhatsApp. Returns true when handled. */
export async function handleWorkspaceKeywordReply(
  supabase: SupabaseClient,
  fromPhone: string,
  text: string
): Promise<boolean> {
  const keyword = text.trim().toUpperCase()
  const phone = normalizePhone(fromPhone)
  if (!keyword || !phone) return false

  const { data: lead } = await supabase
    .from('leads')
    .select('id, workspace_id')
    .eq('phone', phone)
    .maybeSingle()
  if (!lead) return false

  const row = lead as { id: string; workspace_id: string | null }
  const workspace = await getWorkspaceById(supabase, row.workspace_id)
  const reply = workspace.automations.whatsappWelcome?.keywordReplies[keyword]
  if (!reply) return false

  await sendWhatsAppOutbound(toE164(fromPhone), reply)
  await recordLeadActivity(supabase, {
    leadId: row.id,
    type: 'whatsapp',
    content: `Lead replied ${keyword}; sent ${workspace.name} details.`,
  })
  return true
}

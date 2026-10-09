import { onLeadCreated } from './crm-hooks'
import { getSupabaseServiceClient } from './supabase-service'
import { handleWorkspaceKeywordReply, runNewLeadAutomations } from './workspace-automations'
import { insertWorkspaceLead, parseLeadInput } from './workspace-leads'
import { getWorkspaceBySlug } from './workspace-server'
import { isWorkspaceSlug } from './workspaces'

export type IntakeResult = { status: number; body: Record<string, unknown> }

/**
 * Create a lead from an external source (webhook, n8n, public landing page) in a workspace,
 * then run that workspace's new-lead automations. Existing phones are never re-messaged or re-called.
 */
export async function intakeWorkspaceLead(
  slug: string,
  body: Record<string, unknown>,
  channel: string
): Promise<IntakeResult> {
  if (!isWorkspaceSlug(slug)) {
    return { status: 400, body: { error: `Unknown workspace "${slug}"` } }
  }
  const supabase = getSupabaseServiceClient()
  const workspace = await getWorkspaceBySlug(supabase, slug)

  const customFields: Record<string, unknown> = {
    ...((body.custom_fields as Record<string, unknown> | undefined) ?? {}),
  }
  for (const field of workspace.leadFields) {
    if (field.customKey && body[field.customKey] != null) customFields[field.customKey] = body[field.customKey]
  }

  const rawSource = String(body.source ?? body.portal ?? '').trim()
  const source = workspace.sourceTags
    ? workspace.sourceTags.find((t) => t.toLowerCase() === rawSource.toLowerCase()) ?? ''
    : rawSource

  const input = parseLeadInput(
    workspace,
    {
      name: body.name ?? body.full_name ?? body.contact_name ?? 'Unknown',
      phone: body.phone ?? body.mobile ?? body.phone_number ?? body.contact,
      email: body.email ?? body.email_address,
      location: body.location ?? body.city ?? body.area,
      source,
      custom_fields: customFields,
    },
    'portal'
  )
  if ('error' in input) return { status: 400, body: { error: input.error } }

  const replyKeyword = typeof body.reply_keyword === 'string' ? body.reply_keyword : undefined

  const result = await insertWorkspaceLead(supabase, workspace, input, null)
  if ('conflict' in result) {
    const keywordAnswered = replyKeyword
      ? await handleWorkspaceKeywordReply(supabase, input.phone, replyKeyword)
      : false
    return {
      status: 200,
      body: { received: true, duplicate: true, leadId: result.conflict.leadId, keywordAnswered },
    }
  }

  await onLeadCreated(supabase, {
    leadId: result.lead.id,
    agentId: null,
    source: input.source,
    channel,
    status: 'new',
  })

  const automations = await runNewLeadAutomations(
    supabase,
    workspace,
    {
      id: result.lead.id,
      name: input.name,
      phone: input.phone,
      source: input.source,
      location: input.location,
      custom_fields: input.custom_fields,
    },
    { replyKeyword }
  )

  return {
    status: 200,
    body: { received: true, leadId: result.lead.id, workspace: workspace.slug, automations },
  }
}

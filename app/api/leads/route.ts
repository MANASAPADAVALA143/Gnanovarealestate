import { NextRequest, NextResponse } from 'next/server'
import { onLeadCreated } from '@/lib/crm-hooks'
import { isAgentAuth, requireAgent } from '@/lib/require-agent'
import { getSupabaseServiceClient } from '@/lib/supabase-service'
import { runNewLeadAutomations } from '@/lib/workspace-automations'
import { insertWorkspaceLead, parseLeadInput } from '@/lib/workspace-leads'
import { getRequestWorkspace } from '@/lib/workspace-server'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAgent(req)
    if (!isAgentAuth(auth)) return auth

    const supabase = getSupabaseServiceClient()
    const workspace = await getRequestWorkspace(supabase, req)

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const input = parseLeadInput(workspace, body)
    if ('error' in input) return NextResponse.json({ error: input.error }, { status: 400 })

    const result = await insertWorkspaceLead(supabase, workspace, input, auth.agentId)
    if ('conflict' in result) {
      return NextResponse.json(
        {
          error: `A lead with this phone already exists in ${result.conflict.workspaceName}`,
          leadId: result.conflict.leadId,
        },
        { status: 409 }
      )
    }

    await onLeadCreated(supabase, {
      leadId: result.lead.id,
      agentId: result.lead.agent_id,
      source: input.source,
      channel: 'dashboard',
      status: 'new',
    })

    const automations = await runNewLeadAutomations(supabase, workspace, {
      id: result.lead.id,
      name: input.name,
      phone: input.phone,
      source: input.source,
      location: input.location,
      custom_fields: input.custom_fields,
    })

    return NextResponse.json({ lead: { id: result.lead.id }, automations }, { status: 201 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Request failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}

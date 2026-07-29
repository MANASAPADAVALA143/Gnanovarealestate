import type { SupabaseClient } from '@supabase/supabase-js'

export async function writeAdminAudit(
  supabase: SupabaseClient,
  input: {
    action: string
    performedBy: string
    targetAgentId: string | null
    oldValue: Record<string, unknown>
    newValue: Record<string, unknown>
  }
): Promise<void> {
  const { error } = await supabase.from('admin_audit_log').insert({
    action: input.action,
    performed_by: input.performedBy,
    target_agent_id: input.targetAgentId,
    old_value: input.oldValue,
    new_value: input.newValue,
  } as never)

  if (error) {
    throw new Error(`admin_audit_log insert failed: ${error.message}`)
  }
}

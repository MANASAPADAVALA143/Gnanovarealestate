import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuth, requireManagerOrOwner } from '../../../../lib/require-admin'
import { getSupabaseServiceClient } from '../../../../lib/supabase-service'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = await requireManagerOrOwner(req)
  if (!isAdminAuth(auth)) return auth

  try {
    const supabase = getSupabaseServiceClient()

    const { data: rows, error } = await supabase
      .from('admin_audit_log')
      .select('id, action, performed_by, target_agent_id, old_value, new_value, created_at')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const ids = new Set<string>()
    for (const r of rows || []) {
      const row = r as { performed_by: string; target_agent_id: string | null }
      ids.add(row.performed_by)
      if (row.target_agent_id) ids.add(row.target_agent_id)
    }

    const nameById = new Map<string, string>()
    if (ids.size) {
      const { data: agents } = await supabase
        .from('agents')
        .select('id, full_name')
        .in('id', Array.from(ids))

      for (const a of agents || []) {
        const row = a as { id: string; full_name: string | null }
        nameById.set(row.id, row.full_name || 'Unknown')
      }
    }

    const entries = (rows || []).map((r) => {
      const row = r as {
        id: string
        action: string
        performed_by: string
        target_agent_id: string | null
        old_value: Record<string, unknown>
        new_value: Record<string, unknown>
        created_at: string
      }
      return {
        id: row.id,
        action: row.action,
        performed_by: row.performed_by,
        performed_by_name: nameById.get(row.performed_by) || 'Unknown',
        target_agent_id: row.target_agent_id,
        target_agent_name: row.target_agent_id
          ? nameById.get(row.target_agent_id) || 'Unknown'
          : null,
        old_value: row.old_value,
        new_value: row.new_value,
        created_at: row.created_at,
      }
    })

    return NextResponse.json({ entries })
  } catch (e) {
    console.error('[admin/audit-log]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Audit log failed' },
      { status: 500 }
    )
  }
}

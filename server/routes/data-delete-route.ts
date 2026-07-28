import { Router, type Request, type Response } from 'express'
import { createClient } from '@supabase/supabase-js'

const router = Router()

function adminClient() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
  }
  return createClient(url, key)
}

/** POST /api/admin/delete-lead-data — UAE PDPL right-to-be-forgotten (managers only) */
router.post('/delete-lead-data', async (req: Request, res: Response) => {
  const { lead_id, request_ref } = req.body as { lead_id?: string; request_ref?: string }

  if (!lead_id) {
    return res.status(400).json({ error: 'lead_id is required' })
  }

  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const token = authHeader.replace('Bearer ', '').trim()

  try {
    const supabaseAdmin = adminClient()

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !authData.user) {
      return res.status(401).json({ error: 'Invalid token' })
    }

    const { data: agent, error: agentError } = await supabaseAdmin
      .from('agents')
      .select('is_manager')
      .eq('id', authData.user.id)
      .single()

    if (agentError || !agent?.is_manager) {
      return res.status(403).json({ error: 'Manager role required' })
    }

    const { data, error } = await supabaseAdmin.rpc('delete_lead_data', {
      p_lead_id: lead_id,
      p_deleted_by: authData.user.id,
      p_request_ref: request_ref ?? null,
    })

    if (error) {
      console.error('[DeleteLead] RPC error:', error)
      return res.status(500).json({ error: 'Deletion failed', details: error.message })
    }

    console.log(`[DeleteLead] Lead ${lead_id} deleted by ${authData.user.email}`)

    return res.json({
      success: true,
      lead_id,
      summary: data,
      message: 'Lead and associated data deleted per UAE PDPL request',
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server error'
    console.error('[DeleteLead]', e)
    return res.status(500).json({ error: msg })
  }
})

export default router

import { Router } from 'express'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  createPaymentPlanMilestoneHandler,
  deletePaymentPlanMilestoneHandler,
  listPaymentPlanHandler,
  listPaymentPlanTeasersHandler,
  updatePaymentPlanMilestoneHandler,
} from '../lib/property-payment-plans-api'

/**
 * Property payment plan milestones.
 * Mounted at /api/properties on webhook-server (alongside existing property routes).
 */
export function createPropertyPaymentPlansRouter(getSupabase: () => SupabaseClient): Router {
  const router = Router()

  router.get('/payment-plan-teasers', async (req, res) => {
    try {
      await listPaymentPlanTeasersHandler(getSupabase(), req, res)
    } catch (e) {
      console.error('[payment-plans] teasers', e)
      res.status(500).json({ error: e instanceof Error ? e.message : 'Internal error' })
    }
  })

  router.get('/:propertyId/payment-plan', async (req, res) => {
    try {
      await listPaymentPlanHandler(getSupabase(), req, res)
    } catch (e) {
      console.error('[payment-plans] list', e)
      res.status(500).json({ error: e instanceof Error ? e.message : 'Internal error' })
    }
  })

  router.post('/:propertyId/payment-plan', async (req, res) => {
    try {
      await createPaymentPlanMilestoneHandler(getSupabase(), req, res)
    } catch (e) {
      console.error('[payment-plans] create', e)
      res.status(500).json({ error: e instanceof Error ? e.message : 'Internal error' })
    }
  })

  router.put('/:propertyId/payment-plan/:id', async (req, res) => {
    try {
      await updatePaymentPlanMilestoneHandler(getSupabase(), req, res)
    } catch (e) {
      console.error('[payment-plans] update', e)
      res.status(500).json({ error: e instanceof Error ? e.message : 'Internal error' })
    }
  })

  router.delete('/:propertyId/payment-plan/:id', async (req, res) => {
    try {
      await deletePaymentPlanMilestoneHandler(getSupabase(), req, res)
    } catch (e) {
      console.error('[payment-plans] delete', e)
      res.status(500).json({ error: e instanceof Error ? e.message : 'Internal error' })
    }
  })

  return router
}

export default createPropertyPaymentPlansRouter

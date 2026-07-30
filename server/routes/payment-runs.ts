import { Router } from 'express'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  createPaymentRunHandler,
  getPaymentRunHandler,
  listOpenInvoicesForPaymentRunHandler,
  listPaymentRunsHandler,
} from '../lib/payment-runs-api'

/**
 * Broker invoice payment runs (bulk mark paid).
 * Mounted at /api/payment-runs on webhook-server.
 */
export function createPaymentRunsRouter(getSupabase: () => SupabaseClient): Router {
  const router = Router()

  router.get('/open-invoices', async (req, res) => {
    try {
      await listOpenInvoicesForPaymentRunHandler(getSupabase(), req, res)
    } catch (e) {
      console.error('[payment-runs] open-invoices', e)
      res.status(500).json({ error: e instanceof Error ? e.message : 'Internal error' })
    }
  })

  router.get('/', async (req, res) => {
    try {
      await listPaymentRunsHandler(getSupabase(), req, res)
    } catch (e) {
      console.error('[payment-runs] list', e)
      res.status(500).json({ error: e instanceof Error ? e.message : 'Internal error' })
    }
  })

  router.get('/:id', async (req, res) => {
    try {
      await getPaymentRunHandler(getSupabase(), req, res)
    } catch (e) {
      console.error('[payment-runs] get', e)
      res.status(500).json({ error: e instanceof Error ? e.message : 'Internal error' })
    }
  })

  router.post('/', async (req, res) => {
    try {
      await createPaymentRunHandler(getSupabase(), req, res)
    } catch (e) {
      console.error('[payment-runs] create', e)
      res.status(500).json({ error: e instanceof Error ? e.message : 'Internal error' })
    }
  })

  return router
}

export default createPaymentRunsRouter

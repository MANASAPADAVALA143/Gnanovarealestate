import { Router } from 'express'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  createAdSpendHandler,
  deleteAdSpendHandler,
  listAdSpendHandler,
  updateAdSpendHandler,
} from '../lib/ad-spend-api'

/**
 * Meta / portal ad spend attribution (manual cost entry).
 * Mounted at /api/ad-spend on webhook-server.
 */
export function createAdSpendRouter(getSupabase: () => SupabaseClient): Router {
  const router = Router()

  router.get('/', async (req, res) => {
    try {
      await listAdSpendHandler(getSupabase(), req, res)
    } catch (e) {
      console.error('[ad-spend] list', e)
      res.status(500).json({ error: e instanceof Error ? e.message : 'Internal error' })
    }
  })

  router.post('/', async (req, res) => {
    try {
      await createAdSpendHandler(getSupabase(), req, res)
    } catch (e) {
      console.error('[ad-spend] create', e)
      res.status(500).json({ error: e instanceof Error ? e.message : 'Internal error' })
    }
  })

  router.put('/:id', async (req, res) => {
    try {
      await updateAdSpendHandler(getSupabase(), req, res)
    } catch (e) {
      console.error('[ad-spend] update', e)
      res.status(500).json({ error: e instanceof Error ? e.message : 'Internal error' })
    }
  })

  router.delete('/:id', async (req, res) => {
    try {
      await deleteAdSpendHandler(getSupabase(), req, res)
    } catch (e) {
      console.error('[ad-spend] delete', e)
      res.status(500).json({ error: e instanceof Error ? e.message : 'Internal error' })
    }
  })

  return router
}

export default createAdSpendRouter

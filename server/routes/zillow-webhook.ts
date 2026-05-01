import { Router, type Request, type Response } from 'express'
import { handlePortalLead, type NormalisedLead } from '../lib/portal-intake'

const router = Router()

router.post('/', async (req: Request, res: Response) => {
  const secret = typeof req.query.secret === 'string' ? req.query.secret : ''
  const expected = process.env.ZILLOW_WEBHOOK_SECRET
  if (!expected || secret !== expected) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const body = req.body as Record<string, unknown>
    const contact = (body.contact as Record<string, unknown> | undefined) || {}

    const first = String(contact.first_name || body.first_name || '').trim()
    const last = String(contact.last_name || body.last_name || '').trim()
    const nameFromParts = [first, last].filter(Boolean).join(' ').trim()
    const name = nameFromParts || String(body.name || 'Unknown').trim() || 'Unknown'

    const lead: NormalisedLead = {
      name,
      email: String(contact.email || body.email || '').trim(),
      phone: String(contact.phone || body.phone || '').trim(),
      message: String(body.message || body.notes || contact.message || '').trim() || undefined,
      location: String(
        (body.area as Record<string, unknown> | undefined)?.city ||
          body.city ||
          contact.city ||
          ''
      ).trim() || undefined,
      property_address: String(
        (body.property as Record<string, unknown> | undefined)?.address ||
          body.listing_address ||
          ''
      ).trim() || undefined,
      portal_source: 'zillow',
      portal_lead_id: String(body.lead_id || body.id || `zillow-${Date.now()}`),
      raw_payload: body,
    }

    const result = await handlePortalLead(lead)
    return res.status(200).json({ ok: true, ...result })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[zillow-webhook]', err)
    return res.status(500).json({ error: message })
  }
})

export default router

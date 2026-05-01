import type { Request, Response } from 'express'
import crypto from 'crypto'
import { handlePortalLead, type NormalisedLead } from '../lib/portal-intake'

function verifyRealtorSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
  const secret = process.env.REALTOR_WEBHOOK_SECRET?.trim()
  if (!secret) {
    return process.env.NODE_ENV !== 'production'
  }
  if (!signatureHeader) return false
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`
  const a = Buffer.from(signatureHeader)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  try {
    return crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export async function realtorPortalHandler(req: Request, res: Response): Promise<void> {
  const sig = (req.headers['x-realtor-signature'] as string | undefined) ?? ''
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body ?? {}))

  if (!verifyRealtorSignature(rawBody, sig)) {
    res.status(401).json({ error: 'Invalid signature' })
    return
  }

  try {
    const body = JSON.parse(rawBody.toString('utf8')) as Record<string, unknown>
    const contact =
      (body.contact as Record<string, unknown> | undefined) ||
      (body.lead as Record<string, unknown> | undefined) ||
      body

    const first = String(contact.first_name || '').trim()
    const last = String(contact.last_name || '').trim()
    const nameFromParts = [first, last].filter(Boolean).join(' ').trim()
    const name = nameFromParts || String(contact.name || body.name || 'Unknown').trim() || 'Unknown'

    const property = (body.property as Record<string, unknown> | undefined) || {}
    const listing = (body.listing as Record<string, unknown> | undefined) || {}

    const lead: NormalisedLead = {
      name,
      email: String(contact.email || '').trim(),
      phone: String(contact.phone || contact.phone_number || body.phone || '').trim(),
      message: String(contact.message || body.inquiry_message || '').trim() || undefined,
      location: String(contact.city || property.city || listing.city || '').trim() || undefined,
      property_address: String(property.address || listing.address || body.listing_address || '').trim() || undefined,
      portal_source: 'realtor',
      portal_lead_id: String(body.lead_id || body.id || `realtor-${Date.now()}`),
      raw_payload: body,
    }

    const result = await handlePortalLead(lead)
    res.status(200).json({ ok: true, ...result })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[realtor-webhook]', err)
    res.status(500).json({ error: message })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { handlePortalLead, type NormalisedLead } from '../../../../server/lib/portal-intake'

export const runtime = 'nodejs'

function verifyRealtorSignature(rawBody: Buffer, signatureHeader: string | null): boolean {
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

export async function POST(req: NextRequest) {
  const rawBody = Buffer.from(await req.arrayBuffer())
  const sig = req.headers.get('x-realtor-signature')

  if (!verifyRealtorSignature(rawBody, sig)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
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
    return NextResponse.json({ ok: true, ...result })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[api/portal/realtor]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

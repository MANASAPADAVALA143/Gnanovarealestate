import { NextRequest, NextResponse } from 'next/server'
import { handlePortalLead, type NormalisedLead } from '../../../../server/lib/portal-intake'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret') || ''
  const expected = process.env.ZILLOW_WEBHOOK_SECRET
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = (await req.json()) as Record<string, unknown>
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
    return NextResponse.json({ ok: true, ...result })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[api/portal/zillow]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { intakeWorkspaceLead } from '@/lib/workspace-intake'

export const runtime = 'nodejs'
export const maxDuration = 60

const GRAPH_URL = 'https://graph.facebook.com/v20.0'

type FieldDatum = { name: string; values?: string[] }

type GraphLead = {
  id: string
  field_data?: FieldDatum[]
  form_id?: string
  ad_name?: string
  campaign_name?: string
  platform?: string
}

function verifySignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.FACEBOOK_APP_SECRET?.trim()
  if (!secret) {
    // Lead details are re-fetched from the Graph API by id, so an unsigned payload cannot inject lead data.
    console.warn('[facebook-leads] FACEBOOK_APP_SECRET not set — skipping signature check')
    return true
  }
  if (!header?.startsWith('sha256=')) return false
  const expected = Buffer.from(crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex'))
  const received = Buffer.from(header.slice('sha256='.length))
  return received.length === expected.length && crypto.timingSafeEqual(received, expected)
}

/** Meta's webhook only carries the leadgen id; the submitted answers must be fetched with a page token. */
async function fetchLead(leadgenId: string, token: string): Promise<GraphLead> {
  const url = new URL(`${GRAPH_URL}/${encodeURIComponent(leadgenId)}`)
  url.searchParams.set('fields', 'field_data,form_id,ad_name,campaign_name,platform')
  url.searchParams.set('access_token', token)
  const res = await fetch(url, { cache: 'no-store' })
  const json = (await res.json().catch(() => ({}))) as GraphLead & { error?: { message?: string } }
  if (!res.ok) throw new Error(json.error?.message || `Graph API ${res.status}`)
  return json
}

function mapFields(fieldData: FieldDatum[]) {
  const out: { name?: string; phone?: string; email?: string; location?: string; villa_size?: string; budget?: string } =
    {}
  for (const f of fieldData) {
    const key = f.name.toLowerCase()
    const value = (f.values?.[0] || '').trim()
    if (!value) continue
    if (key === 'full_name' || key === 'name') out.name = value
    else if (key === 'first_name') out.name = out.name ? `${value} ${out.name}` : value
    else if (key === 'last_name') out.name = out.name ? `${out.name} ${value}` : value
    else if (key === 'phone_number' || key === 'phone') out.phone = value
    else if (key === 'email' || key === 'email_address') out.email = value
    else if (key === 'city' || key === 'location') out.location = value
    else if (/villa|plot|sq|size|looking_for/.test(key)) out.villa_size = value
    else if (key.includes('budget')) out.budget = value
  }
  return out
}

/** One-time subscription check from Meta (App Dashboard → Webhooks → Page → leadgen). */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const expected = process.env.FACEBOOK_VERIFY_TOKEN?.trim()
  if (expected && params.get('hub.mode') === 'subscribe' && params.get('hub.verify_token') === expected) {
    return new NextResponse(params.get('hub.challenge') ?? '', { status: 200 })
  }
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 })
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  if (!verifySignature(rawBody, req.headers.get('x-hub-signature-256'))) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: { entry?: { changes?: { field?: string; value?: Record<string, unknown> }[] }[] }
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN?.trim()
  const workspaceSlug = process.env.FACEBOOK_LEADS_WORKSPACE?.trim() || 'ambhuja-maytri'
  const results: Record<string, unknown>[] = []

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'leadgen' || !change.value) continue
      const leadgenId = String(change.value.leadgen_id ?? '')
      if (!leadgenId) continue

      try {
        if (!token) throw new Error('FACEBOOK_PAGE_ACCESS_TOKEN is not set')
        const lead = await fetchLead(leadgenId, token)
        const fields = mapFields(lead.field_data ?? [])
        const result = await intakeWorkspaceLead(
          workspaceSlug,
          {
            name: fields.name || 'Facebook Lead',
            phone: fields.phone,
            email: fields.email ?? null,
            location: fields.location ?? null,
            source: lead.platform?.toLowerCase() === 'ig' ? 'Instagram' : 'Facebook',
            custom_fields: {
              villa_size: fields.villa_size,
              budget: fields.budget,
              campaign: lead.campaign_name || lead.ad_name || 'Facebook Lead Ad',
            },
          },
          'facebook_lead_ads'
        )
        if (result.status !== 200) console.error('[facebook-leads] intake rejected', leadgenId, result.body)
        results.push({ leadgenId, ...result.body })
      } catch (e) {
        console.error('[facebook-leads] lead', leadgenId, e)
        results.push({ leadgenId, error: e instanceof Error ? e.message : 'intake failed' })
      }
    }
  }

  // Meta keeps retrying non-200 responses and eventually disables the subscription; failures are logged above.
  return NextResponse.json({ received: true, results })
}

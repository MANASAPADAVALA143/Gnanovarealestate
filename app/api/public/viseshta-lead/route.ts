import { NextRequest, NextResponse } from 'next/server'
import { intakeWorkspaceLead } from '@/lib/workspace-intake'
import { WORKSPACES } from '@/lib/workspaces'

export const runtime = 'nodejs'
export const maxDuration = 60

const WINDOW_MS = 10 * 60 * 1000
const MAX_PER_WINDOW = 5
// Best-effort per serverless instance; every accepted submission places a real call + WhatsApp.
const recentByIp = new Map<string, number[]>()

function rateLimited(ip: string): boolean {
  const now = Date.now()
  const hits = (recentByIp.get(ip) || []).filter((t) => now - t < WINDOW_MS)
  hits.push(now)
  recentByIp.set(ip, hits)
  return hits.length > MAX_PER_WINDOW
}

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/** Indian mobile: 10 digits starting 6–9, optionally prefixed with +91 / 91 / 0. */
function indianMobile(raw: string): string | null {
  let d = raw.replace(/\D/g, '')
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2)
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1)
  return /^[6-9]\d{9}$/.test(d) ? d : null
}

export async function POST(req: NextRequest) {
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown'
  if (rateLimited(ip)) {
    return NextResponse.json({ error: 'Too many requests. Please try again in a few minutes.' }, { status: 429 })
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  // Honeypot: hidden field real visitors never fill in.
  if (clean(body.company, 200)) return NextResponse.json({ ok: true })

  const name = clean(body.name, 80)
  const phone = indianMobile(clean(body.phone, 20))
  const email = clean(body.email, 120)
  const city = clean(body.city, 60)

  if (name.length < 2) return NextResponse.json({ error: 'Please enter your full name' }, { status: 400 })
  if (!phone) return NextResponse.json({ error: 'Please enter a valid 10-digit mobile number' }, { status: 400 })
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email' }, { status: 400 })
  }

  const tags = WORKSPACES['viseshta-avenues'].sourceTags ?? []
  const requested = clean(body.source, 40).toLowerCase()
  const source = tags.find((t) => t.toLowerCase() === requested) ?? 'Instagram'

  try {
    const result = await intakeWorkspaceLead(
      'viseshta-avenues',
      {
        name,
        phone,
        email: email || null,
        city: city || null,
        source,
        campaign: clean(body.campaign, 80) || 'Landing page',
      },
      'landing_page'
    )
    if (result.status !== 200) {
      return NextResponse.json({ error: String(result.body.error || 'Could not submit') }, { status: result.status })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[public/viseshta-lead]', e)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}

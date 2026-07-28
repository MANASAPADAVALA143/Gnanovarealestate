import { afterAll, describe, expect, it } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { isAgentAuth, requireAgent } from '../../lib/require-agent'
import { requireVapiSecret } from '../../lib/require-vapi-secret'

function nextReq(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(url, init)
}

describe('Next API auth helpers', () => {
  const saved: Record<string, string | undefined> = {}

  function setEnv(key: string, value: string | undefined) {
    if (!(key in saved)) saved[key] = process.env[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }

  afterAll(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  describe('requireAgent', () => {
    it('returns 401 when Authorization header is missing', async () => {
      const res = await requireAgent(nextReq('http://localhost/api/campaigns'))
      expect(res).toBeInstanceOf(NextResponse)
      expect((res as NextResponse).status).toBe(401)
      expect(isAgentAuth(res)).toBe(false)
    })

    it('returns 401 for invalid Bearer token', async () => {
      setEnv('NEXT_PUBLIC_SUPABASE_URL', process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://example.supabase.co')
      setEnv(
        'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'anon-key'
      )
      const res = await requireAgent(
        nextReq('http://localhost/api/campaigns', {
          headers: { Authorization: 'Bearer not-a-real-jwt' },
        })
      )
      expect(res).toBeInstanceOf(NextResponse)
      expect((res as NextResponse).status).toBe(401)
    })
  })

  describe('requireVapiSecret', () => {
    it('rejects missing signature when secret is configured', async () => {
      setEnv('VAPI_WEBHOOK_SECRET', 'next-vapi-secret')
      setEnv('NODE_ENV', 'test')
      const res = await requireVapiSecret(
        nextReq('http://localhost/api/vapi/outbound-webhook', {
          method: 'POST',
          body: JSON.stringify({ message: { type: 'end-of-call-report' } }),
        })
      )
      expect(res).toBeInstanceOf(NextResponse)
      expect((res as NextResponse).status).toBe(401)
    })

    it('accepts plain shared-secret header', async () => {
      setEnv('VAPI_WEBHOOK_SECRET', 'next-vapi-secret')
      const res = await requireVapiSecret(
        nextReq('http://localhost/api/vapi/outbound-webhook', {
          method: 'POST',
          headers: { 'x-vapi-secret': 'next-vapi-secret' },
          body: JSON.stringify({ ok: true }),
        })
      )
      expect(res).toBe(true)
    })

    it('rejects wrong secret', async () => {
      setEnv('VAPI_WEBHOOK_SECRET', 'next-vapi-secret')
      const res = await requireVapiSecret(
        nextReq('http://localhost/api/vapi/outbound-webhook', {
          method: 'POST',
          headers: { 'x-vapi-secret': 'wrong' },
          body: JSON.stringify({ ok: true }),
        })
      )
      expect(res).toBeInstanceOf(NextResponse)
      expect((res as NextResponse).status).toBe(401)
    })

    it('blocks in production when secret unset', async () => {
      setEnv('VAPI_WEBHOOK_SECRET', undefined)
      setEnv('VAPI_SERVER_SECRET', undefined)
      setEnv('VITE_VAPI_SERVER_SECRET', undefined)
      setEnv('NODE_ENV', 'production')
      const res = await requireVapiSecret(
        nextReq('http://localhost/api/vapi/speed-webhook', {
          method: 'POST',
          body: '{}',
        })
      )
      expect(res).toBeInstanceOf(NextResponse)
      expect((res as NextResponse).status).toBe(500)
      setEnv('NODE_ENV', 'test')
    })
  })
})

describe('Next dashboard live HTTP (optional)', () => {
  const base = process.env.NEXT_APP_URL || 'http://localhost:3002'
  let serverUp = false

  it('probes Next server', async () => {
    try {
      const res = await fetch(`${base}/login`, { signal: AbortSignal.timeout(3000) })
      serverUp = res.status > 0
    } catch {
      serverUp = false
    }
    expect(true).toBe(true)
  })

  it('campaigns GET without Bearer → 401 when server up', async () => {
    if (!serverUp) return
    const res = await fetch(`${base}/api/campaigns`)
    expect(res.status).toBe(401)
  })

  it('vapi outbound without secret → 401 when secret configured and server up', async () => {
    if (!serverUp) return
    if (!process.env.VAPI_WEBHOOK_SECRET && !process.env.VAPI_SERVER_SECRET) return
    const res = await fetch(`${base}/api/vapi/outbound-webhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: { type: 'end-of-call-report' } }),
    })
    expect(res.status).toBe(401)
  })
})

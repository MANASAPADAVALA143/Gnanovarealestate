import crypto from 'crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { NextFunction, Request, Response } from 'express'
import {
  validateFacebookSignature,
  validatePortalSecret,
  validateTwilioSignature,
  validateVapiSignature,
} from '../../server/lib/webhook-validation'

type MockRes = Response & {
  statusCode: number
  body: unknown
  status: (code: number) => MockRes
  json: (payload: unknown) => MockRes
}

function mockRes(): MockRes {
  const res = {
    statusCode: 200,
    body: null as unknown,
    status(code: number) {
      this.statusCode = code
      return this
    },
    json(payload: unknown) {
      this.body = payload
      return this
    },
  }
  return res as MockRes
}

function mockReq(partial: Partial<Request> & { rawBody?: string }): Request {
  return {
    headers: {},
    body: {},
    query: {},
    protocol: 'http',
    originalUrl: '/webhook',
    ...partial,
  } as Request
}

describe('Webhook signature validators (unit)', () => {
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

  describe('validateVapiSignature', () => {
    it('rejects missing signature when secret is configured', () => {
      setEnv('VAPI_WEBHOOK_SECRET', 'test-vapi-secret')
      setEnv('NODE_ENV', 'test')
      const req = mockReq({ headers: {}, body: { message: { type: 'end-of-call-report' } } })
      const res = mockRes()
      let nextCalled = false
      validateVapiSignature(req, res, (() => {
        nextCalled = true
      }) as NextFunction)
      expect(nextCalled).toBe(false)
      expect(res.statusCode).toBe(401)
    })

    it('accepts plain shared-secret header match', () => {
      setEnv('VAPI_WEBHOOK_SECRET', 'test-vapi-secret')
      const req = mockReq({
        headers: { 'x-vapi-secret': 'test-vapi-secret' },
        body: { ok: true },
      })
      const res = mockRes()
      let nextCalled = false
      validateVapiSignature(req, res, (() => {
        nextCalled = true
      }) as NextFunction)
      expect(nextCalled).toBe(true)
      expect(res.statusCode).toBe(200)
    })

    it('accepts valid HMAC-SHA256 signature', () => {
      setEnv('VAPI_WEBHOOK_SECRET', 'hmac-secret')
      const rawBody = JSON.stringify({ event: 'call.ended' })
      const sig = crypto.createHmac('sha256', 'hmac-secret').update(rawBody).digest('hex')
      const req = mockReq({
        headers: { 'x-vapi-signature': sig },
        body: JSON.parse(rawBody),
        rawBody,
      })
      const res = mockRes()
      let nextCalled = false
      validateVapiSignature(req, res, (() => {
        nextCalled = true
      }) as NextFunction)
      expect(nextCalled).toBe(true)
    })

    it('rejects invalid HMAC', () => {
      setEnv('VAPI_WEBHOOK_SECRET', 'hmac-secret')
      const req = mockReq({
        headers: { 'x-vapi-signature': '00'.repeat(32) },
        body: { event: 'call.ended' },
        rawBody: JSON.stringify({ event: 'call.ended' }),
      })
      const res = mockRes()
      let nextCalled = false
      validateVapiSignature(req, res, (() => {
        nextCalled = true
      }) as NextFunction)
      expect(nextCalled).toBe(false)
      expect(res.statusCode).toBe(401)
    })
  })

  describe('validateTwilioSignature', () => {
    it('rejects missing x-twilio-signature when auth token set', () => {
      setEnv('TWILIO_AUTH_TOKEN', 'twilio-token-for-tests')
      setEnv('NODE_ENV', 'test')
      const req = mockReq({
        headers: { host: 'localhost:3001' },
        originalUrl: '/webhook/whatsapp/inbound',
        body: { From: 'whatsapp:+971500000000', Body: 'hi' },
      })
      const res = mockRes()
      let nextCalled = false
      validateTwilioSignature(req, res, (() => {
        nextCalled = true
      }) as NextFunction)
      expect(nextCalled).toBe(false)
      expect(res.statusCode).toBe(401)
    })

    it('rejects invalid Twilio signature', () => {
      setEnv('TWILIO_AUTH_TOKEN', 'twilio-token-for-tests')
      const req = mockReq({
        headers: {
          host: 'localhost:3001',
          'x-twilio-signature': 'invalid-signature-value',
        },
        originalUrl: '/webhook/whatsapp/inbound',
        body: { From: 'whatsapp:+971500000000', Body: 'hi' },
      })
      const res = mockRes()
      let nextCalled = false
      validateTwilioSignature(req, res, (() => {
        nextCalled = true
      }) as NextFunction)
      expect(nextCalled).toBe(false)
      expect(res.statusCode).toBe(403)
    })
  })

  describe('validatePortalSecret', () => {
    it('rejects missing/invalid portal secret', () => {
      setEnv('PORTAL_WEBHOOK_SECRET', 'portal-secret')
      setEnv('NODE_ENV', 'test')
      const req = mockReq({ headers: {} })
      const res = mockRes()
      let nextCalled = false
      validatePortalSecret(req, res, (() => {
        nextCalled = true
      }) as NextFunction)
      expect(nextCalled).toBe(false)
      expect(res.statusCode).toBe(401)
    })

    it('accepts matching x-webhook-secret', () => {
      setEnv('PORTAL_WEBHOOK_SECRET', 'portal-secret')
      const req = mockReq({ headers: { 'x-webhook-secret': 'portal-secret' } })
      const res = mockRes()
      let nextCalled = false
      validatePortalSecret(req, res, (() => {
        nextCalled = true
      }) as NextFunction)
      expect(nextCalled).toBe(true)
    })
  })

  describe('Realtor HMAC (same algorithm as server/routes/realtor-webhook.ts)', () => {
    function verifyRealtorSignature(
      rawBody: Buffer,
      signatureHeader: string | undefined,
      secret: string
    ): boolean {
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

    it('accepts valid sha256 HMAC', () => {
      const body = Buffer.from(JSON.stringify({ name: 'Test Lead', phone: '+971500000001' }))
      const secret = 'realtor-test-secret'
      const sig = `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`
      expect(verifyRealtorSignature(body, sig, secret)).toBe(true)
    })

    it('rejects tampered body / wrong secret', () => {
      const body = Buffer.from(JSON.stringify({ name: 'Test Lead' }))
      const sig = `sha256=${crypto.createHmac('sha256', 'realtor-test-secret').update(body).digest('hex')}`
      expect(
        verifyRealtorSignature(Buffer.from('{"name":"Hacked"}'), sig, 'realtor-test-secret')
      ).toBe(false)
      expect(verifyRealtorSignature(body, sig, 'wrong-secret')).toBe(false)
      expect(verifyRealtorSignature(body, undefined, 'realtor-test-secret')).toBe(false)
    })
  })

  describe('validateFacebookSignature', () => {
    it('rejects missing signature when app secret is configured', () => {
      setEnv('FACEBOOK_APP_SECRET', 'fb-app-secret')
      setEnv('NODE_ENV', 'test')
      const rawBody = JSON.stringify({ entry: [] })
      const req = mockReq({ headers: {}, body: { entry: [] }, rawBody })
      const res = mockRes()
      let nextCalled = false
      validateFacebookSignature(req, res, (() => {
        nextCalled = true
      }) as NextFunction)
      expect(nextCalled).toBe(false)
      expect(res.statusCode).toBe(401)
    })

    it('accepts valid X-Hub-Signature-256', () => {
      setEnv('FACEBOOK_APP_SECRET', 'fb-app-secret')
      const rawBody = JSON.stringify({ entry: [{ id: '1' }] })
      const sig = `sha256=${crypto.createHmac('sha256', 'fb-app-secret').update(rawBody).digest('hex')}`
      const req = mockReq({
        headers: { 'x-hub-signature-256': sig },
        body: JSON.parse(rawBody),
        rawBody,
      })
      const res = mockRes()
      let nextCalled = false
      validateFacebookSignature(req, res, (() => {
        nextCalled = true
      }) as NextFunction)
      expect(nextCalled).toBe(true)
    })

    it('rejects invalid X-Hub-Signature-256', () => {
      setEnv('FACEBOOK_APP_SECRET', 'fb-app-secret')
      const rawBody = JSON.stringify({ entry: [{ id: '1' }] })
      const req = mockReq({
        headers: { 'x-hub-signature-256': 'sha256=deadbeef' },
        body: JSON.parse(rawBody),
        rawBody,
      })
      const res = mockRes()
      let nextCalled = false
      validateFacebookSignature(req, res, (() => {
        nextCalled = true
      }) as NextFunction)
      expect(nextCalled).toBe(false)
      expect(res.statusCode).toBe(401)
    })

    it('accepts valid legacy X-Hub-Signature (sha1)', () => {
      setEnv('FACEBOOK_APP_SECRET', 'fb-app-secret')
      const rawBody = JSON.stringify({ entry: [{ id: '1' }] })
      const sig = `sha1=${crypto.createHmac('sha1', 'fb-app-secret').update(rawBody).digest('hex')}`
      const req = mockReq({
        headers: { 'x-hub-signature': sig },
        body: JSON.parse(rawBody),
        rawBody,
      })
      const res = mockRes()
      let nextCalled = false
      validateFacebookSignature(req, res, (() => {
        nextCalled = true
      }) as NextFunction)
      expect(nextCalled).toBe(true)
    })
  })
})

/**
 * Live HTTP checks against Express webhook-server (default :3001).
 * Skipped when server is down or required secrets are unset.
 */
describe('Webhook HTTP (Express :3001)', () => {
  const base =
    process.env.WEBHOOK_BASE_URL?.replace(/\/$/, '') ||
    process.env.VITE_WEBHOOK_URL?.replace(/\/$/, '') ||
    'http://localhost:3001'

  let serverUp = false

  beforeAll(async () => {
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 2000)
      await fetch(`${base}/api/vapi-webhook`, {
        method: 'OPTIONS',
        signal: ctrl.signal,
      }).catch(async () => {
        // Any response (incl. 404/401/405) means something is listening
        const r = await fetch(base, { signal: AbortSignal.timeout(2000) }).catch(() => null)
        serverUp = Boolean(r)
      })
      clearTimeout(t)
      if (!serverUp) {
        const r = await fetch(`${base}/api/portal/zillow`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
          signal: AbortSignal.timeout(2000),
        }).catch(() => null)
        serverUp = Boolean(r)
      }
    } catch {
      serverUp = false
    }
  }, 10_000)

  it.skipIf(!process.env.ZILLOW_WEBHOOK_SECRET)(
    'Zillow: missing secret → 401',
    async () => {
      if (!serverUp) return
      const res = await fetch(`${base}/api/portal/zillow`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'No Secret', phone: '+971500000099' }),
      })
      expect(res.status).toBe(401)
    }
  )

  it('Zillow: wrong secret → 401', async () => {
    if (!serverUp) return
    const res = await fetch(`${base}/api/portal/zillow?secret=wrong-secret`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Bad Secret', phone: '+971500000098' }),
    })
    expect(res.status).toBe(401)
  })

  it.runIf(Boolean(process.env.ZILLOW_WEBHOOK_SECRET))(
    'Zillow: valid secret + payload → 200 (or handled error, not 401)',
    async () => {
      if (!serverUp) return
      const secret = process.env.ZILLOW_WEBHOOK_SECRET!
      const phone = `+9715${String(Date.now()).slice(-8)}`
      const res = await fetch(`${base}/api/portal/zillow?secret=${encodeURIComponent(secret)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'RLS Webhook Zillow',
          phone,
          email: 'zillow-webhook@gnanova.test',
          lead_id: `zillow-test-${Date.now()}`,
        }),
      })
      expect(res.status).not.toBe(401)
      expect([200, 500]).toContain(res.status)
    }
  )

  it('Realtor: missing signature → 401', async () => {
    if (!serverUp) return
    const res = await fetch(`${base}/api/portal/realtor`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'No Sig', phone: '+971500000097' }),
    })
    // In production with secret: 401. In dev with no REALTOR_WEBHOOK_SECRET: may process.
    if (process.env.REALTOR_WEBHOOK_SECRET) {
      expect(res.status).toBe(401)
    } else {
      expect([200, 401, 500]).toContain(res.status)
    }
  })

  it.runIf(Boolean(process.env.REALTOR_WEBHOOK_SECRET))(
    'Realtor: valid HMAC → not 401',
    async () => {
      if (!serverUp) return
      const secret = process.env.REALTOR_WEBHOOK_SECRET!
      const body = JSON.stringify({
        name: 'Realtor Webhook Test',
        phone: `+9715${String(Date.now()).slice(-8)}`,
        lead_id: `realtor-test-${Date.now()}`,
      })
      const sig = `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`
      const res = await fetch(`${base}/api/portal/realtor`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-realtor-signature': sig,
        },
        body,
      })
      expect(res.status).not.toBe(401)
    }
  )

  it('VAPI: missing signature → 401 when secret configured', async () => {
    if (!serverUp) return
    const secret =
      process.env.VAPI_WEBHOOK_SECRET ||
      process.env.VAPI_SERVER_SECRET ||
      process.env.VITE_VAPI_SERVER_SECRET
    if (!secret) return
    const res = await fetch(`${base}/api/vapi-webhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: { type: 'end-of-call-report' } }),
    })
    expect(res.status).toBe(401)
  })

  it('VAPI: invalid signature → 401 when secret configured', async () => {
    if (!serverUp) return
    const secret =
      process.env.VAPI_WEBHOOK_SECRET ||
      process.env.VAPI_SERVER_SECRET ||
      process.env.VITE_VAPI_SERVER_SECRET
    if (!secret) return
    const res = await fetch(`${base}/api/vapi-webhook`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-vapi-signature': '00'.repeat(32),
      },
      body: JSON.stringify({ message: { type: 'end-of-call-report' } }),
    })
    expect(res.status).toBe(401)
  })

  it('Facebook GET verify: wrong token → 403', async () => {
    if (!serverUp) return
    const res = await fetch(
      `${base}/api/webhooks/facebook-leads?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=abc`
    )
    expect(res.status).toBe(403)
  })

  it('Facebook POST: missing signature → 401 when FACEBOOK_APP_SECRET set', async () => {
    if (!serverUp || !process.env.FACEBOOK_APP_SECRET) return
    const res = await fetch(`${base}/api/webhooks/facebook-leads`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        entry: [
          {
            changes: [
              {
                value: {
                  leadgen_id: `sig-${Date.now()}`,
                  field_data: [],
                },
              },
            ],
          },
        ],
      }),
    })
    expect(res.status).toBe(401)
  })

  it.runIf(Boolean(process.env.FACEBOOK_APP_SECRET))(
    'Facebook POST: valid X-Hub-Signature-256 → not 401',
    async () => {
      if (!serverUp) return
      const secret = process.env.FACEBOOK_APP_SECRET!
      const body = JSON.stringify({
        entry: [
          {
            changes: [
              {
                value: {
                  leadgen_id: `ok-${Date.now()}`,
                  field_data: [
                    { name: 'full_name', values: ['FB Test'] },
                    { name: 'phone_number', values: [`+9715${String(Date.now()).slice(-8)}`] },
                  ],
                },
              },
            ],
          },
        ],
      })
      const sig = `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`
      const res = await fetch(`${base}/api/webhooks/facebook-leads`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-hub-signature-256': sig,
        },
        body,
      })
      expect(res.status).not.toBe(401)
    }
  )

  it('Twilio inbound: missing signature → 401 when TWILIO_AUTH_TOKEN set', async () => {
    if (!serverUp || !process.env.TWILIO_AUTH_TOKEN) return
    const res = await fetch(`${base}/webhook/whatsapp/inbound`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'From=whatsapp%3A%2B971500000000&Body=hi',
    })
    expect([401, 403]).toContain(res.status)
  })

  it('malformed JSON to Zillow does not crash the process (4xx/5xx)', async () => {
    if (!serverUp) return
    const secret = process.env.ZILLOW_WEBHOOK_SECRET
    const url = secret
      ? `${base}/api/portal/zillow?secret=${encodeURIComponent(secret)}`
      : `${base}/api/portal/zillow?secret=x`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not-json',
    })
    expect(res.status).toBeGreaterThanOrEqual(400)
  })
})

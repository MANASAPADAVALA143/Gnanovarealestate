import crypto from 'crypto'
import type { NextFunction, Request, Response } from 'express'
import twilio from 'twilio'

function vapiWebhookSecret(): string | undefined {
  return (
    process.env.VAPI_WEBHOOK_SECRET ||
    process.env.VAPI_SERVER_SECRET ||
    process.env.VITE_VAPI_SERVER_SECRET
  )?.trim()
}

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

/** VAPI — HMAC-SHA256 (x-vapi-signature) or shared secret (x-vapi-secret). */
export function validateVapiSignature(req: Request, res: Response, next: NextFunction): void {
  const secret = vapiWebhookSecret()

  if (!secret) {
    if (isProduction()) {
      console.error('[VAPI] VAPI_WEBHOOK_SECRET not set — blocking request')
      res.status(500).json({ error: 'Webhook secret not configured' })
      return
    }
    console.warn('[VAPI] VAPI_WEBHOOK_SECRET not set — skipping validation (dev only)')
    next()
    return
  }

  const signatureHeader =
    (req.headers['x-vapi-signature'] as string | undefined)?.trim() ||
    (req.headers['x-vapi-secret'] as string | undefined)?.trim()

  if (!signatureHeader) {
    console.warn('[VAPI] Missing x-vapi-signature / x-vapi-secret header')
    res.status(401).json({ error: 'Missing signature' })
    return
  }

  // Plain shared-secret mode (matches Next.js /api/vapi/functions)
  if (signatureHeader === secret) {
    next()
    return
  }

  const rawBody = req.rawBody ?? JSON.stringify(req.body ?? {})

  try {
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
    const sigBuffer = Buffer.from(signatureHeader, 'hex')
    const expBuffer = Buffer.from(expected, 'hex')

    if (sigBuffer.length === expBuffer.length && crypto.timingSafeEqual(sigBuffer, expBuffer)) {
      next()
      return
    }
  } catch {
    // fall through to rejection
  }

  console.warn('[VAPI] Signature mismatch — rejecting webhook')
  res.status(401).json({ error: 'Invalid signature' })
}

/** Twilio — official request validator (x-twilio-signature). */
export function validateTwilioSignature(req: Request, res: Response, next: NextFunction): void {
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim()

  if (!authToken) {
    if (isProduction()) {
      console.error('[Twilio] TWILIO_AUTH_TOKEN not set — blocking request')
      res.status(500).json({ error: 'Twilio auth token not configured' })
      return
    }
    console.warn('[Twilio] TWILIO_AUTH_TOKEN not set — skipping validation (dev only)')
    next()
    return
  }

  const protocol = (req.headers['x-forwarded-proto'] as string | undefined) || req.protocol
  const host = (req.headers['x-forwarded-host'] as string | undefined) || req.headers.host
  const fullUrl = `${protocol}://${host}${req.originalUrl}`

  const twilioSignature = req.headers['x-twilio-signature'] as string | undefined

  if (!twilioSignature) {
    console.warn('[Twilio] Missing x-twilio-signature header')
    res.status(401).json({ error: 'Missing Twilio signature' })
    return
  }

  const isValid = twilio.validateRequest(authToken, twilioSignature, fullUrl, req.body)

  if (!isValid) {
    console.warn('[Twilio] Signature invalid — rejecting webhook')
    res.status(403).json({ error: 'Invalid Twilio signature' })
    return
  }

  next()
}

/** Portal intake (Bayut / Property Finder / generic) — shared bearer or header secret. */
export function validatePortalSecret(req: Request, res: Response, next: NextFunction): void {
  const secret =
    process.env.PORTAL_WEBHOOK_SECRET?.trim() ||
    process.env.WEBHOOK_SECRET?.trim()

  const token =
    (req.headers['x-webhook-secret'] as string | undefined)?.trim() ||
    (req.headers.authorization as string | undefined)?.replace(/^Bearer\s+/i, '').trim()

  if (!secret) {
    if (isProduction()) {
      res.status(500).json({ error: 'Portal secret not configured' })
      return
    }
    next()
    return
  }

  if (!token || token !== secret) {
    console.warn('[Portal] Invalid webhook secret')
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  next()
}

function facebookAppSecret(): string | undefined {
  return (
    process.env.FACEBOOK_APP_SECRET ||
    process.env.META_APP_SECRET ||
    process.env.VITE_FACEBOOK_APP_SECRET
  )?.trim()
}

/**
 * Facebook / Meta Lead Ads — X-Hub-Signature-256 (preferred) or X-Hub-Signature (sha1).
 * Requires raw body on req.rawBody (express.json verify: captureRawBody).
 */
export function validateFacebookSignature(req: Request, res: Response, next: NextFunction): void {
  const secret = facebookAppSecret()

  if (!secret) {
    if (isProduction()) {
      console.error('[Facebook] FACEBOOK_APP_SECRET not set — blocking request')
      res.status(500).json({ error: 'Facebook app secret not configured' })
      return
    }
    console.warn('[Facebook] FACEBOOK_APP_SECRET not set — skipping validation (dev only)')
    next()
    return
  }

  const rawBody = req.rawBody ?? ''
  if (!rawBody) {
    console.warn('[Facebook] Missing raw body for signature check')
    res.status(401).json({ error: 'Missing request body for signature verification' })
    return
  }

  const sig256 = (req.headers['x-hub-signature-256'] as string | undefined)?.trim()
  const sig1 = (req.headers['x-hub-signature'] as string | undefined)?.trim()

  if (sig256) {
    const expected = `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`
    const a = Buffer.from(sig256)
    const b = Buffer.from(expected)
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      next()
      return
    }
    console.warn('[Facebook] X-Hub-Signature-256 mismatch — rejecting webhook')
    res.status(401).json({ error: 'Invalid signature' })
    return
  }

  if (sig1) {
    const expected = `sha1=${crypto.createHmac('sha1', secret).update(rawBody).digest('hex')}`
    const a = Buffer.from(sig1)
    const b = Buffer.from(expected)
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      next()
      return
    }
    console.warn('[Facebook] X-Hub-Signature mismatch — rejecting webhook')
    res.status(401).json({ error: 'Invalid signature' })
    return
  }

  console.warn('[Facebook] Missing X-Hub-Signature-256 / X-Hub-Signature header')
  res.status(401).json({ error: 'Missing signature' })
}

const requestCounts = new Map<string, number[]>()
const WINDOW_MS = 60 * 1000
const MAX_REQUESTS = 100

/** In-memory rate limit — swap for Redis if running multiple instances. */
export function rateLimiter(req: Request, res: Response, next: NextFunction): void {
  const ip =
    (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
    req.ip ||
    'unknown'
  const now = Date.now()
  const windowStart = now - WINDOW_MS

  const timestamps = (requestCounts.get(ip) ?? []).filter((t) => t > windowStart)
  timestamps.push(now)
  requestCounts.set(ip, timestamps)

  if (timestamps.length > MAX_REQUESTS) {
    console.warn(`[RateLimit] IP ${ip} exceeded ${MAX_REQUESTS} req/min`)
    res.status(429).json({ error: 'Too many requests' })
    return
  }

  next()
}

setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS
  for (const [ip, timestamps] of requestCounts.entries()) {
    const fresh = timestamps.filter((t) => t > cutoff)
    if (fresh.length === 0) requestCounts.delete(ip)
    else requestCounts.set(ip, fresh)
  }
}, 5 * 60 * 1000).unref()

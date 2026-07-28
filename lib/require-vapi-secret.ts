import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

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

/**
 * VAPI webhook / tool auth for Next routes.
 * Accepts plain shared secret (x-vapi-secret / x-vapi-signature) or HMAC-SHA256 hex of body.
 * Prod: fail closed if secret unset. Dev: warn + allow.
 */
export async function requireVapiSecret(
  req: NextRequest
): Promise<true | NextResponse> {
  const secret = vapiWebhookSecret()

  if (!secret) {
    if (isProduction()) {
      console.error('[VAPI] VAPI_WEBHOOK_SECRET not set — blocking request')
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
    }
    console.warn('[VAPI] VAPI_WEBHOOK_SECRET not set — skipping validation (dev only)')
    return true
  }

  const signatureHeader =
    req.headers.get('x-vapi-signature')?.trim() ||
    req.headers.get('x-vapi-secret')?.trim()

  if (!signatureHeader) {
    console.warn('[VAPI] Missing x-vapi-signature / x-vapi-secret header')
    return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
  }

  if (signatureHeader === secret) {
    return true
  }

  try {
    const rawBody = await req.clone().text()
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
    const sigBuffer = Buffer.from(signatureHeader, 'hex')
    const expBuffer = Buffer.from(expected, 'hex')

    if (sigBuffer.length === expBuffer.length && crypto.timingSafeEqual(sigBuffer, expBuffer)) {
      return true
    }
  } catch {
    // fall through
  }

  console.warn('[VAPI] Signature mismatch — rejecting webhook')
  return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
}

/** Dual auth: agent JWT or VAPI secret (for property tools called by dashboard or VAPI). */
export async function requireAgentOrVapi(
  req: NextRequest
): Promise<{ agentId?: string } | NextResponse> {
  const { requireAgent, isAgentAuth } = await import('./require-agent')
  const agent = await requireAgent(req)
  if (isAgentAuth(agent)) {
    return { agentId: agent.agentId }
  }

  const vapi = await requireVapiSecret(req)
  if (vapi === true) {
    return {}
  }

  // Prefer agent 401 if both failed; surface VAPI error only when no Bearer attempted
  const header = req.headers.get('authorization') || req.headers.get('Authorization')
  if (header?.match(/^Bearer\s+/i)) {
    return agent
  }
  return vapi
}

/**
 * Resolve which dashboard agent should own a VAPI call when metadata is missing.
 * Used by inbound + outbound webhooks so `calls.agent_id` matches the logged-in broker.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isUuid(s: string): boolean {
  return UUID_RE.test(s.trim())
}

function envAgentId(): string | null {
  if (typeof process !== 'undefined' && process.env) {
    const a =
      process.env.DEFAULT_AGENT_ID ||
      process.env.VITE_DEFAULT_AGENT_ID ||
      process.env.NEXT_PUBLIC_DEFAULT_AGENT_ID
    if (typeof a === 'string' && isUuid(a)) return a.trim()
  }
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_DEFAULT_AGENT_ID) {
    const a = String(import.meta.env.VITE_DEFAULT_AGENT_ID)
    if (isUuid(a)) return a.trim()
  }
  return null
}

/**
 * Prefer VAPI call metadata, then env (DEFAULT_AGENT_ID / VITE_DEFAULT_AGENT_ID).
 */
export function resolveVapiAgentId(payload: { call?: any; metadata?: any } | null | undefined): string | null {
  if (!payload) return envAgentId()
  const call = payload.call ?? payload
  const meta = call?.metadata ?? payload.metadata
  const raw = meta?.agentId ?? meta?.agent_id
  if (typeof raw === 'string' && isUuid(raw)) return raw.trim()
  return envAgentId()
}

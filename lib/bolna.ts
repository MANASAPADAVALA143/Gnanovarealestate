import { toE164 } from './phone-e164'

export type BolnaCallResult = { executionId: string | null; status: string | null }

/** Queue an outbound call through Bolna (https://docs.bolna.ai/api-reference/calls/make). */
export async function startBolnaCall(params: {
  agentId: string
  phone: string
  userData?: Record<string, string | number | null>
}): Promise<BolnaCallResult> {
  const apiKey = process.env.BOLNA_API_KEY
  if (!apiKey) throw new Error('BOLNA_API_KEY is not configured')

  const body: Record<string, unknown> = {
    agent_id: params.agentId,
    recipient_phone_number: toE164(params.phone),
    user_data: params.userData ?? {},
  }
  const fromNumber = process.env.BOLNA_FROM_PHONE_NUMBER
  if (fromNumber) body.from_phone_number = fromNumber

  const res = await fetch('https://api.bolna.ai/call', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  })

  if (!res.ok) {
    throw new Error(`Bolna ${res.status}: ${await res.text().catch(() => '')}`)
  }

  const data = (await res.json().catch(() => ({}))) as { execution_id?: string; status?: string }
  return { executionId: data.execution_id ?? null, status: data.status ?? null }
}

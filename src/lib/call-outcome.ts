/** Maps Vapi end reason + duration into dashboard call_outcome values */
export function mapVapiToCallOutcome(
  endedReason: string | undefined,
  durationSec: number,
  hasTranscript: boolean
): string | null {
  const r = (endedReason || '').toLowerCase()
  if (r.includes('voicemail') || r.includes('machine')) return 'voicemail'
  if (
    r.includes('no-answer') ||
    r.includes('no_answer') ||
    r.includes('customer-busy') ||
    r.includes('customer-did-not-answer') ||
    r.includes('busy') ||
    r.includes('timeout')
  ) {
    return 'not_reached'
  }
  if (durationSec > 0 && durationSec < 4 && !hasTranscript) return 'not_reached'
  if (hasTranscript && durationSec >= 4) return 'qualified'
  if (hasTranscript) return 'callback'
  return null
}

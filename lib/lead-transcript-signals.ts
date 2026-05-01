/** Heuristic lead_type + urgency from call transcript (speed + outbound webhooks). */

export function inferLeadTypeAndUrgencyFromTranscript(transcript: string): {
  lead_type: string
  urgency: string
} {
  const t = (transcript || '').toLowerCase()

  let lead_type = 'buyer'
  if (
    t.includes('sell') ||
    t.includes('list my') ||
    t.includes('valuation') ||
    t.includes('bechna')
  ) {
    lead_type = 'seller'
  } else if (t.includes('rent') || t.includes('lease') || t.includes('pg') || t.includes('kiraya')) {
    lead_type = 'renter'
  } else if (t.includes('partnership') || t.includes('advertis') || t.includes('vendor')) {
    lead_type = 'vendor'
  }

  let urgency = 'normal'
  if (
    t.includes('urgent') ||
    t.includes('this week') ||
    t.includes('immediately') ||
    t.includes('ready to buy') ||
    t.includes('ready to sell') ||
    t.includes('jaldi')
  ) {
    urgency = 'high'
  }

  return { lead_type, urgency }
}

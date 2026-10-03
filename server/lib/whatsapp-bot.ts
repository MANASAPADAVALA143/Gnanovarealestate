/**
 * WhatsApp Lead Qualification Bot
 * Sends 3 qualification questions to new leads, scores them Hot/Warm/Cold,
 * and triggers a VAPI call for Hot leads.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { sendWhatsAppOutbound } from './whatsapp-inbox.ts'

export type BotScore = 'Hot' | 'Warm' | 'Cold'

export type BotSession = {
  id: string
  lead_id: string
  phone: string
  step: number          // 0=sent Q1, 1=sent Q2, 2=sent Q3, 3=done
  answer_1: string | null
  answer_2: string | null
  answer_3: string | null
  score: BotScore | null
  created_at: string
  updated_at: string
}

const QUESTIONS = [
  `Hi {name}! I'm the Gnanova AI assistant 🏡\n\nAre you looking to:\n1️⃣ Buy for self use\n2️⃣ Buy for investment\n\nReply with 1 or 2`,
  `Great! What is your budget range?\n1️⃣ Below AED 500K\n2️⃣ AED 500K – 2M\n3️⃣ Above AED 2M\n\nReply with 1, 2 or 3`,
  `Perfect! When would you like to visit?\n1️⃣ This week\n2️⃣ Next week\n3️⃣ Just exploring\n\nReply with 1, 2 or 3`,
]

function getSupabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  return createClient(url, key)
}

async function sendWhatsApp(to: string, body: string): Promise<boolean> {
  // Uses Meta WhatsApp Cloud API via sendWhatsAppOutbound
  const plain = to.replace(/^whatsapp:/i, '').replace(/^\+/, '').trim()
  const sid = await sendWhatsAppOutbound(plain, body)
  return sid !== null
}

function scoreAnswers(a1: string, a2: string, a3: string): BotScore {
  let points = 0
  // Q1: investment buyer scores higher
  if (a1 === '2') points += 2; else if (a1 === '1') points += 1
  // Q2: higher budget = hotter
  if (a2 === '3') points += 3; else if (a2 === '2') points += 2; else points += 1
  // Q3: sooner visit = hotter
  if (a3 === '1') points += 3; else if (a3 === '2') points += 2; else points += 0

  if (points >= 7) return 'Hot'
  if (points >= 4) return 'Warm'
  return 'Cold'
}

/** Start the bot for a new lead — sends Q1 */
export async function startBotForLead(leadId: string, name: string, phone: string): Promise<void> {
  const supabase = getSupabase()

  // Avoid duplicate sessions
  const { data: existing } = await supabase
    .from('whatsapp_bot_sessions')
    .select('id')
    .eq('lead_id', leadId)
    .maybeSingle()
  if (existing) return

  const q = QUESTIONS[0].replace('{name}', name.split(' ')[0])
  const sent = await sendWhatsApp(phone, q)
  if (!sent) return

  await supabase.from('whatsapp_bot_sessions').insert({
    lead_id: leadId,
    phone,
    step: 0,
    answer_1: null,
    answer_2: null,
    answer_3: null,
    score: null,
  })
}

/** Handle an inbound reply — advance the conversation */
export async function handleBotReply(phone: string, body: string): Promise<boolean> {
  const supabase = getSupabase()
  const plain = phone.replace(/^whatsapp:/i, '').trim()

  const { data: session } = await supabase
    .from('whatsapp_bot_sessions')
    .select('*')
    .eq('phone', plain)
    .is('score', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!session) return false  // no active bot session for this number

  const s = session as BotSession
  const answer = body.trim().charAt(0)

  if (s.step === 0) {
    // Received answer to Q1 — send Q2
    await supabase.from('whatsapp_bot_sessions').update({ step: 1, answer_1: answer }).eq('id', s.id)
    await sendWhatsApp(phone, QUESTIONS[1])
    return true
  }

  if (s.step === 1) {
    // Received answer to Q2 — send Q3
    await supabase.from('whatsapp_bot_sessions').update({ step: 2, answer_2: answer }).eq('id', s.id)
    await sendWhatsApp(phone, QUESTIONS[2])
    return true
  }

  if (s.step === 2) {
    // Received answer to Q3 — score and finish
    const a1 = s.answer_1 || '1'
    const a2 = s.answer_2 || '1'
    const score = scoreAnswers(a1, a2, answer)

    await supabase.from('whatsapp_bot_sessions').update({ step: 3, answer_3: answer, score }).eq('id', s.id)

    // Update lead score label in leads table
    await supabase.from('leads').update({ ai_score: score === 'Hot' ? 90 : score === 'Warm' ? 60 : 30 }).eq('id', s.lead_id)

    // Send result message
    const msg = score === 'Hot'
      ? `🔥 Thank you! Based on your answers, our team will call you within the next 5 minutes. Get ready to find your perfect suite! — Gnanova`
      : score === 'Warm'
      ? `✅ Thank you! One of our consultants will reach out to you shortly to discuss the best options for you. — Gnanova`
      : `✅ Thank you! We'll keep you updated on our latest listings. Feel free to reach out when you're ready. — Gnanova`

    await sendWhatsApp(phone, msg)

    console.log(`[bot] Lead ${s.lead_id} scored ${score}`)
    return true
  }

  return false
}

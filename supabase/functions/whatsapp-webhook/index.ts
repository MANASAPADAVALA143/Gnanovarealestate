import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const VERIFY_TOKEN = Deno.env.get('FACEBOOK_VERIFY_TOKEN') || 'gnanova_verify_token_2025'
const WHATSAPP_TOKEN = Deno.env.get('WHATSAPP_TOKEN') || ''
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') || ''
const SUPABASE_URL = Deno.env.get('DB_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('DB_SERVICE_ROLE_KEY') || ''

function getSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
}

async function sendWhatsApp(to: string, body: string): Promise<boolean> {
  const phone = to.replace(/^\+/, '').replace(/^whatsapp:/i, '').trim()
  try {
    const res = await fetch(
      `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phone,
          type: 'text',
          text: { body },
        }),
      }
    )
    return res.ok
  } catch {
    return false
  }
}

const QUESTIONS = [
  `Hi {name}! I'm the Gnanova AI assistant 🏡\n\nAre you looking to:\n1️⃣ Buy for self use\n2️⃣ Buy for investment\n\nReply with 1 or 2`,
  `Great! What is your budget range?\n1️⃣ Below AED 500K\n2️⃣ AED 500K – 2M\n3️⃣ Above AED 2M\n\nReply with 1, 2 or 3`,
  `Perfect! When would you like to visit?\n1️⃣ This week\n2️⃣ Next week\n3️⃣ Just exploring\n\nReply with 1, 2 or 3`,
]

function scoreAnswers(a1: string, a2: string, a3: string): string {
  let points = 0
  if (a1 === '2') points += 2; else if (a1 === '1') points += 1
  if (a2 === '3') points += 3; else if (a2 === '2') points += 2; else points += 1
  if (a3 === '1') points += 3; else if (a3 === '2') points += 2
  if (points >= 7) return 'Hot'
  if (points >= 4) return 'Warm'
  return 'Cold'
}

async function handleBotReply(phone: string, text: string): Promise<boolean> {
  const supabase = getSupabase()
  const plain = phone.replace(/^\+/, '').trim()

  const { data: session } = await supabase
    .from('whatsapp_bot_sessions')
    .select('*')
    .eq('phone', plain)
    .is('score', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!session) return false

  const answer = text.trim().charAt(0)

  if (session.step === 0) {
    await supabase.from('whatsapp_bot_sessions').update({ step: 1, answer_1: answer }).eq('id', session.id)
    await sendWhatsApp(plain, QUESTIONS[1])
    return true
  }

  if (session.step === 1) {
    await supabase.from('whatsapp_bot_sessions').update({ step: 2, answer_2: answer }).eq('id', session.id)
    await sendWhatsApp(plain, QUESTIONS[2])
    return true
  }

  if (session.step === 2) {
    const a1 = session.answer_1 || '1'
    const a2 = session.answer_2 || '1'
    const score = scoreAnswers(a1, a2, answer)

    await supabase.from('whatsapp_bot_sessions').update({ step: 3, answer_3: answer, score }).eq('id', session.id)
    await supabase.from('leads').update({ ai_score: score === 'Hot' ? 90 : score === 'Warm' ? 60 : 30 }).eq('id', session.lead_id)

    const msg = score === 'Hot'
      ? `🔥 Thank you! Our team will call you within 5 minutes. — Gnanova`
      : score === 'Warm'
      ? `✅ Thank you! A consultant will reach out shortly. — Gnanova`
      : `✅ Thank you! We'll keep you updated on our latest listings. — Gnanova`

    await sendWhatsApp(plain, msg)
    return true
  }

  return false
}

async function processInboundMessage(from: string, text: string, messageId: string) {
  const supabase = getSupabase()

  // Try bot first
  const handledByBot = await handleBotReply(from, text)
  if (handledByBot) return

  // Save to whatsapp_thread_messages for Inbox
  const { data: thread } = await supabase
    .from('whatsapp_threads')
    .select('id')
    .eq('phone', from)
    .maybeSingle()

  let threadId = thread?.id

  if (!threadId) {
    const { data: newThread } = await supabase
      .from('whatsapp_threads')
      .insert({ phone: from, status: 'open', unread_count: 1 })
      .select('id')
      .single()
    threadId = newThread?.id
  }

  if (threadId) {
    await supabase.from('whatsapp_thread_messages').insert({
      thread_id: threadId,
      direction: 'inbound',
      body: text,
      message_sid: messageId,
    })

    await supabase.from('whatsapp_threads').update({
      last_message_at: new Date().toISOString(),
      unread_count: supabase.rpc('increment', { x: 1 }),
    }).eq('id', threadId)
  }
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url)

  // GET — Meta webhook verification
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('[whatsapp-webhook] Meta verified ✅')
      return new Response(challenge, { status: 200 })
    }
    return new Response('Forbidden', { status: 403 })
  }

  // POST — inbound WhatsApp messages
  if (req.method === 'POST') {
    try {
      const body = await req.json()

      if (body?.object === 'whatsapp_business_account') {
        for (const entry of body.entry || []) {
          for (const change of entry.changes || []) {
            const val = change.value
            for (const msg of val?.messages || []) {
              const from = msg.from
              const text = msg.text?.body || msg.button?.text || `[${msg.type}]`
              console.log(`[whatsapp-webhook] From +${from}: ${text}`)
              await processInboundMessage(from, text, msg.id)
            }
          }
        }
        return new Response(JSON.stringify({ status: 'ok' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    } catch (e) {
      console.error('[whatsapp-webhook] Error:', e)
    }
    return new Response(JSON.stringify({ error: 'Not a WhatsApp event' }), { status: 404 })
  }

  return new Response('Method not allowed', { status: 405 })
})

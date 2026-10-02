import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://mhdnoufdloigblgcypjl.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('DB_SERVICE_ROLE_KEY')!
const WHATSAPP_TOKEN = Deno.env.get('WHATSAPP_TOKEN')!
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') || '1298685323329504'
const VERIFY_TOKEN = Deno.env.get('FACEBOOK_VERIFY_TOKEN') || Deno.env.get('WHATSAPP_VERIFY_TOKEN') || 'gnanova-verify-2024'

const AUTO_REPLY = `Hello! Thank you for contacting Gnanova Real Estate. Our team will connect with you shortly. To speak with our AI agent now, reply with YES.`

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function sendWhatsAppMessage(to: string, text: string) {
  const url = `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`
  await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    }),
  })
}

async function processMessage(from: string, text: string, messageId: string) {
  const phone = from.startsWith('+') ? from : `+${from}`

  // Find or create thread
  let { data: thread } = await supabase
    .from('whatsapp_threads')
    .select('id, unread_count')
    .eq('phone_number', phone)
    .maybeSingle()

  const now = new Date().toISOString()

  if (!thread) {
    // Try to find a matching lead
    const { data: lead } = await supabase
      .from('leads')
      .select('id')
      .or(`phone.eq.${phone},phone.eq.${from}`)
      .maybeSingle()

    const { data: newThread } = await supabase
      .from('whatsapp_threads')
      .insert({
        phone_number: phone,
        lead_id: lead?.id || null,
        status: 'unassigned',
        last_message_at: now,
        last_message_preview: text,
        unread_count: 1,
      })
      .select('id, unread_count')
      .single()

    thread = newThread

    // Send auto-reply for new conversations
    await sendWhatsAppMessage(from, AUTO_REPLY)

    // Save auto-reply as outbound message
    if (thread) {
      await supabase.from('whatsapp_thread_messages').insert({
        thread_id: thread.id,
        direction: 'outbound',
        sender_type: 'bot',
        body: AUTO_REPLY,
        twilio_message_sid: null,
      })
    }
  } else {
    // Update existing thread
    await supabase
      .from('whatsapp_threads')
      .update({
        last_message_at: now,
        last_message_preview: text,
        unread_count: (thread.unread_count || 0) + 1,
        updated_at: now,
      })
      .eq('id', thread.id)
  }

  if (!thread) return

  // Save inbound message (check for duplicate)
  const { data: existing } = await supabase
    .from('whatsapp_thread_messages')
    .select('id')
    .eq('twilio_message_sid', messageId)
    .maybeSingle()

  if (!existing) {
    await supabase.from('whatsapp_thread_messages').insert({
      thread_id: thread.id,
      direction: 'inbound',
      sender_type: 'lead',
      body: text,
      twilio_message_sid: messageId,
    })
  }
}

Deno.serve(async (req) => {
  const url = new URL(req.url)

  // Webhook verification (GET)
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      return new Response(challenge, { status: 200 })
    }
    return new Response('Forbidden', { status: 403 })
  }

  // Incoming message (POST)
  if (req.method === 'POST') {
    try {
      const body = await req.json()

      if (body?.object === 'whatsapp_business_account') {
        for (const entry of body.entry || []) {
          for (const change of entry.changes || []) {
            const val = change.value
            for (const msg of val?.messages || []) {
              const from: string = msg.from
              const text: string = msg.text?.body || msg.button?.text || `[${msg.type}]`
              await processMessage(from, text, msg.id)
            }
          }
        }
      }

      return new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (err) {
      console.error('Webhook error:', err)
      return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 })
    }
  }

  return new Response('Method not allowed', { status: 405 })
})

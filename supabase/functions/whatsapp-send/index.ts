const WHATSAPP_TOKEN = Deno.env.get('WHATSAPP_TOKEN')!
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') || '1298685323329504'

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const { to, message } = await req.json()
    if (!to || !message) {
      return new Response(JSON.stringify({ error: 'Missing to or message' }), { status: 400 })
    }

    const phone = to.replace('+', '').replace(/\s/g, '')

    const res = await fetch(`https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'text',
        text: { body: message },
      }),
    })

    const result = await res.json()
    console.log('WhatsApp send result:', JSON.stringify(result))

    return new Response(JSON.stringify(result), {
      status: res.ok ? 200 : 400,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Send error:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})

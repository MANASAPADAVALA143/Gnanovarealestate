import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const WHATSAPP_TOKEN = Deno.env.get('WHATSAPP_TOKEN') || ''
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') || ''
const OWNER_PHONE = Deno.env.get('OWNER_PHONE') || '' // e.g. 971501234567
const SUPABASE_URL = Deno.env.get('DB_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('DB_SERVICE_ROLE_KEY') || ''

function getSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
}

async function sendWhatsApp(to: string, body: string): Promise<void> {
  const phone = to.replace(/^\+/, '').trim()
  await fetch(
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
}

async function buildDailySummary(): Promise<string> {
  const supabase = getSupabase()
  const today = new Date()
  const startOfDay = new Date(today)
  startOfDay.setHours(0, 0, 0, 0)
  const startISO = startOfDay.toISOString()

  // New leads today
  const { count: newLeads } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startISO)

  // Hot leads total
  const { count: hotLeads } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .gte('ai_score', 80)

  // Total leads
  const { count: totalLeads } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })

  // Deals closed today
  const { count: dealsToday } = await supabase
    .from('deals')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'closed_won')
    .gte('updated_at', startISO)

  // Payments due today
  const todayStr = today.toISOString().split('T')[0]
  const { count: paymentsDue } = await supabase
    .from('payments')
    .select('*', { count: 'exact', head: true })
    .eq('due_date', todayStr)
    .eq('status', 'pending')

  // Available suites
  const { count: availableSuites } = await supabase
    .from('suites')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'available')

  // Bot sessions today
  const { count: botSessions } = await supabase
    .from('whatsapp_bot_sessions')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startISO)

  const { count: hotFromBot } = await supabase
    .from('whatsapp_bot_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('score', 'Hot')
    .gte('created_at', startISO)

  const dateStr = today.toLocaleDateString('en-AE', {
    weekday: 'long', day: 'numeric', month: 'long'
  })

  return `🌅 *Gnanova CRM — Daily Summary*
📅 ${dateStr}

📊 *LEADS*
• New today: ${newLeads || 0}
• Total leads: ${totalLeads || 0}
• 🔥 Hot leads: ${hotLeads || 0}

🤖 *WHATSAPP BOT*
• Sessions today: ${botSessions || 0}
• Hot qualified: ${hotFromBot || 0}

🏢 *INVENTORY*
• Available suites: ${availableSuites || 0}

💰 *DEALS & PAYMENTS*
• Deals closed today: ${dealsToday || 0}
• Payments due today: ${paymentsDue || 0}

${paymentsDue && paymentsDue > 0 ? '⚠️ *Action needed: ' + paymentsDue + ' payment(s) due today!*\n' : ''}
Have a great day! 🚀
— Gnanova AI`
}

Deno.serve(async (req: Request) => {
  // Allow manual trigger via POST or GET
  try {
    if (!OWNER_PHONE) {
      return new Response(
        JSON.stringify({ error: 'OWNER_PHONE not set in secrets' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const summary = await buildDailySummary()
    await sendWhatsApp(OWNER_PHONE, summary)

    console.log(`[daily-summary] Sent to ${OWNER_PHONE}`)
    return new Response(
      JSON.stringify({ success: true, message: 'Daily summary sent' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    console.error('[daily-summary] Error:', e)
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

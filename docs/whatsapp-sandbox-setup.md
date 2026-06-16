# WhatsApp Sandbox Setup (Twilio)

Use this guide to test inbound WhatsApp auto-reply with the Gnanova webhook server.

## Prerequisites

- Webhook server running: `npm run webhook` (port **3001**)
- Public URL via ngrok: `ngrok http 3001`
- Twilio account with WhatsApp sandbox enabled
- `.env.local` values:

```env
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
TWILIO_WEBHOOK_URL=https://YOUR-NGROK-URL/webhook/whatsapp/inbound
```

`TWILIO_WEBHOOK_URL` must match the **exact** URL configured in Twilio (including `https`).

For local testing without signature validation, you may set `TWILIO_SKIP_SIGNATURE=true` (do not use in production).

## Steps

1. Go to [Twilio Console](https://console.twilio.com) → **Messaging** → **Try it out** → **Send a WhatsApp message**.
2. Note the sandbox number (usually `+14155238886`).
3. Set **When a message comes in** webhook URL to:
   ```
   https://YOUR-NGROK-URL/webhook/whatsapp/inbound
   ```
   Method: **POST**
4. From your phone, send `join <sandbox-word>` to the sandbox number (shown in the Twilio console).
5. Ensure the lead exists in Supabase with a `phone` matching your WhatsApp number (E.164 format, e.g. `+971501234567`).
6. Send any message to the sandbox number.

## Expected behavior

- You receive an auto-reply based on the lead's `pipeline_stage`.
- A **whatsapp** activity appears on the lead timeline: `Inbound: {your message}`.
- The message is stored in `whatsapp_messages` (`status: inbound`).
- Any pending `follow_up_24h` / `follow_up_48h` task is auto-completed with a task activity.

## Verify in dashboard

Open **Dashboard → Leads**, select the matched lead, and check the activity timeline.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| 403 from webhook | Check `TWILIO_WEBHOOK_URL` matches ngrok URL exactly |
| No auto-reply | Confirm sandbox join message was sent; check server logs |
| Lead not matched | Phone in `leads` table must match inbound number (partial match supported) |
| Unmatched number | Generic reply sent; message still logged in `whatsapp_messages` |

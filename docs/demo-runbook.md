# Gnanova Real Estate — Demo Runbook

## Before the Demo (15 min prep)

### 1. Start ngrok (for live WhatsApp demo)
```bash
ngrok http 3001
```
- Copy the https URL
- Update TWILIO_WEBHOOK_URL in .env.local
- Update webhook URL in Twilio console → WhatsApp sandbox settings
- Confirm it shows "Tunnel Status: online"

### 2. Start all 3 servers (3 terminal windows)

Terminal 1 — Webhook server:
```bash
npm run webhook
```
Expected output: "Webhook server running on port 3001"

Terminal 2 — Vite dashboard:
```bash
npm run dev
```
Expected output: "Local: http://localhost:3000"

Terminal 3 — Next.js dashboard:
```bash
npm run dashboard
```
Expected output: "Ready on http://localhost:3002"

### 3. Verify servers are up
Open browser:
- http://localhost:3000 → should show landing page
- http://localhost:3000/dashboard → should show agent dashboard
- http://localhost:3002/dashboard → should show Next.js dashboard

### 4. Create a test lead (for demo)
Option A — via website form:
- Go to http://localhost:3000
- Fill in the lead form with a test name + your phone number
- Check Supabase → leads table → confirm row created
- Check lead_consent table → confirm opted_in=true
- Check lead_tasks table → confirm follow_up_24h task created

Option B — via Supabase SQL Editor (faster):
```sql
INSERT INTO leads (name, phone, email, source, pipeline_stage)
VALUES ('Ahmed Al Mansouri', '+971501234567', 
        'ahmed@test.com', 'website', 'new');
```
Then run onLeadCreated hook manually or trigger via 
POST /api/leads/create on webhook server.

### 5. Test WhatsApp auto-reply (live)
- Send "join <sandbox-word>" from your phone to Twilio 
  sandbox number (see docs/whatsapp-sandbox-setup.md)
- Send any message from your phone
- Within 5 seconds you should receive auto-reply:
  "Hi Ahmed! Thanks for your message. One of our agents 
  will follow up with you very shortly. — Gnanova Real Estate"
- Check http://localhost:3000/dashboard/leads → 
  open Ahmed's lead → Timeline tab → 
  confirm "Inbound: [your message]" appears
- Confirm follow_up_24h task is auto-closed in timeline

---

## During the Demo

### Screen order (10 min total — see demo-script.md)
1. Landing page → show ROI calculator (1 min)
2. /dashboard → overdue follow-ups widget (1 min)
3. /dashboard/leads → show test lead + Timeline tab (2 min)
4. /dashboard/pipeline → drag lead between stages (2 min)
5. /dashboard/tasks → show follow-up task auto-closed (1 min)
6. Live WhatsApp → send message, show auto-reply (2 min)
7. /dashboard/analytics → speed-to-lead chart (1 min)

---

## After the Demo

### Clean up test data
```sql
DELETE FROM lead_activities 
WHERE lead_id = (SELECT id FROM leads WHERE name='Ahmed Al Mansouri');

DELETE FROM lead_tasks 
WHERE lead_id = (SELECT id FROM leads WHERE name='Ahmed Al Mansouri');

DELETE FROM lead_consent 
WHERE lead_id = (SELECT id FROM leads WHERE name='Ahmed Al Mansouri');

DELETE FROM leads WHERE name = 'Ahmed Al Mansouri';
```

### If something breaks during demo
- WhatsApp not replying → check ngrok is running + 
  Twilio webhook URL is updated
- Dashboard not loading → check npm run dev is running on 3000
- Lead not appearing → check Supabase connection in .env.local
- Pipeline not updating → run supabase db push, 
  confirm migration 018 is applied
- Deals/commissions errors → run migrations 019 and 020 in Supabase SQL Editor, then `npm run verify-deals`

---

## Minimum setup for offline demo (no internet)
If demoing without internet (e.g. client site visit):
- Supabase: use local Supabase (supabase start)
- Skip WhatsApp live demo — show existing timeline 
  with pre-loaded test data instead
- Skip VAPI — show call logs from existing mock data

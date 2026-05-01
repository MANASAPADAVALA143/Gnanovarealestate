# n8n — Portal leads → Gnanova Speed-to-Lead

This guide wires **any portal** into your universal intake endpoint:

`POST /api/leads/portal-intake`

**Required**

- Public HTTPS URL for your Next.js app (Vercel, Cloudflare Tunnel, etc.).
- `WEBHOOK_SECRET` in your app environment (same value you send as `x-webhook-secret`).
- Supabase migrations applied, including `speed_to_lead_log`.
- VAPI env vars set if you want the phone to ring immediately after intake.

**Important — JSON field names**

The intake route reads **property interest** from: `property`, `property_title`, or `listing` (not `property_interest`). Use one of those keys in n8n HTTP bodies.

---

## Shared HTTP Request node (reusable)

Create an **HTTP Request** node (or duplicate it per workflow):

| Field | Value |
|--------|--------|
| Method | `POST` |
| URL | `https://[your-domain]/api/leads/portal-intake` |
| Authentication | None |
| Send Headers | Yes |
| Header name | `x-webhook-secret` |
| Header value | `{{$env.WEBHOOK_SECRET}}` (or paste your secret while testing) |
| Send Body | Yes |
| Body Content Type | JSON |

Example body (adjust expressions to your upstream node):

```json
{
  "name": "{{$json.name}}",
  "phone": "{{$json.phone}}",
  "email": "{{$json.email}}",
  "location": "{{$json.location}}",
  "property": "{{$json.property}}",
  "budget": "{{$json.budget}}",
  "source": "99acres"
}
```

**Local dev:** `http://localhost:3002/api/leads/portal-intake` only works if n8n can reach your machine (same LAN, tunnel, or n8n self-hosted on the same host).

---

## 99acres / MagicBricks — email parser method

Many Indian portals send **lead notification emails** to your registered inbox.

### Workflow

1. **Trigger — Gmail (or IMAP Email)**  
   - Watch a dedicated label, e.g. `portal-leads`, or filter by sender/subject for 99acres or MagicBricks.

2. **Extract fields**  
   - Use **Code**, **Set**, or **HTML Extract** / **Text Classifier** to pull:
     - `name`, `phone`, `location`, `property` (free text), `source` (`99acres` or `magicbricks`).

3. **HTTP Request** (shared pattern above)  
   - Map MagicBricks similarly; set `"source": "magicbricks"` so the dashboard bucket matches.

### Tips

- Normalize phone to digits in n8n before POST (intake also normalizes).
- If the email body is HTML, strip tags before regex.
- Duplicate the workflow per portal if templates differ (one Gmail trigger per sender filter).

---

## Zillow — Tech Connect webhook

Zillow **Tech Connect** can POST lead JSON to a URL.

### Workflow

1. **Trigger — Webhook**  
   - Method: `POST`, path e.g. `zillow-lead`.  
   - Copy the **Production URL** into Zillow Tech Connect’s webhook / partner URL field.

2. **Set** (optional)  
   - Map Zillow’s payload into a flat object your HTTP node expects. Field names vary by feed; inspect one real payload in n8n’s execution log.

3. **HTTP Request** → `portal-intake`  
   - Example mapping (adjust to your actual JSON paths):

```json
{
  "name": "{{$json.lead.first_name}} {{$json.lead.last_name}}",
  "phone": "{{$json.lead.phone}}",
  "email": "{{$json.lead.email}}",
  "property": "{{$json.listing.address}}",
  "source": "zillow"
}
```

---

## Facebook Lead Ads

**Existing path:** Meta sends leads to your **Express** handler (when running `webhook-server.js`):

`GET/POST /api/webhooks/facebook-leads`

In `src/api/facebook-webhook.ts`, leads are already saved with **`source: 'facebook'`**. You do **not** have to duplicate through `portal-intake` unless you want a second speed-to-lead row per lead.

**Optional — also hit portal-intake (n8n in the middle):**  
Meta → n8n Webhook → HTTP Request to `portal-intake` with `"source": "facebook"` and the same name/phone fields. Avoid double VAPI calls unless you disable the Facebook handler’s outbound dial.

---

## Website contact form

From your site (or n8n after form webhook):

```json
{
  "name": "Jane Doe",
  "phone": "9876543210",
  "location": "Hyderabad",
  "property": "3BHK gated community",
  "source": "website"
}
```

`POST` to `/api/leads/portal-intake` with `x-webhook-secret`.

---

## Testing without a real portal

Replace domain and secret if yours differ:

```bash
curl -X POST "https://[your-domain]/api/leads/portal-intake" ^
  -H "Content-Type: application/json" ^
  -H "x-webhook-secret: gnanova-secret-2024" ^
  -d "{\"name\":\"Test Buyer\",\"phone\":\"+919876543210\",\"location\":\"Hyderabad\",\"property\":\"2BHK in Kondapur\",\"budget\":\"50-70 lakhs\",\"source\":\"99acres\"}"
```

Linux / macOS:

```bash
curl -X POST "https://[your-domain]/api/leads/portal-intake" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: gnanova-secret-2024" \
  -d '{
    "name": "Test Buyer",
    "phone": "+919876543210",
    "location": "Hyderabad",
    "property": "2BHK in Kondapur",
    "budget": "50-70 lakhs",
    "source": "99acres"
  }'
```

If VAPI is configured, the test number should ring shortly after a `200` response. Watch **Speed-to-Lead** in the app (`/dashboard/speed-to-lead`) for live rows and response times.

---

## n8n environment

In n8n, set **`WEBHOOK_SECRET`** (Settings → Variables or your deployment env) to match the Next.js app. Never commit the secret to git.

---

## Dashboard

- **Speed-to-Lead:** `/dashboard/speed-to-lead` — live feed (5s refresh), today’s stats, source cards, 7-day chart.
- **API:** `GET /api/speed-to-lead/stats` — JSON for the page (IST “today” for totals).

---

## End-to-end flow (recap)

| Step | What happens |
|------|----------------|
| Lead on a portal | Email or webhook fires |
| n8n | Parses / maps fields → POST `portal-intake` |
| Next.js | Upserts `leads`, inserts `speed_to_lead_log`, triggers VAPI |
| VAPI | Outbound call; end report hits `/api/vapi/speed-webhook` |
| Claude | Scores transcript; log + lead updated |
| Dashboard | Response time + score visible on Speed-to-Lead |

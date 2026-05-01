# 🚀 New Features Setup Guide

## Overview

This guide covers the 4 new features added to Gnanova Real Estate AI:

1. **Facebook Lead Ads Integration** - Capture leads from Facebook ads
2. **GoHighLevel CRM Sync** - Automatically sync leads to GHL
3. **VAPI Inbound Receptionist** - AI answers incoming calls
4. **Outbound Campaigns** - Call old/cold leads automatically

---

## 📋 Prerequisites

Before setting up these features, ensure you have:

- ✅ Gnanova app running (frontend on port 3000, backend on port 3001)
- ✅ Supabase database configured
- ✅ VAPI account for voice calls
- ✅ Updated database schema (run migration file)

---

## 🗄️ Step 1: Database Migration

Run the new migration to add required tables and columns:

### Via Supabase Dashboard:

1. Go to https://supabase.com/dashboard
2. Select your project
3. Click "SQL Editor" → "New Query"
4. Copy the contents of `supabase/migrations/003_add_integrations_and_campaigns.sql`
5. Paste and click "Run"
6. Verify tables created:
   - `outbound_campaigns`
   - `campaign_leads`
   - `integration_settings`
   - Modified: `leads` (added `source`, `ghl_contact_id`, `timeline`, `agent_id`)
   - Modified: `calls` (added `campaign_id`, `call_type`, `vapi_call_id`)

---

## 🔗 Feature 1: GoHighLevel CRM Integration

### What it does:
- Automatically syncs every lead to your GoHighLevel CRM
- Works for leads from: website, Facebook, inbound calls, campaigns
- Updates GHL contact ID in database for tracking

### Setup Steps:

#### 1. Get GoHighLevel API Key

1. Login to GoHighLevel: https://app.gohighlevel.com
2. Go to Settings → Integrations → API
3. Create new API key or copy existing one
4. Note: Requires "Contacts" permission

#### 2. Get Location ID (Optional - for multi-location)

1. In GoHighLevel, go to Settings → Business Profile
2. Copy your Location ID (usually starts with "loc_")

#### 3. Add to `.env.local`:

```bash
GHL_API_KEY=your_api_key_here
GHL_LOCATION_ID=your_location_id_here  # Optional

# Also add VITE_ versions for dashboard UI
VITE_GHL_API_KEY=your_api_key_here
VITE_GHL_LOCATION_ID=your_location_id_here
```

#### 4. Test the Integration:

```bash
# Start your server
npm run webhook

# Test GHL sync
curl -X POST http://localhost:3001/api/test/gohighlevel \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Contact",
    "phone": "+1234567890",
    "email": "test@example.com",
    "source": "test"
  }'
```

✅ You should see a success message and the contact should appear in GHL!

#### 5. Enable in Dashboard:

1. Login to Gnanova dashboard
2. Go to "Integrations" page
3. Enable "GoHighLevel CRM"
4. Enter your API Key and Location ID
5. Click "Save Settings"
6. Click "Test Connection" to verify

**Result:** All new leads will automatically sync to GoHighLevel! 🎉

---

## 📱 Feature 2: Facebook Lead Ads Integration

### What it does:
- Receives leads from Facebook Lead Ad campaigns
- Saves lead to database
- Immediately triggers AI call to the lead
- Syncs to GoHighLevel (if enabled)

### Setup Steps:

#### 1. Create Facebook App

1. Go to https://developers.facebook.com
2. Click "My Apps" → "Create App"
3. Choose "Business" type
4. Fill in app details

#### 2. Add Webhooks Product

1. In your app, click "Add Product"
2. Find "Webhooks" and click "Set Up"
3. Click "Page" → "Subscribe to this object"

#### 3. Configure Webhook

**Webhook URL:**
```
https://your-domain.com/api/webhooks/facebook-leads
```

**Verify Token:** (create a random string)
```
gnanova_verify_token_2025
```

**Subscribed Events:**
- `leadgen` (check this box)

#### 4. Get App Secret

1. In Facebook App Dashboard
2. Settings → Basic
3. Copy "App Secret"

#### 5. Add to `.env.local`:

```bash
FACEBOOK_VERIFY_TOKEN=gnanova_verify_token_2025
FACEBOOK_APP_SECRET=your_app_secret_here

# Also add VITE_ versions
VITE_FACEBOOK_VERIFY_TOKEN=gnanova_verify_token_2025
VITE_FACEBOOK_APP_SECRET=your_app_secret_here
```

#### 6. Deploy Webhook (Required for Production)

Facebook needs a public URL. Options:

**Option A: ngrok (for testing)**
```bash
ngrok http 3001
# Copy the https URL (e.g., https://abc123.ngrok.io)
# Set in Facebook: https://abc123.ngrok.io/api/webhooks/facebook-leads
```

**Option B: Deploy to production**
- Deploy your app to Vercel/Netlify/etc.
- Use your production URL

#### 7. Verify Webhook in Facebook

1. In Facebook Webhooks settings
2. Click "Verify and Save"
3. Should show "Success"

#### 8. Enable in Dashboard:

1. Login to Gnanova dashboard
2. Go to "Integrations" page
3. Enable "Facebook Lead Ads"
4. Enter Verify Token and App Secret
5. Click "Save Settings"

**Result:** When someone fills out your Facebook Lead Ad, they'll get an AI call within seconds! 🎉

---

## 📞 Feature 3: VAPI Inbound Receptionist

### What it does:
- AI assistant "Sarah" answers incoming calls to your VAPI number
- Qualifies leads automatically
- Searches properties during call
- Books appointments
- Saves everything to database

### Setup Steps:

#### 1. Get VAPI Inbound Number

1. Login to VAPI: https://dashboard.vapi.ai
2. Go to Phone Numbers
3. Purchase a new number OR use existing
4. Copy the phone number (e.g., `+1234567890`)

#### 2. Configure Inbound Assistant

1. In VAPI Dashboard → Assistants
2. Use your existing "Sarah" assistant OR create one
3. Copy Assistant ID

#### 3. Set Inbound Webhook

1. In VAPI Dashboard → Phone Numbers
2. Select your inbound number
3. Set "Inbound Webhook URL":
```
https://your-domain.com/api/vapi/inbound
```

4. Set "Call Ended Webhook URL":
```
https://your-domain.com/api/vapi/inbound/update
```

#### 4. Add to `.env.local`:

```bash
VAPI_INBOUND_PHONE_NUMBER=+1234567890
VITE_VAPI_INBOUND_PHONE_NUMBER=+1234567890
```

#### 5. Test Inbound Call

1. Call your VAPI inbound number
2. Sarah should answer immediately
3. Have a conversation
4. Check dashboard → Leads to see the new inbound lead

#### 6. Enable in Dashboard:

1. Login to Gnanova dashboard
2. Go to "Integrations" page
3. Enable "VAPI Inbound Calls"
4. Enter your VAPI phone number
5. Click "Save Settings"

**Result:** Anyone calling your VAPI number gets instant AI qualification! 🎉

---

## 📣 Feature 4: Outbound Campaigns

### What it does:
- Create campaigns to call old/cold leads
- Select which lead statuses to target (cold, warm, new)
- Calls all selected leads automatically
- Tracks progress in real-time
- Shows completion stats

### How to Use:

#### 1. Access Campaigns

1. Login to Gnanova dashboard
2. Click "Campaigns" in sidebar

#### 2. Create New Campaign

1. Click "New Campaign" button
2. Fill in:
   - **Campaign Name:** e.g., "Re-engage Q1 Cold Leads"
   - **Description:** Brief goal description
   - **Lead Status:** Check boxes for statuses to target
     - ☑️ Cold leads
     - ☑️ Warm leads
     - ☐ New leads
3. See leads count preview
4. Click "Create Campaign"

#### 3. Start Campaign

1. Find your campaign in the list
2. Click "Start" button
3. Confirm the action
4. Campaign begins immediately!

#### 4. Monitor Progress

- **Real-time progress bar** shows calls being made
- **Stats display:**
  - Total leads
  - Calls made
  - Completed
  - Failed
- **Auto-completion** when all leads called

#### 5. View Results

1. Go to "Calls" page
2. Filter by campaign
3. See all call results, transcripts, outcomes

**Result:** Old leads get re-engaged automatically! 🎉

---

## 🧪 Testing Everything

### Test GoHighLevel Sync:

```bash
curl -X POST http://localhost:3001/api/leads/create \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Lead",
    "phone": "+1234567890",
    "email": "test@example.com",
    "source": "website"
  }'
```

✅ Check GoHighLevel for the new contact

### Test Facebook Webhook:

```bash
# Test verification (GET)
curl "http://localhost:3001/api/webhooks/facebook-leads?hub.mode=subscribe&hub.verify_token=gnanova_verify_token_2025&hub.challenge=test123"

# Should return: test123

# Test lead submission (POST)
curl -X POST http://localhost:3001/api/webhooks/facebook-leads \
  -H "Content-Type: application/json" \
  -d '{
    "entry": [{
      "changes": [{
        "value": {
          "field_data": [
            {"name": "full_name", "values": ["John Doe"]},
            {"name": "phone_number", "values": ["+1234567890"]},
            {"name": "email", "values": ["john@example.com"]}
          ]
        }
      }]
    }]
  }'
```

✅ Check dashboard for new lead with source: "facebook"

### Test Inbound Call:

1. Call your VAPI inbound number
2. Talk to Sarah
3. Check dashboard → Leads for new inbound lead

### Test Campaign:

1. Create test leads with status "cold"
2. Create campaign targeting "cold" leads
3. Start campaign
4. Watch progress bar
5. Check "Calls" page for results

---

## 📊 Verification Checklist

After setup, verify:

- [ ] Database migration completed successfully
- [ ] All new tables exist (outbound_campaigns, campaign_leads, integration_settings)
- [ ] Leads table has new columns (source, ghl_contact_id, timeline)
- [ ] Calls table has new columns (campaign_id, call_type, vapi_call_id)
- [ ] GoHighLevel sync working (test lead appears in GHL)
- [ ] Facebook webhook verified (shows "Success" in Facebook)
- [ ] VAPI inbound number configured with webhook
- [ ] Dashboard shows new "Campaigns" page
- [ ] Dashboard shows new "Integrations" page
- [ ] Can create and start campaigns
- [ ] Campaign progress updates in real-time

---

## 🐛 Troubleshooting

### GoHighLevel not syncing:

1. Check API key is correct
2. Verify API key has "Contacts" permission
3. Check server logs for errors
4. Test connection in Integrations page

### Facebook webhook not receiving leads:

1. Verify webhook URL is publicly accessible
2. Check webhook is "Verified" in Facebook
3. Ensure "leadgen" event is subscribed
4. Check server logs when Facebook sends test

### Inbound calls not working:

1. Verify VAPI phone number is correct
2. Check webhook URL is set in VAPI dashboard
3. Test by calling the number
4. Check server logs for incoming webhooks

### Campaign not starting:

1. Ensure leads exist with selected statuses
2. Check VAPI API key is configured
3. Verify agent_id is set
4. Check server logs for errors

---

## 🔒 Security Notes

1. **Never commit `.env.local`** - Add to `.gitignore`
2. **Use environment variables** - Don't hardcode API keys
3. **HTTPS required** - Facebook and VAPI require secure URLs
4. **Verify webhook signatures** - Production should verify Facebook signatures
5. **Row-Level Security** - Database policies ensure data isolation

---

## 📈 Best Practices

### GoHighLevel:
- Create custom fields in GHL for: `timeline`, `property_type`, `budget`
- Tag leads by source: `gnanova-lead`, `facebook`, `inbound`, `website`
- Set up automation in GHL based on tags

### Facebook Lead Ads:
- Use instant forms (not conversational)
- Keep form fields minimal (name, phone, email)
- Test webhook before running ads
- Monitor dashboard for lead quality

### Inbound Calls:
- Give VAPI number to all prospects
- Add to website, business cards, email signature
- Track call source in CRM
- Review transcripts regularly

### Campaigns:
- Start with small campaigns (10-20 leads)
- Test before large campaigns
- Space out campaigns (don't overwhelm leads)
- Review call transcripts for quality
- Adjust assistant prompts based on feedback

---

## 🎉 You're All Set!

Your Gnanova Real Estate AI now has:

✅ Facebook Lead Ads integration  
✅ GoHighLevel CRM sync  
✅ Inbound AI receptionist  
✅ Outbound campaign system  

**Next steps:**
1. Run your first Facebook ad campaign
2. Start receiving inbound calls
3. Create your first outbound campaign
4. Monitor results in dashboard
5. Close more deals! 🏆

---

## 💬 Support

If you encounter issues:

1. Check server logs: `npm run webhook`
2. Check database: Supabase Dashboard → Table Editor
3. Check VAPI logs: VAPI Dashboard → Logs
4. Review this guide
5. Check environment variables are set correctly

Happy selling! 🏠🚀

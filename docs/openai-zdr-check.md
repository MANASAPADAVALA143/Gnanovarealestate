# OpenAI Zero Data Retention (ZDR) — What To Do

## What ZDR means

By default, OpenAI may use your API inputs/outputs to improve their models. ZDR turns this off — your customer data (lead names, call preferences, budgets) is never used for training. Required for UAE PDPL compliance.

---

## Step 1 — Check your current plan

Log in at https://platform.openai.com

Go to: **Settings → Privacy**

Look for: **"Improve model for everyone"** or **"Data usage for model training"**

If it shows API data is used for training → you need to act.

---

## Step 2 — Options by account type

### Option A: Free / Pay-as-you-go (most common)

- ZDR is NOT available on free/PAYG plans by default
- OpenAI may use your data unless you opt out or upgrade
- **Action:** Upgrade to a paid plan and submit a ZDR request

### Option B: Paid API (usage-based billing)

- Submit a ZDR request at https://privacy.openai.com/policies
- Or email privacy@openai.com
- Subject: `Zero Data Retention request for API account [your org ID]`
- Response time: 5–10 business days

### Option C: Enterprise plan (recommended for production)

- ZDR is included and enabled by default
- Data is not retained beyond abuse-monitoring windows per contract
- Contact: https://openai.com/contact-sales

---

## Step 3 — Easiest alternative: Switch to Azure OpenAI

Azure OpenAI gives you enterprise data terms without a separate ZDR negotiation:

- Microsoft's data processing terms apply
- Your data stays in your chosen Azure region (UAE North available)
- Same API shape — change base URL and use Azure credentials

```env
OPENAI_API_KEY=your-azure-key
OPENAI_BASE_URL=https://YOUR-RESOURCE.openai.azure.com
OPENAI_API_VERSION=2024-02-01
AZURE_OPENAI_DEPLOYMENT=gpt-4o
```

### AWS Bedrock (already in this project for lead scoring)

- Claude via Bedrock is covered under your AWS account terms
- Gnanova already uses `@anthropic-ai/sdk` for outbound/speed-to-lead scoring
- **Recommendation:** use Bedrock Claude for listing writer and lead scoring to reduce OpenAI as a third party in your Privacy Policy

---

## Step 4 — What to tell UAE clients

> "All AI processing uses enterprise agreements with Zero Data Retention. Your leads' personal data is never used to train AI models."

Only say this after ZDR is confirmed with OpenAI, or after migrating sensitive workloads to Bedrock/Azure.

---

## Step 5 — Privacy Policy alignment

The Privacy Policy (Fix #1) states:

> "We have enabled data processing agreements with these providers to limit use of your data for model training purposes."

Make sure this is true before onboarding real customers. Run:

```bash
npm run security-audit
```

Then complete the manual ZDR steps above.

---

## Quick comparison

| Option | Effort | Cost | ZDR |
|--------|--------|------|-----|
| OpenAI ZDR request (email) | Low | Free API + wait 5–10 days | After approval |
| OpenAI Enterprise | Medium | Higher plan | Included |
| Azure OpenAI | Medium | Azure pricing | Enterprise terms |
| **AWS Bedrock Claude** | Low | You may already have AWS | Default under AWS BAA |

# OpenAI Zero Data Retention (ZDR) — What To Do

## What ZDR means
By default, OpenAI may use your API inputs/outputs to improve their models.
ZDR turns this off — your customer data (lead names, call preferences, budgets)
is never used for training. Required for UAE PDPL compliance.

---

## Step 1 — Check your current plan

Log in at https://platform.openai.com

Go to: **Settings → Privacy**

Look for: **"Improve model for everyone"** or **"Data usage for model training"**

If it shows API data is used for training → you need to act.

---

## Step 2 — Options by account type

### Option A: Free / Pay-as-you-go (most common)
- ZDR is NOT available on free/PAYG plans
- OpenAI may use your data by default
- **Action:** Upgrade to a paid plan and submit a ZDR request

### Option B: Paid API (usage-based billing)
- Submit a ZDR request at:
  https://privacy.openai.com/policies
- Or email: privacy@openai.com
- Subject: "Zero Data Retention request for API account [your org ID]"
- Response time: 5–10 business days

### Option C: Enterprise plan (recommended for production)
- ZDR is included and enabled by default
- Data is not retained beyond 30 days for abuse monitoring
- Contact: https://openai.com/contact-sales

---

## Step 3 — Easiest alternative: Switch to Azure OpenAI

Azure OpenAI gives you ZDR without any special agreement:
- Microsoft's data processing terms apply (enterprise-grade)
- Your data never leaves your Azure region
- UAE North region available (data stays in UAE)
- Same API — just change base URL + use Azure API key

In your code, change:
```
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://YOUR-RESOURCE.openai.azure.com
OPENAI_API_VERSION=2024-02-01
AZURE_OPENAI_DEPLOYMENT=gpt-4o  (or your deployment name)
```

For AWS Bedrock (you already use this for FinReportAI):
- Claude via Bedrock has ZDR by default under your AWS BAA
- Consider using Bedrock Claude for listing writer and lead scoring
  instead of OpenAI — you already have the infrastructure

---

## Step 4 — What to tell your UAE clients

Add to your sales conversations:
> "All AI processing uses enterprise agreements with Zero Data Retention.
> Your leads' personal data is never used to train AI models."

---

## Step 5 — Update your Privacy Policy

The privacy policy (Fix #1) already states:
> "We have enabled data processing agreements with these providers
> to limit use of your data for model training purposes."

Make sure this is true before you publish. Either confirm ZDR with OpenAI
or switch to Azure OpenAI / AWS Bedrock.

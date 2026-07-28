// ─────────────────────────────────────────────────────────────────────────────
// PATCH FOR YOUR EXISTING webhook-server.js
// Replace the relevant sections as shown below
// ─────────────────────────────────────────────────────────────────────────────

// ── STEP 1: Replace your imports at the top ──────────────────────────────────

const express = require("express");
const { rawBodyMiddleware } = require("./raw-body-middleware");
const {
  validateVapiSignature,
  validateTwilioSignature,
  rateLimiter,
} = require("./webhook-validation");

const app = express();

// ── STEP 2: Replace your body parsing middleware ──────────────────────────────
// DELETE any existing:   app.use(express.json())
// DELETE any existing:   app.use(express.urlencoded(...))
// ADD this instead:

app.use(rawBodyMiddleware);           // captures raw body for VAPI signature check
app.use(express.urlencoded({ extended: false })); // still needed for Twilio form-encoded payloads
app.use(rateLimiter);                // rate limit ALL routes

// ── STEP 3: Apply validation middleware to each route group ───────────────────

// VAPI webhooks — add validateVapiSignature to each
// BEFORE:  app.post("/vapi/webhook", async (req, res) => { ... })
// AFTER:
app.post("/vapi/webhook", validateVapiSignature, async (req, res) => {
  // your existing handler code — unchanged
});

app.post("/vapi/call-status", validateVapiSignature, async (req, res) => {
  // your existing handler code — unchanged
});

// VAPI initiate-call route — no signature needed (outbound, not inbound)
// but keep it rate-limited (already applied globally above)
app.post("/vapi/initiate-call", async (req, res) => {
  // your existing handler code — unchanged
});

// Twilio WhatsApp webhooks — add validateTwilioSignature to each
// BEFORE:  app.post("/whatsapp/inbound", async (req, res) => { ... })
// AFTER:
app.post("/whatsapp/inbound", validateTwilioSignature, async (req, res) => {
  // your existing handler code — unchanged
});

app.post("/whatsapp/status", validateTwilioSignature, async (req, res) => {
  // your existing handler code — unchanged
});

// Portal webhooks (Bayut / Property Finder) — validate shared secret
// These don't use cryptographic signatures so we use a simpler token check
app.post("/portal/bayut",           validatePortalSecret, async (req, res) => { /* ... */ });
app.post("/portal/property-finder", validatePortalSecret, async (req, res) => { /* ... */ });

// ── STEP 4: Add portal secret validator (simple token) ───────────────────────

function validatePortalSecret(req, res, next) {
  const secret = process.env.PORTAL_WEBHOOK_SECRET;
  const token  = req.headers["x-webhook-secret"] || req.headers["authorization"]?.replace("Bearer ", "");

  if (!secret) {
    if (process.env.NODE_ENV === "production") return res.status(500).json({ error: "Portal secret not configured" });
    return next(); // allow in dev
  }

  if (!token || token !== secret) {
    console.warn("[Portal] Invalid webhook secret");
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// ─────────────────────────────────────────────────────────────────────────────
// ENVIRONMENT VARIABLES TO ADD TO YOUR .env
// ─────────────────────────────────────────────────────────────────────────────
/*
  VAPI_WEBHOOK_SECRET=         # Get from VAPI dashboard → Webhooks → Signing Secret
  TWILIO_AUTH_TOKEN=           # Already in your env (same as TWILIO_AUTH_TOKEN used for sending)
  PORTAL_WEBHOOK_SECRET=       # Create a random string: openssl rand -hex 32
  NODE_ENV=production          # Set this on your server (EC2 / Render / Railway)
*/

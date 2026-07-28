// webhook-validation.js
// Drop this next to your webhook-server.js
// Validates VAPI and Twilio webhook signatures before processing

const crypto = require("crypto");
const twilio = require("twilio");

// ─── VAPI Signature Validation ────────────────────────────────────────────────
// VAPI signs every webhook with HMAC-SHA256 using your webhook secret
// Header: x-vapi-signature

function validateVapiSignature(req, res, next) {
  const secret = process.env.VAPI_WEBHOOK_SECRET;

  // If secret not configured, warn and skip in dev, block in prod
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error("[VAPI] VAPI_WEBHOOK_SECRET not set — blocking request");
      return res.status(500).json({ error: "Webhook secret not configured" });
    }
    console.warn("[VAPI] VAPI_WEBHOOK_SECRET not set — skipping validation (dev only)");
    return next();
  }

  const signature = req.headers["x-vapi-signature"];

  if (!signature) {
    console.warn("[VAPI] Missing x-vapi-signature header");
    return res.status(401).json({ error: "Missing signature" });
  }

  // VAPI sends raw body — must use express.raw() or store rawBody
  const rawBody = req.rawBody || JSON.stringify(req.body);

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  // Timing-safe comparison to prevent timing attacks
  const sigBuffer = Buffer.from(signature, "hex");
  const expBuffer = Buffer.from(expected, "hex");

  if (
    sigBuffer.length !== expBuffer.length ||
    !crypto.timingSafeEqual(sigBuffer, expBuffer)
  ) {
    console.warn("[VAPI] Signature mismatch — rejecting webhook");
    return res.status(401).json({ error: "Invalid signature" });
  }

  console.log("[VAPI] Signature valid ✓");
  next();
}

// ─── Twilio Signature Validation ─────────────────────────────────────────────
// Twilio signs every webhook with your Auth Token
// Header: x-twilio-signature

function validateTwilioSignature(req, res, next) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!authToken) {
    if (process.env.NODE_ENV === "production") {
      console.error("[Twilio] TWILIO_AUTH_TOKEN not set — blocking request");
      return res.status(500).json({ error: "Twilio auth token not configured" });
    }
    console.warn("[Twilio] TWILIO_AUTH_TOKEN not set — skipping validation (dev only)");
    return next();
  }

  // Build the full URL Twilio signed (must match exactly what Twilio POSTed to)
  const protocol = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const fullUrl = `${protocol}://${host}${req.originalUrl}`;

  const twilioSignature = req.headers["x-twilio-signature"];

  if (!twilioSignature) {
    console.warn("[Twilio] Missing x-twilio-signature header");
    return res.status(401).json({ error: "Missing Twilio signature" });
  }

  // Use Twilio's official validator
  const isValid = twilio.validateRequest(authToken, twilioSignature, fullUrl, req.body);

  if (!isValid) {
    console.warn("[Twilio] Signature invalid — rejecting webhook");
    return res.status(403).json({ error: "Invalid Twilio signature" });
  }

  console.log("[Twilio] Signature valid ✓");
  next();
}

// ─── Rate Limiter ─────────────────────────────────────────────────────────────
// Simple in-memory rate limiter — replace with Redis for multi-instance prod

const requestCounts = new Map();
const WINDOW_MS = 60 * 1000; // 1 minute window
const MAX_REQUESTS = 100;     // per IP per window

function rateLimiter(req, res, next) {
  const ip = req.headers["x-forwarded-for"]?.split(",")[0] || req.ip || "unknown";
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  if (!requestCounts.has(ip)) {
    requestCounts.set(ip, []);
  }

  // Remove old requests outside the window
  const timestamps = requestCounts.get(ip).filter((t) => t > windowStart);
  timestamps.push(now);
  requestCounts.set(ip, timestamps);

  if (timestamps.length > MAX_REQUESTS) {
    console.warn(`[RateLimit] IP ${ip} exceeded ${MAX_REQUESTS} req/min`);
    return res.status(429).json({ error: "Too many requests" });
  }

  next();
}

// Clean up old entries every 5 minutes to prevent memory leak
setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [ip, timestamps] of requestCounts.entries()) {
    const fresh = timestamps.filter((t) => t > cutoff);
    if (fresh.length === 0) requestCounts.delete(ip);
    else requestCounts.set(ip, fresh);
  }
}, 5 * 60 * 1000);

module.exports = { validateVapiSignature, validateTwilioSignature, rateLimiter };

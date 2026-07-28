#!/usr/bin/env node
// ============================================================
// Gnanova Security Audit Script
// Run: node security-audit.js
// Checks all env vars, OpenAI ZDR, and security config
// ============================================================

const https = require("https");
const fs = require("fs");
const path = require("path");

// Load .env.local if it exists
function loadEnv() {
  const envFiles = [".env.local", ".env"];
  for (const file of envFiles) {
    const fullPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      const lines = fs.readFileSync(fullPath, "utf8").split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const [key, ...rest] = trimmed.split("=");
        if (key && rest.length) process.env[key.trim()] = rest.join("=").trim();
      }
      console.log(`Loaded: ${file}\n`);
      break;
    }
  }
}

// ─── Result collector ─────────────────────────────────────
const results = { pass: [], warn: [], fail: [], info: [] };
function pass(msg) { results.pass.push(msg); }
function warn(msg) { results.warn.push(msg); }
function fail(msg) { results.fail.push(msg); }
function info(msg) { results.info.push(msg); }

// ─── Check helpers ────────────────────────────────────────
function checkRequired(key, description) {
  const val = process.env[key];
  if (!val || val.trim() === "") {
    fail(`MISSING  ${key}  — ${description}`);
    return null;
  }
  pass(`SET      ${key}`);
  return val;
}

function checkRecommended(key, description) {
  const val = process.env[key];
  if (!val || val.trim() === "") {
    warn(`MISSING  ${key}  — ${description} (recommended)`);
    return null;
  }
  pass(`SET      ${key}`);
  return val;
}

function checkNotPlaceholder(key, badValues = ["your-key-here", "xxx", "changeme", "placeholder", "todo"]) {
  const val = process.env[key];
  if (!val) return;
  const lower = val.toLowerCase();
  for (const bad of badValues) {
    if (lower.includes(bad)) {
      fail(`PLACEHOLDER  ${key}  — value looks like a placeholder, not a real secret`);
      return;
    }
  }
}

function checkMinLength(key, minLen) {
  const val = process.env[key];
  if (!val) return;
  if (val.length < minLen) {
    warn(`WEAK     ${key}  — only ${val.length} chars, expected at least ${minLen}`);
  }
}

// ─── 1. Core / Supabase ───────────────────────────────────
function checkSupabase() {
  console.log("── Supabase ─────────────────────────────────────────");
  checkRequired("SUPABASE_URL", "Supabase project URL");
  checkRequired("SUPABASE_SERVICE_ROLE_KEY", "Service role key (backend only)");
  checkRequired("VITE_SUPABASE_URL", "Supabase URL for frontend");
  checkRequired("VITE_SUPABASE_ANON_KEY", "Anon key for frontend");

  // Warn if service role key is exposed to frontend
  const srKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (srKey && anonKey && srKey === anonKey) {
    fail("CRITICAL  VITE_SUPABASE_ANON_KEY equals SERVICE_ROLE_KEY — never expose service role key to frontend");
  }

  // Check VITE_ keys don't include service role
  for (const [key, val] of Object.entries(process.env)) {
    if (key.startsWith("VITE_") && val === srKey) {
      fail(`CRITICAL  ${key} exposes SERVICE_ROLE_KEY to the browser — remove immediately`);
    }
  }

  checkNotPlaceholder("SUPABASE_SERVICE_ROLE_KEY");
  checkNotPlaceholder("VITE_SUPABASE_ANON_KEY");
}

// ─── 2. OpenAI ────────────────────────────────────────────
function checkOpenAI() {
  console.log("\n── OpenAI ───────────────────────────────────────────");
  const key = checkRequired("OPENAI_API_KEY", "OpenAI API key for embeddings + listing writer");

  if (key) {
    // Check it starts with sk- (real key format)
    if (!key.startsWith("sk-")) {
      warn("FORMAT   OPENAI_API_KEY — expected format: sk-... (may be invalid)");
    }

    // Check key length (OpenAI keys are ~51 chars for sk- or ~164 for sk-proj-)
    if (key.length < 40) {
      warn("WEAK     OPENAI_API_KEY — unusually short, verify it's correct");
    }

    info("ACTION   OpenAI ZDR — you must manually verify Zero Data Retention is active:");
    info("         1. Log in at platform.openai.com");
    info("         2. Go to Settings → Privacy");
    info("         3. Confirm 'Use data to improve our models' is OFF for API usage");
    info("         4. For enterprise ZDR: contact OpenAI sales or check your contract");
    info("         5. Alternatively: switch to Azure OpenAI (ZDR included by default)");
  }

  checkNotPlaceholder("OPENAI_API_KEY");
}

// ─── 3. VAPI ─────────────────────────────────────────────
function checkVAPI() {
  console.log("\n── VAPI ─────────────────────────────────────────────");
  checkRequired("VAPI_API_KEY", "VAPI API key for initiating calls");
  checkRecommended("VAPI_WEBHOOK_SECRET", "VAPI webhook signing secret — required for Fix #3 signature validation");
  checkRecommended("VAPI_ASSISTANT_ID", "Default VAPI assistant ID");
  checkRecommended("VAPI_PHONE_NUMBER_ID", "VAPI outbound phone number ID");
  checkNotPlaceholder("VAPI_API_KEY");

  const secret = process.env.VAPI_WEBHOOK_SECRET;
  if (secret) checkMinLength("VAPI_WEBHOOK_SECRET", 32);

  info("ACTION   VAPI data retention — check VAPI dashboard:");
  info("         Dashboard → Settings → Data Retention");
  info("         Set call recording retention to 90 days max (per your Privacy Policy)");
}

// ─── 4. Twilio ────────────────────────────────────────────
function checkTwilio() {
  console.log("\n── Twilio ───────────────────────────────────────────");
  checkRequired("TWILIO_ACCOUNT_SID", "Twilio account SID");
  checkRequired("TWILIO_AUTH_TOKEN", "Twilio auth token (also used for webhook validation)");
  checkRequired("TWILIO_WHATSAPP_NUMBER", "Twilio WhatsApp sender number e.g. whatsapp:+971XXXXXXXX");
  checkNotPlaceholder("TWILIO_AUTH_TOKEN");

  const sid = process.env.TWILIO_ACCOUNT_SID;
  if (sid && !sid.startsWith("AC")) {
    warn("FORMAT   TWILIO_ACCOUNT_SID — expected format: AC... (verify it's correct)");
  }

  const waNum = process.env.TWILIO_WHATSAPP_NUMBER;
  if (waNum && !waNum.startsWith("whatsapp:")) {
    warn("FORMAT   TWILIO_WHATSAPP_NUMBER — should be 'whatsapp:+971XXXXXXXXX' format");
  }
}

// ─── 5. Security / App ───────────────────────────────────
function checkSecurity() {
  console.log("\n── Security & App Config ────────────────────────────");
  checkRequired("NODE_ENV", "Set to 'production' on server");

  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv && nodeEnv !== "production") {
    warn(`ENV      NODE_ENV=${nodeEnv} — make sure this is 'production' on your deployed server`);
  }

  checkRecommended("PORTAL_WEBHOOK_SECRET", "Portal webhook shared secret (openssl rand -hex 32)");
  const portalSecret = process.env.PORTAL_WEBHOOK_SECRET;
  if (portalSecret) checkMinLength("PORTAL_WEBHOOK_SECRET", 32);

  checkRecommended("JWT_SECRET", "JWT signing secret if you use custom JWTs");
  const jwtSecret = process.env.JWT_SECRET;
  if (jwtSecret) checkMinLength("JWT_SECRET", 32);

  // Check for any VITE_ prefixed secrets that shouldn't be there
  const sensitivePatterns = ["SECRET", "SERVICE_ROLE", "AUTH_TOKEN", "PRIVATE"];
  for (const [key, val] of Object.entries(process.env)) {
    if (!key.startsWith("VITE_")) continue;
    for (const pattern of sensitivePatterns) {
      if (key.includes(pattern)) {
        fail(`CRITICAL  ${key} — sensitive key exposed to browser via VITE_ prefix`);
      }
    }
  }
}

// ─── 6. Optional integrations ────────────────────────────
function checkOptional() {
  console.log("\n── Optional Integrations ────────────────────────────");
  checkRecommended("CAL_COM_API_KEY", "Cal.com API key for real appointment slots");
  checkRecommended("NEXT_PUBLIC_APP_URL", "App URL for Next.js (used in webhook callbacks)");
  checkRecommended("VITE_APP_URL", "App URL for Vite frontend");
}

// ─── 7. OpenAI ZDR HTTP check ────────────────────────────
function checkOpenAIOrg() {
  return new Promise((resolve) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || !apiKey.startsWith("sk-")) {
      resolve();
      return;
    }

    console.log("\n── OpenAI API Connectivity ──────────────────────────");

    const options = {
      hostname: "api.openai.com",
      path: "/v1/models",
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 8000,
    };

    const req = https.request(options, (res) => {
      if (res.statusCode === 200) {
        pass("LIVE     OpenAI API key is valid and reachable");
        info("ACTION   To verify ZDR, log in at platform.openai.com → Settings → Privacy");
        info("         API usage data training opt-out must be confirmed manually");
      } else if (res.statusCode === 401) {
        fail("INVALID  OPENAI_API_KEY — API returned 401 Unauthorized");
      } else {
        warn(`UNKNOWN  OpenAI API returned status ${res.statusCode}`);
      }
      resolve();
    });

    req.on("error", () => {
      warn("OFFLINE  Could not reach api.openai.com — check network or key");
      resolve();
    });

    req.on("timeout", () => {
      warn("TIMEOUT  OpenAI API check timed out");
      req.destroy();
      resolve();
    });

    req.end();
  });
}

// ─── Print results ────────────────────────────────────────
function printResults() {
  const total = results.pass.length + results.warn.length + results.fail.length;

  console.log("\n════════════════════════════════════════════════════");
  console.log("  GNANOVA SECURITY AUDIT RESULTS");
  console.log("════════════════════════════════════════════════════\n");

  if (results.fail.length > 0) {
    console.log(`❌  CRITICAL ISSUES (${results.fail.length})`);
    results.fail.forEach((m) => console.log(`   ${m}`));
    console.log();
  }

  if (results.warn.length > 0) {
    console.log(`⚠️   WARNINGS (${results.warn.length})`);
    results.warn.forEach((m) => console.log(`   ${m}`));
    console.log();
  }

  if (results.pass.length > 0) {
    console.log(`✅  PASSED (${results.pass.length})`);
    results.pass.forEach((m) => console.log(`   ${m}`));
    console.log();
  }

  if (results.info.length > 0) {
    console.log(`ℹ️   MANUAL ACTIONS REQUIRED`);
    results.info.forEach((m) => console.log(`   ${m}`));
    console.log();
  }

  console.log("────────────────────────────────────────────────────");
  console.log(`  Score: ${results.pass.length}/${total} checks passed`);

  if (results.fail.length === 0 && results.warn.length === 0) {
    console.log("  🎉 All checks passed — ready for real customer data");
  } else if (results.fail.length === 0) {
    console.log("  ⚠️  No critical failures — review warnings before production");
  } else {
    console.log(`  ❌  ${results.fail.length} critical issue(s) must be fixed before real customer data`);
  }
  console.log("════════════════════════════════════════════════════\n");
}

// ─── Main ─────────────────────────────────────────────────
async function main() {
  console.log("\n════════════════════════════════════════════════════");
  console.log("  GNANOVA SECURITY AUDIT");
  console.log("  Checking env vars, keys, and security config...");
  console.log("════════════════════════════════════════════════════\n");

  loadEnv();
  checkSupabase();
  checkOpenAI();
  checkVAPI();
  checkTwilio();
  checkSecurity();
  checkOptional();
  await checkOpenAIOrg();
  printResults();
}

main().catch(console.error);

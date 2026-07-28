#!/usr/bin/env tsx
/**
 * Gnanova security audit — env vars, exposed secrets, OpenAI connectivity, ZDR reminders.
 * Run: npm run security-audit
 */

import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import https from 'https'

const results = { pass: [] as string[], warn: [] as string[], fail: [] as string[], info: [] as string[] }

function pass(msg: string) {
  results.pass.push(msg)
}
function warn(msg: string) {
  results.warn.push(msg)
}
function fail(msg: string) {
  results.fail.push(msg)
}
function info(msg: string) {
  results.info.push(msg)
}

function loadEnvFiles() {
  for (const file of ['.env', '.env.local']) {
    const fullPath = resolve(process.cwd(), file)
    if (!existsSync(fullPath)) continue
    const lines = readFileSync(fullPath, 'utf8').split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      let val = trimmed.slice(eq + 1).trim()
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1)
      }
      if (key) process.env[key] = val
    }
    console.log(`Loaded: ${file}`)
  }
  console.log()
}

function envVal(...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = process.env[k]?.trim()
    if (v) return v
  }
  return undefined
}

function checkRequired(key: string, description: string, aliases: string[] = []): string | null {
  const val = envVal(key, ...aliases)
  if (!val) {
    fail(`MISSING  ${key}  — ${description}`)
    return null
  }
  pass(`SET      ${key}`)
  return val
}

function checkRecommended(key: string, description: string, aliases: string[] = []): string | null {
  const val = envVal(key, ...aliases)
  if (!val) {
    warn(`MISSING  ${key}  — ${description} (recommended)`)
    return null
  }
  pass(`SET      ${key}`)
  return val
}

function checkNotPlaceholder(
  key: string,
  badValues = ['your-key-here', 'xxx', 'changeme', 'placeholder', 'todo', 'replace_me']
) {
  const val = process.env[key]
  if (!val) return
  const lower = val.toLowerCase()
  for (const bad of badValues) {
    if (lower.includes(bad)) {
      fail(`PLACEHOLDER  ${key}  — value looks like a placeholder, not a real secret`)
      return
    }
  }
}

function checkMinLength(key: string, minLen: number) {
  const val = process.env[key]
  if (!val) return
  if (val.length < minLen) {
    warn(`WEAK     ${key}  — only ${val.length} chars, expected at least ${minLen}`)
  }
}

function checkSupabase() {
  console.log('── Supabase ─────────────────────────────────────────')
  checkRequired('SUPABASE_URL', 'Supabase project URL (backend)')
  checkRequired('SUPABASE_SERVICE_ROLE_KEY', 'Service role key — backend only, never in browser')

  const viteUrl = checkRequired('VITE_SUPABASE_URL', 'Supabase URL for Vite frontend', ['SUPABASE_URL'])
  checkRequired('VITE_SUPABASE_ANON_KEY', 'Anon key for frontend', ['SUPABASE_ANON_KEY'])

  const srKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = envVal('VITE_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY')

  if (srKey && anonKey && srKey === anonKey) {
    fail('CRITICAL  VITE_SUPABASE_ANON_KEY equals SERVICE_ROLE_KEY — never expose service role to frontend')
  }

  for (const [key, val] of Object.entries(process.env)) {
    if (!key.startsWith('VITE_') || !srKey) continue
    if (val === srKey) {
      fail(`CRITICAL  ${key} exposes SERVICE_ROLE_KEY to the browser — remove immediately`)
    }
  }

  if (process.env.VITE_SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    fail('CRITICAL  VITE_SUPABASE_SERVICE_ROLE_KEY — service role must never use VITE_ prefix')
  }

  checkNotPlaceholder('SUPABASE_SERVICE_ROLE_KEY')
  checkNotPlaceholder('VITE_SUPABASE_ANON_KEY')

  void viteUrl
}

function checkOpenAI() {
  console.log('\n── OpenAI ───────────────────────────────────────────')
  const key = checkRequired('OPENAI_API_KEY', 'OpenAI API key for embeddings + listing writer')

  if (key) {
    if (!key.startsWith('sk-')) {
      warn('FORMAT   OPENAI_API_KEY — expected format: sk-... or sk-proj-...')
    }
    if (key.length < 40) {
      warn('WEAK     OPENAI_API_KEY — unusually short, verify it is correct')
    }

    info('ACTION   OpenAI ZDR — see docs/openai-zdr-check.md')
    info('         platform.openai.com → Settings → Privacy → confirm API data is not used for training')
    info('         Or use AWS Bedrock / Azure OpenAI for ZDR-by-default processing')
  }

  checkNotPlaceholder('OPENAI_API_KEY')

  const anthropic = envVal('ANTHROPIC_API_KEY')
  if (anthropic) {
    pass('SET      ANTHROPIC_API_KEY (Bedrock/Claude alternative available)')
  } else {
    info('OPTION   ANTHROPIC_API_KEY not set — consider Bedrock Claude for ZDR-friendly lead scoring')
  }
}

function checkVapi() {
  console.log('\n── VAPI ─────────────────────────────────────────────')
  checkRecommended('VAPI_API_KEY', 'VAPI API key for initiating calls')
  checkRecommended('VAPI_WEBHOOK_SECRET', 'Webhook signing secret — required in production (Fix #3)')
  checkRecommended('VAPI_ASSISTANT_ID', 'Default VAPI assistant ID')
  checkRecommended('VAPI_PHONE_NUMBER_ID', 'VAPI outbound phone number ID')
  checkNotPlaceholder('VAPI_API_KEY')

  const secret = process.env.VAPI_WEBHOOK_SECRET
  if (secret) checkMinLength('VAPI_WEBHOOK_SECRET', 16)

  info('ACTION   VAPI data retention — Dashboard → Settings → set recording retention ≤ 90 days')
}

function checkTwilio() {
  console.log('\n── Twilio ───────────────────────────────────────────')
  checkRecommended('TWILIO_ACCOUNT_SID', 'Twilio account SID')
  checkRecommended('TWILIO_AUTH_TOKEN', 'Twilio auth token (also used for webhook validation)')
  checkRecommended(
    'TWILIO_WHATSAPP_FROM',
    'WhatsApp sender e.g. whatsapp:+971XXXXXXXX',
    ['TWILIO_WHATSAPP_NUMBER']
  )
  checkNotPlaceholder('TWILIO_AUTH_TOKEN')

  const sid = process.env.TWILIO_ACCOUNT_SID
  if (sid && !sid.startsWith('AC')) {
    warn('FORMAT   TWILIO_ACCOUNT_SID — expected format: AC...')
  }

  const waNum = envVal('TWILIO_WHATSAPP_FROM', 'TWILIO_WHATSAPP_NUMBER')
  if (waNum && !waNum.startsWith('whatsapp:')) {
    warn('FORMAT   TWILIO_WHATSAPP_FROM — should be whatsapp:+971XXXXXXXXX')
  }
}

function checkSecurity() {
  console.log('\n── Security & App Config ────────────────────────────')

  const nodeEnv = process.env.NODE_ENV
  if (!nodeEnv) {
    warn("MISSING  NODE_ENV — set to 'production' on your deployed server")
  } else if (nodeEnv !== 'production') {
    warn(`ENV      NODE_ENV=${nodeEnv} — use 'production' on deployed server`)
  } else {
    pass('SET      NODE_ENV=production')
  }

  const portalSecret = envVal('PORTAL_WEBHOOK_SECRET', 'WEBHOOK_SECRET')
  if (portalSecret) {
    pass('SET      PORTAL_WEBHOOK_SECRET or WEBHOOK_SECRET')
    if (portalSecret.length < 32) {
      warn('WEAK     Portal webhook secret — use at least 32 chars (openssl rand -hex 32)')
    }
  } else {
    warn('MISSING  PORTAL_WEBHOOK_SECRET / WEBHOOK_SECRET — portal intake webhook auth')
  }

  checkRecommended('REALTOR_WEBHOOK_SECRET', 'Realtor.com portal HMAC secret')
  checkRecommended('ZILLOW_WEBHOOK_SECRET', 'Zillow portal query secret')
  checkRecommended('JWT_SECRET', 'Custom JWT signing secret (if used)')
  if (process.env.JWT_SECRET) checkMinLength('JWT_SECRET', 32)

  const sensitivePatterns = ['SECRET', 'SERVICE_ROLE', 'AUTH_TOKEN', 'PRIVATE']
  for (const [key] of Object.entries(process.env)) {
    if (!key.startsWith('VITE_')) continue
    for (const pattern of sensitivePatterns) {
      if (key.includes(pattern)) {
        fail(`CRITICAL  ${key} — sensitive key exposed to browser via VITE_ prefix`)
      }
    }
  }

  if (process.env.VITE_OPENAI_API_KEY?.trim()) {
    fail('CRITICAL  VITE_OPENAI_API_KEY — OpenAI key must stay server-side only')
  }
}

function checkOptional() {
  console.log('\n── Optional Integrations ────────────────────────────')
  checkRecommended('CAL_COM_API_KEY', 'Cal.com API key for appointment slots')
  checkRecommended('NEXT_PUBLIC_APP_URL', 'Next.js public app URL (webhook callbacks)')
  checkRecommended('VITE_APP_URL', 'Vite frontend URL')
  checkRecommended('VITE_NEXT_APP_URL', 'Next.js dashboard URL from Vite sidebar')
}

function checkOpenAIConnectivity(): Promise<void> {
  return new Promise((resolve) => {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey?.startsWith('sk-')) {
      resolve()
      return
    }

    console.log('\n── OpenAI API Connectivity ──────────────────────────')

    const req = https.request(
      {
        hostname: 'api.openai.com',
        path: '/v1/models',
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 8000,
      },
      (res) => {
        if (res.statusCode === 200) {
          pass('LIVE     OpenAI API key is valid and reachable')
        } else if (res.statusCode === 401) {
          fail('INVALID  OPENAI_API_KEY — API returned 401 Unauthorized')
        } else {
          warn(`UNKNOWN  OpenAI API returned status ${res.statusCode}`)
        }
        res.resume()
        resolve()
      }
    )

    req.on('error', () => {
      warn('OFFLINE  Could not reach api.openai.com — check network or key')
      resolve()
    })

    req.on('timeout', () => {
      warn('TIMEOUT  OpenAI API check timed out')
      req.destroy()
      resolve()
    })

    req.end()
  })
}

function printResults() {
  const total = results.pass.length + results.warn.length + results.fail.length

  console.log('\n════════════════════════════════════════════════════')
  console.log('  GNANOVA SECURITY AUDIT RESULTS')
  console.log('════════════════════════════════════════════════════\n')

  if (results.fail.length > 0) {
    console.log(`❌  CRITICAL ISSUES (${results.fail.length})`)
    results.fail.forEach((m) => console.log(`   ${m}`))
    console.log()
  }

  if (results.warn.length > 0) {
    console.log(`⚠️   WARNINGS (${results.warn.length})`)
    results.warn.forEach((m) => console.log(`   ${m}`))
    console.log()
  }

  if (results.pass.length > 0) {
    console.log(`✅  PASSED (${results.pass.length})`)
    results.pass.forEach((m) => console.log(`   ${m}`))
    console.log()
  }

  if (results.info.length > 0) {
    console.log('ℹ️   MANUAL ACTIONS REQUIRED')
    results.info.forEach((m) => console.log(`   ${m}`))
    console.log()
  }

  console.log('────────────────────────────────────────────────────')
  console.log(`  Score: ${results.pass.length}/${total} checks passed`)

  if (results.fail.length === 0 && results.warn.length === 0) {
    console.log('  🎉 All checks passed — ready for real customer data')
  } else if (results.fail.length === 0) {
    console.log('  ⚠️  No critical failures — review warnings before production')
  } else {
    console.log(`  ❌  ${results.fail.length} critical issue(s) must be fixed before real customer data`)
  }
  console.log('════════════════════════════════════════════════════\n')
}

async function main() {
  console.log('\n════════════════════════════════════════════════════')
  console.log('  GNANOVA SECURITY AUDIT')
  console.log('  Checking env vars, keys, and security config...')
  console.log('════════════════════════════════════════════════════\n')

  loadEnvFiles()
  checkSupabase()
  checkOpenAI()
  checkVapi()
  checkTwilio()
  checkSecurity()
  checkOptional()
  await checkOpenAIConnectivity()
  printResults()

  process.exit(results.fail.length > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

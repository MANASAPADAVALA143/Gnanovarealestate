#!/usr/bin/env tsx
/**
 * Validate .env.local file has required variables
 */

import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
}

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

interface EnvVar {
  name: string
  required: boolean
  description: string
  validate?: (value: string) => boolean
  getUrl?: string
}

const requiredVars: EnvVar[] = [
  {
    name: 'SUPABASE_URL',
    required: true,
    description: 'Supabase project URL',
    validate: (v) => v.startsWith('https://') && v.includes('.supabase.co'),
    getUrl: 'https://supabase.com/dashboard → Settings → API',
  },
  {
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    required: true,
    description: 'Supabase service role key',
    validate: (v) => v.startsWith('eyJ') && v.length > 100,
    getUrl: 'https://supabase.com/dashboard → Settings → API (service_role key)',
  },
  {
    name: 'OPENAI_API_KEY',
    required: true,
    description: 'OpenAI API key for embeddings',
    validate: (v) => v.startsWith('sk-') && v.length > 20,
    getUrl: 'https://platform.openai.com/api-keys',
  },
]

const optionalVars: EnvVar[] = [
  {
    name: 'VAPI_API_KEY',
    required: false,
    description: 'VAPI API key (for voice calls)',
    getUrl: 'https://dashboard.vapi.ai → Settings → API Keys',
  },
  {
    name: 'VAPI_PHONE_NUMBER_ID',
    required: false,
    description: 'VAPI phone number ID',
    getUrl: 'https://dashboard.vapi.ai',
  },
  {
    name: 'TWILIO_ACCOUNT_SID',
    required: false,
    description: 'Twilio account SID (for WhatsApp)',
    getUrl: 'https://console.twilio.com → Account Info',
  },
  {
    name: 'TWILIO_AUTH_TOKEN',
    required: false,
    description: 'Twilio auth token',
    getUrl: 'https://console.twilio.com → Account Info',
  },
  {
    name: 'WEBHOOK_SECRET',
    required: false,
    description: 'Header x-webhook-secret for /api/leads/portal-intake (n8n speed-to-lead)',
  },
]

function loadEnvFile(): Record<string, string> {
  const envPath = resolve('.env.local')
  const env: Record<string, string> = {}

  if (!existsSync(envPath)) {
    log('\n❌ .env.local file not found!', 'red')
    log('\n💡 Create .env.local file in project root', 'yellow')
    log('   Copy content from: env-template.txt', 'yellow')
    return env
  }

  try {
    const content = readFileSync(envPath, 'utf-8')
    content.split('\n').forEach((line) => {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const match = trimmed.match(/^([^#=]+)=(.*)$/)
        if (match) {
          const key = match[1].trim()
          const value = match[2].trim().replace(/^["']|["']$/g, '')
          env[key] = value
        }
      }
    })
  } catch (error: any) {
    log(`\n❌ Error reading .env.local: ${error.message}`, 'red')
  }

  return env
}

function validateVar(env: Record<string, string>, varDef: EnvVar): boolean {
  const value = env[varDef.name]

  if (!value || value === 'REPLACE_ME' || value.includes('REPLACE_ME')) {
    if (varDef.required) {
      log(`❌ ${varDef.name}: Missing or not configured`, 'red')
      log(`   ${varDef.description}`, 'yellow')
      if (varDef.getUrl) {
        log(`   Get from: ${varDef.getUrl}`, 'cyan')
      }
      return false
    } else {
      log(`⚠️  ${varDef.name}: Not set (optional)`, 'yellow')
      return true
    }
  }

  if (varDef.validate && !varDef.validate(value)) {
    log(`⚠️  ${varDef.name}: Invalid format`, 'yellow')
    log(`   Current value: ${value.substring(0, 20)}...`, 'yellow')
    if (varDef.getUrl) {
      log(`   Get from: ${varDef.getUrl}`, 'cyan')
    }
    return false
  }

  log(`✅ ${varDef.name}: Configured`, 'green')
  return true
}

async function main() {
  console.log('\n🔍 Validating .env.local Configuration...\n')
  console.log('='.repeat(60))

  const env = loadEnvFile()

  if (Object.keys(env).length === 0) {
    return
  }

  console.log('\n📋 Required Variables:\n')
  const requiredResults = requiredVars.map((v) => validateVar(env, v))
  const requiredPassed = requiredResults.filter((r) => r).length

  console.log('\n📋 Optional Variables:\n')
  const optionalResults = optionalVars.map((v) => validateVar(env, v))
  const optionalSet = optionalResults.filter((r) => r).length

  console.log('\n' + '='.repeat(60))
  log(
    `\nResults: ${requiredPassed}/${requiredVars.length} required variables configured`,
    requiredPassed === requiredVars.length ? 'green' : 'red',
  )

  if (optionalSet > 0) {
    log(`Optional: ${optionalSet}/${optionalVars.length} variables set`, 'cyan')
  }

  if (requiredPassed === requiredVars.length) {
    log('\n✅ All required variables are configured!', 'green')
    log('💡 You can now run: npm run verify', 'cyan')
  } else {
    const missingOpenAI = !env['OPENAI_API_KEY'] || env['OPENAI_API_KEY'].includes('REPLACE_ME')
    const missingSupabase = !env['SUPABASE_URL'] || env['SUPABASE_URL'].includes('REPLACE_ME')
    
    if (missingOpenAI && !missingSupabase) {
      log('\n⚠️  OpenAI API key not set (can add later)', 'yellow')
      log('✅ Supabase is configured - you can test database setup!', 'green')
      log('\n📝 What works now:', 'cyan')
      log('   ✅ Database migrations', 'green')
      log('   ✅ Supabase connection tests', 'green')
      log('   ✅ Server startup', 'green')
      log('\n📝 What needs OpenAI key:', 'yellow')
      log('   ❌ Property embeddings generation', 'yellow')
      log('   ❌ RAG property search', 'yellow')
      log('   ❌ Loading properties with embeddings', 'yellow')
      log('\n💡 Add OpenAI key later:', 'cyan')
      log('   1. Get key from: https://platform.openai.com/api-keys', 'cyan')
      log('   2. Add to .env.local: OPENAI_API_KEY=sk-proj-...', 'cyan')
      log('   3. Then run: npm run load-properties', 'cyan')
    } else {
      log('\n❌ Missing required variables. Please configure them:', 'red')
      log('\n📝 Steps:', 'yellow')
      log('   1. Open .env.local file', 'yellow')
      log('   2. Replace REPLACE_ME with your actual credentials', 'yellow')
      log('   3. See SETUP_ENV_GUIDE.md for detailed instructions', 'yellow')
      log('   4. Restart terminal after editing', 'yellow')
    }
  }

  console.log('')
}

main().catch(console.error)

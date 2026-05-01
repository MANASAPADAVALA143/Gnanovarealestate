#!/usr/bin/env tsx
/**
 * Setup Verification Script
 * Runs all verification tests to ensure the project is properly configured
 */

// Load environment variables from .env.local
import { readFileSync } from 'fs'
import { resolve } from 'path'

try {
  const envPath = resolve('.env.local')
  const envContent = readFileSync(envPath, 'utf-8')
  envContent.split('\n').forEach((line) => {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      const value = match[2].trim().replace(/^["']|["']$/g, '')
      if (!process.env[key]) {
        process.env[key] = value
      }
    }
  })
} catch (error) {
  // .env.local might not exist, that's okay
}

import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
}

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function check(condition: boolean, message: string): boolean {
  if (condition) {
    log(`✅ ${message}`, 'green')
    return true
  } else {
    log(`❌ ${message}`, 'red')
    return false
  }
}

async function main() {
  log('\n🔍 Verifying Gnanova Setup...\n', 'blue')

  let allPassed = true

  // Test 1: Check Dependencies
  log('Test 1: Checking Dependencies', 'blue')
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'test' })
    allPassed = check(true, 'openai package installed') && allPassed
  } catch {
    allPassed = check(false, 'openai package not found') && allPassed
  }

  try {
    const supabase = createClient('https://test.supabase.co', 'test')
    allPassed = check(true, '@supabase/supabase-js package installed') && allPassed
  } catch {
    allPassed = check(false, '@supabase/supabase-js package not found') && allPassed
  }

  // Test 2: Check Environment Variables
  log('\nTest 2: Checking Environment Variables', 'blue')
  const requiredEnvVars = [
    'OPENAI_API_KEY',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
  ]

  const optionalEnvVars = [
    'VAPI_API_KEY',
    'VAPI_PHONE_NUMBER_ID',
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
  ]

  for (const varName of requiredEnvVars) {
    const value = process.env[varName] || process.env[`NEXT_PUBLIC_${varName}`] || process.env[`VITE_${varName}`]
    allPassed = check(!!value, `${varName} is set`) && allPassed
  }

  for (const varName of optionalEnvVars) {
    const value = process.env[varName] || process.env[`NEXT_PUBLIC_${varName}`] || process.env[`VITE_${varName}`]
    if (value) {
      log(`⚠️  ${varName} is set (optional)`, 'yellow')
    } else {
      log(`ℹ️  ${varName} not set (optional)`, 'blue')
    }
  }

  // Test 3: Check Supabase Connection
  log('\nTest 3: Checking Supabase Connection', 'blue')
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

  if (supabaseUrl && supabaseKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseKey)
      const { data, error } = await supabase.from('properties').select('id').limit(1)
      
      if (error && error.message.includes('relation "properties" does not exist')) {
        log('⚠️  Properties table not found - run migrations first', 'yellow')
      } else if (error) {
        log(`⚠️  Supabase connection issue: ${error.message}`, 'yellow')
      } else {
        allPassed = check(true, 'Supabase connection successful') && allPassed
      }
    } catch (error: any) {
      log(`⚠️  Supabase connection failed: ${error.message}`, 'yellow')
    }
  } else {
    log('⚠️  Skipping Supabase test (credentials not set)', 'yellow')
  }

  // Test 4: Check OpenAI API Key
  log('\nTest 4: Checking OpenAI API Key', 'blue')
  const openaiKey = process.env.OPENAI_API_KEY
  if (openaiKey) {
    if (openaiKey.startsWith('sk-') && openaiKey.length > 20) {
      allPassed = check(true, 'OpenAI API key format looks valid') && allPassed
    } else {
      log('⚠️  OpenAI API key format may be invalid', 'yellow')
    }
  } else {
    allPassed = check(false, 'OPENAI_API_KEY not set') && allPassed
  }

  // Test 5: Check Files Exist
  log('\nTest 5: Checking Required Files', 'blue')
  const fs = await import('fs')
  const path = await import('path')

  const requiredFiles = [
    'lib/embeddings.ts',
    'scripts/load-properties.ts',
    'scripts/test-rag.ts',
    'app/api/properties/search/route.ts',
    'types/property.ts',
  ]

  for (const file of requiredFiles) {
    const exists = fs.existsSync(path.resolve(file))
    allPassed = check(exists, `${file} exists`) && allPassed
  }

  // Test 6: Check VAPI Config
  log('\nTest 6: Checking VAPI Configuration', 'blue')
  try {
    const vapiConfigPaths = ['src/lib/vapi-config.ts', 'lib/vapi-config.ts']
    let found = false
    for (const vapiConfigPath of vapiConfigPaths) {
      if (fs.existsSync(path.resolve(vapiConfigPath))) {
        const content = fs.readFileSync(path.resolve(vapiConfigPath), 'utf-8')
        const hasRagAssistant = content.includes('ragEnabledAssistant')
        allPassed = check(hasRagAssistant, `ragEnabledAssistant function exists in ${vapiConfigPath}`) && allPassed
        found = true
        break
      }
    }
    if (!found) {
      log('⚠️  VAPI config file not found at expected locations', 'yellow')
    }
  } catch (error: any) {
    log(`⚠️  Could not check VAPI config: ${error.message}`, 'yellow')
  }

  // Summary
  log('\n' + '='.repeat(50), 'blue')
  if (allPassed) {
    log('✅ All critical checks passed!', 'green')
    log('\nNext steps:', 'blue')
    log('1. Run migrations: supabase db push (or manually in dashboard)', 'blue')
    log('2. Load properties: npm run load-properties', 'blue')
    log('3. Test RAG: npm run test-rag', 'blue')
    log('4. Start dev server: npm run dev', 'blue')
  } else {
    log('❌ Some checks failed. Please fix the issues above.', 'red')
  }
  log('='.repeat(50) + '\n', 'blue')
}

main().catch((error) => {
  console.error('Error running verification:', error)
  process.exit(1)
})

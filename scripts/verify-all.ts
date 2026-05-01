#!/usr/bin/env tsx
/**
 * Master Verification Script
 * Runs all tests to verify the Gnanova setup
 */

import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

// Load environment variables
try {
  const envPath = resolve('.env.local')
  if (existsSync(envPath)) {
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
  }
} catch {}

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
}

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function section(title: string) {
  console.log('\n' + '='.repeat(60))
  log(title, 'cyan')
  console.log('='.repeat(60))
}

async function test(name: string, fn: () => Promise<boolean>): Promise<boolean> {
  try {
    const result = await fn()
    if (result) {
      log(`✅ ${name}`, 'green')
      return true
    } else {
      log(`❌ ${name}`, 'red')
      return false
    }
  } catch (error: any) {
      log(`❌ ${name}: ${error.message}`, 'red')
      return false
  }
}

// Test 1: Dependencies
async function testDependencies() {
  section('PHASE 1: RAG SYSTEM - Dependencies')
  
  const results: boolean[] = []
  
  results.push(await test('openai package installed', async () => {
    try {
      await import('openai')
      return true
    } catch {
      return false
    }
  }))
  
  results.push(await test('@supabase/supabase-js package installed', async () => {
    try {
      await import('@supabase/supabase-js')
      return true
    } catch {
      return false
    }
  }))
  
  return results.every(r => r)
}

// Test 2: Environment Variables
async function testEnvironmentVariables() {
  section('PHASE 1: Environment Variables')
  
  const required = [
    'OPENAI_API_KEY',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
  ]
  
  const optional = [
    'VAPI_API_KEY',
    'VAPI_PHONE_NUMBER_ID',
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'TWILIO_WHATSAPP_FROM',
  ]
  
  const results: boolean[] = []
  
  for (const key of required) {
    const value = process.env[key] || 
                  process.env[`NEXT_PUBLIC_${key}`] || 
                  process.env[`VITE_${key}`]
    results.push(await test(`${key} is set`, async () => !!value))
  }
  
  console.log('\nOptional variables:')
  for (const key of optional) {
    const value = process.env[key] || 
                  process.env[`NEXT_PUBLIC_${key}`] || 
                  process.env[`VITE_${key}`]
    if (value) {
      log(`  ✅ ${key} is set`, 'green')
    } else {
      log(`  ⚠️  ${key} not set (optional)`, 'yellow')
    }
  }
  
  return results.every(r => r)
}

// Test 3: Files Exist
async function testFilesExist() {
  section('PHASE 1: Required Files')
  
  const files = [
    'lib/embeddings.ts',
    'scripts/load-properties.ts',
    'scripts/test-rag.ts',
    'app/api/properties/search/route.ts',
    'types/property.ts',
    'supabase/migrations/001_enable_pgvector.sql',
  ]
  
  const results: boolean[] = []
  
  for (const file of files) {
    results.push(await test(`${file} exists`, async () => {
      return existsSync(resolve(file))
    }))
  }
  
  return results.every(r => r)
}

// Test 4: VAPI Config
async function testVapiConfig() {
  section('PHASE 2: VAPI Integration')
  
  const configPaths = ['src/lib/vapi-config.ts', 'lib/vapi-config.ts']
  let found = false
  let checkedPath = ''
  
  for (const path of configPaths) {
    const fullPath = resolve(path)
    if (existsSync(fullPath)) {
      checkedPath = path
      const content = readFileSync(fullPath, 'utf-8')
      const hasRag = content.includes('ragEnabledAssistant')
      found = await test(`ragEnabledAssistant in ${path}`, async () => hasRag)
      if (hasRag) {
        log(`  ✅ Found ragEnabledAssistant function`, 'green')
      } else {
        log(`  ⚠️  File exists but ragEnabledAssistant not found`, 'yellow')
      }
      break
    }
  }
  
  if (!found && !checkedPath) {
    log('⚠️  VAPI config file not found at expected locations', 'yellow')
    log('  Checked: src/lib/vapi-config.ts, lib/vapi-config.ts', 'yellow')
  }
  
  return found
}

// Test 5: API Endpoints (if server running)
async function testApiEndpoints() {
  section('PHASE 1 & 2: API Endpoints')
  
  const baseUrl = process.env.NEXT_API_BASE_URL || 'http://localhost:3000'
  const expressUrl = process.env.EXPRESS_BASE_URL || 'http://localhost:3001'
  
  const results: boolean[] = []
  
  // Test property search
  results.push(await test('Property Search API accessible', async () => {
    try {
      const response = await fetch(`${baseUrl}/api/properties/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'test' }),
      })
      return response.status !== 0 // Any response means server is running
    } catch {
      return false
    }
  }))
  
  // Test VAPI functions
  results.push(await test('VAPI Functions API accessible', async () => {
    try {
      const response = await fetch(`${baseUrl}/api/vapi/functions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: { type: 'function-call' } }),
      })
      return response.status !== 0
    } catch {
      return false
    }
  }))
  
  // Test Express server
  results.push(await test('Express server accessible', async () => {
    try {
      const response = await fetch(`${expressUrl}/health`)
      return response.ok
    } catch {
      return false
    }
  }))
  
  return results.some(r => r) // At least one should work
}

// Test 6: Database Connection
async function testDatabase() {
  section('PHASE 1: Database Connection')
  
  const supabaseUrl = process.env.SUPABASE_URL || 
                      process.env.NEXT_PUBLIC_SUPABASE_URL || 
                      process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                      process.env.SUPABASE_SERVICE_KEY
  
  if (!supabaseUrl || !supabaseKey) {
    log('⚠️  Skipping database tests (credentials not set)', 'yellow')
    return false
  }
  
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    const results: boolean[] = []
    
    // Test connection
    results.push(await test('Supabase connection works', async () => {
      const { error } = await supabase.from('properties').select('id').limit(1)
      if (error && error.message.includes('relation "properties" does not exist')) {
        log('  ⚠️  Properties table not found - run migrations', 'yellow')
        return false
      }
      return !error
    }))
    
    // Test properties loaded
    results.push(await test('Properties table has data', async () => {
      const { count, error } = await supabase
        .from('properties')
        .select('*', { count: 'exact', head: true })
      
      if (error) return false
      if ((count ?? 0) === 0) {
        log('  ⚠️  No properties found - run: npm run load-properties', 'yellow')
        return false
      }
      log(`  ✅ Found ${count} properties`, 'green')
      return true
    }))
    
    // Test embeddings
    results.push(await test('Properties have embeddings', async () => {
      const { count, error } = await supabase
        .from('properties')
        .select('embedding', { count: 'exact', head: true })
        .not('embedding', 'is', null)
      
      if (error) return false
      if ((count ?? 0) === 0) {
        log('  ⚠️  No embeddings found - run: npm run load-properties', 'yellow')
        return false
      }
      log(`  ✅ ${count} properties have embeddings`, 'green')
      return true
    }))
    
    return results.every(r => r)
  } catch (error: any) {
    log(`❌ Database test failed: ${error.message}`, 'red')
    return false
  }
}

// Main execution
async function main() {
  console.log('\n')
  log('🔍 GNANOVA VERIFICATION & HEALTH CHECK', 'cyan')
  log('='.repeat(60), 'cyan')
  
  const results = {
    dependencies: false,
    envVars: false,
    files: false,
    vapiConfig: false,
    apiEndpoints: false,
    database: false,
  }
  
  results.dependencies = await testDependencies()
  results.envVars = await testEnvironmentVariables()
  results.files = await testFilesExist()
  results.vapiConfig = await testVapiConfig()
  results.apiEndpoints = await testApiEndpoints()
  results.database = await testDatabase()
  
  // Summary
  section('SUMMARY')
  
  const allTests = [
    ['Dependencies', results.dependencies],
    ['Environment Variables', results.envVars],
    ['Required Files', results.files],
    ['VAPI Config', results.vapiConfig],
    ['API Endpoints', results.apiEndpoints],
    ['Database', results.database],
  ]
  
  let passed = 0
  for (const [name, result] of allTests) {
    if (result) {
      log(`✅ ${name}`, 'green')
      passed++
    } else {
      log(`❌ ${name}`, 'red')
    }
  }
  
  console.log('\n' + '='.repeat(60))
  log(`Results: ${passed}/${allTests.length} tests passed`, passed === allTests.length ? 'green' : 'yellow')
  console.log('='.repeat(60))
  
  // Next steps
  console.log('\n📋 NEXT STEPS:\n')
  
  if (!results.dependencies) {
    log('1. Install missing dependencies:', 'yellow')
    log('   npm install openai @supabase/supabase-js', 'yellow')
  }
  
  if (!results.envVars) {
    log('2. Set up environment variables in .env.local:', 'yellow')
    log('   OPENAI_API_KEY=sk-...', 'yellow')
    log('   SUPABASE_URL=https://...', 'yellow')
    log('   SUPABASE_SERVICE_ROLE_KEY=...', 'yellow')
  }
  
  if (!results.database) {
    log('3. Set up database:', 'yellow')
    log('   - Run migrations in Supabase Dashboard', 'yellow')
    log('   - Load properties: npm run load-properties', 'yellow')
  }
  
  if (!results.apiEndpoints) {
    log('4. Start development servers:', 'yellow')
    log('   - npm run dev (Vite/Next.js)', 'yellow')
    log('   - npm run webhook (Express)', 'yellow')
  }
  
  if (passed === allTests.length) {
    log('\n🎉 Everything looks good! Ready to test live features.', 'green')
    log('\nRun individual tests:', 'cyan')
    log('  npm run test-rag', 'cyan')
    log('  npm run test-vapi-call +15551234567', 'cyan')
    log('  npm run test-recommend', 'cyan')
    log('  npm run test-whatsapp', 'cyan')
  }
  
  console.log('')
}

main().catch(console.error)

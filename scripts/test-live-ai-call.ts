#!/usr/bin/env tsx
/**
 * Test 8: Live AI Call (IMPORTANT!)
 * Tests initiating a real VAPI call to a phone number
 * 
 * WARNING: This will make an actual phone call!
 * Make sure you have:
 * 1. VAPI_API_KEY set
 * 2. Valid phone number in E.164 format (+1234567890)
 * 3. VAPI account has credits
 */

// Load environment variables from .env.local
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

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

const BASE_URL = process.env.EXPRESS_BASE_URL || 'http://localhost:3001'

async function testLiveAICall() {
  console.log('🧪 Test 8: Live AI Call (IMPORTANT!)\n')
  console.log('⚠️  WARNING: This will make an actual phone call!\n')

  // Check environment variables
  const vapiKey = process.env.VAPI_API_KEY || process.env.VITE_VAPI_API_KEY
  if (!vapiKey) {
    console.error('❌ VAPI_API_KEY not set!')
    console.error('   Please set VAPI_API_KEY in your .env.local file')
    process.exit(1)
  }

  // Get phone number from command line or prompt
  const phoneNumber = process.argv[2]
  if (!phoneNumber) {
    console.error('❌ Phone number required!')
    console.error('   Usage: npx tsx scripts/test-live-ai-call.ts +1234567890')
    console.error('   Example: npx tsx scripts/test-live-ai-call.ts +15551234567')
    process.exit(1)
  }

  // Validate phone number format (E.164)
  if (!phoneNumber.startsWith('+')) {
    console.error('❌ Phone number must be in E.164 format (start with +)')
    console.error('   Example: +15551234567')
    process.exit(1)
  }

  const testPayload = {
    name: 'Test Lead',
    email: 'test@example.com',
    phone: phoneNumber,
    location: 'Miami, FL',
    timeline: 'Within 30 days',
  }

  try {
    console.log(`📞 Initiating call to: ${phoneNumber}`)
    console.log(`📤 Sending request to: ${BASE_URL}/api/vapi/initiate-call\n`)

    const response = await fetch(`${BASE_URL}/api/vapi/initiate-call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload),
    })

    console.log(`📥 Response Status: ${response.status} ${response.statusText}\n`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Error Response:')
      console.error(errorText)

      if (response.status === 401) {
        console.error('\n💡 Tip: Check your VAPI_API_KEY is correct')
      } else if (response.status === 400) {
        console.error('\n💡 Tip: Check phone number format (E.164: +1234567890)')
      }

      process.exit(1)
    }

    const data = await response.json()
    console.log('✅ Call Initiated Successfully!')
    console.log(JSON.stringify(data, null, 2))
    console.log('')

    if (data.callId) {
      console.log(`📞 Call ID: ${data.callId}`)
      console.log(`\n✅ You should receive a call on ${phoneNumber} within a few seconds!`)
      console.log('\n📋 What to expect:')
      console.log('   1. Your phone will ring')
      console.log('   2. AI assistant "Sarah" will introduce herself')
      console.log('   3. She will ask about your property needs')
      console.log('   4. You can ask: "Show me 3 bedroom homes under 500K"')
      console.log('   5. AI will search properties and speak the results')
      console.log('\n💡 Tip: Check VAPI dashboard for call status and transcript')
    } else {
      console.warn('⚠️  Response does not contain callId')
    }

    if (data.success) {
      console.log('\n✅ Test completed successfully!')
    } else {
      console.warn('\n⚠️  Response success field is not true')
    }
  } catch (error: any) {
    console.error('\n❌ Test failed:')
    console.error(error.message)

    if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
      console.error('\n💡 Tip: Make sure the Express server is running:')
      console.error('   npm run webhook')
    }

    process.exit(1)
  }
}

// Check if phone number provided
if (process.argv.length < 3) {
  console.error('❌ Phone number required!')
  console.error('\nUsage:')
  console.error('  npx tsx scripts/test-live-ai-call.ts +1234567890')
  console.error('\nExample:')
  console.error('  npx tsx scripts/test-live-ai-call.ts +15551234567')
  console.error('\n⚠️  WARNING: This will make an actual phone call!')
  process.exit(1)
}

testLiveAICall()

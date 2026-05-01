#!/usr/bin/env tsx
/**
 * Test VAPI Function Handler
 * Tests the /api/vapi/functions endpoint
 */

// Try different ports based on framework
// Vite runs on 3000 and proxies /api to Express on 3001
// But Next.js routes might be on 3000 directly
const BASE_URL = 
  process.env.NEXT_API_BASE_URL || 
  process.env.APP_URL ||
  'http://localhost:3000' // Vite dev server (proxies to Express on 3001)

async function testVapiFunctionHandler() {
  console.log('🧪 Testing VAPI Function Handler\n')
  console.log(`Endpoint: ${BASE_URL}/api/vapi/functions\n`)

  const testPayload = {
    message: {
      type: 'function-call',
      functionCall: {
        name: 'search_properties',
        parameters: {
          query: '3 bedroom under 500K',
          max_price: 500000,
          min_beds: 3,
        },
      },
    },
  }

  try {
    console.log('📤 Sending request...')
    console.log('Payload:', JSON.stringify(testPayload, null, 2))
    console.log('')

    const response = await fetch(`${BASE_URL}/api/vapi/functions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add VAPI signature if configured
        ...(process.env.VAPI_SERVER_SECRET && {
          'x-vapi-signature': process.env.VAPI_SERVER_SECRET,
        }),
      },
      body: JSON.stringify(testPayload),
    })

    console.log(`📥 Response Status: ${response.status} ${response.statusText}\n`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Error Response:')
      console.error(errorText)
      process.exit(1)
    }

    const data = await response.json()
    console.log('✅ Success Response:')
    console.log(JSON.stringify(data, null, 2))
    console.log('')

    // Check if response has the expected format
    if (data.result) {
      console.log('✅ Response contains "result" field')
      console.log(`\n📝 Natural Language Response:\n"${data.result}"\n`)
    } else {
      console.warn('⚠️  Response does not contain "result" field')
    }

    // Check if it's natural language (not just JSON)
    if (typeof data.result === 'string' && data.result.length > 50) {
      console.log('✅ Response is natural language (good for VAPI to speak)')
    } else {
      console.warn('⚠️  Response might be too short or not natural language')
    }

    console.log('\n✅ Test completed successfully!')
  } catch (error: any) {
    console.error('\n❌ Test failed:')
    console.error(error.message)

    if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
      console.error('\n💡 Tip: Make sure the dev server is running:')
      console.error('   npm run dev')
      console.error('\n   If using Vite, the server runs on port 5173')
      console.error('   If using Next.js, the server runs on port 3000')
    }
    
    if (error.message.includes('500')) {
      console.error('\n💡 The endpoint is reachable but returned an error.')
      console.error('   This might mean:')
      console.error('   1. The property search API is not working')
      console.error('   2. Environment variables are not set (OPENAI_API_KEY, SUPABASE_URL)')
      console.error('   3. Properties are not loaded in the database')
      console.error('\n   Try running: npm run load-properties')
    }

    process.exit(1)
  }
}

testVapiFunctionHandler()

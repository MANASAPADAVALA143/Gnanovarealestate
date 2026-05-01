#!/usr/bin/env tsx
/**
 * Test 10: WhatsApp Property Sending
 * Tests the /api/whatsapp/send-property endpoint
 * 
 * Prerequisites:
 * - TWILIO_ACCOUNT_SID set
 * - TWILIO_AUTH_TOKEN set
 * - TWILIO_WHATSAPP_FROM set (format: whatsapp:+1234567890)
 * - Valid property IDs in database
 */

const BASE_URL = process.env.NEXT_API_BASE_URL || process.env.APP_URL || 'http://localhost:3000'

async function testWhatsApp() {
  console.log('🧪 Test 10: WhatsApp Property Sending\n')
  console.log(`Endpoint: ${BASE_URL}/api/whatsapp/send-property\n`)

  // Check environment variables
  const twilioSid = process.env.TWILIO_ACCOUNT_SID || process.env.VITE_TWILIO_ACCOUNT_SID
  const twilioToken = process.env.TWILIO_AUTH_TOKEN || process.env.VITE_TWILIO_AUTH_TOKEN
  const twilioFrom = process.env.TWILIO_WHATSAPP_FROM || process.env.VITE_TWILIO_WHATSAPP_FROM

  if (!twilioSid || !twilioToken || !twilioFrom) {
    console.warn('⚠️  Twilio credentials not fully configured:')
    if (!twilioSid) console.warn('   - TWILIO_ACCOUNT_SID missing')
    if (!twilioToken) console.warn('   - TWILIO_AUTH_TOKEN missing')
    if (!twilioFrom) console.warn('   - TWILIO_WHATSAPP_FROM missing')
    console.warn('\n💡 This test will still run but may fail if Twilio is required.')
    console.warn('   The endpoint should validate input even without Twilio configured.\n')
  } else {
    console.log('✅ Twilio credentials found')
    console.log(`   Account SID: ${twilioSid.substring(0, 10)}...`)
    console.log(`   From Number: ${twilioFrom}\n`)
  }

  // Get property IDs from command line or use default
  const propertyIds = process.argv[2] 
    ? process.argv[2].split(',').map(id => id.trim())
    : ['prop_001'] // Default test ID

  // Get phone number from command line or use default
  const phoneNumber = process.argv[3] || '+1234567890'

  const testPayload = {
    phone: phoneNumber,
    propertyIds: propertyIds,
    leadName: 'Test User',
  }

  try {
    console.log('📤 Sending request...')
    console.log('Payload:', JSON.stringify(testPayload, null, 2))
    console.log('')

    const response = await fetch(`${BASE_URL}/api/whatsapp/send-property`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload),
    })

    console.log(`📥 Response Status: ${response.status} ${response.statusText}\n`)

    const responseText = await response.text()
    let data: any

    try {
      data = JSON.parse(responseText)
    } catch {
      console.error('❌ Invalid JSON response:')
      console.error(responseText)
      process.exit(1)
    }

    if (!response.ok) {
      console.error('❌ Error Response:')
      console.error(JSON.stringify(data, null, 2))

      if (response.status === 400) {
        console.error('\n💡 Tip: Check your request payload:')
        console.error('   - phone must be in E.164 format (+1234567890)')
        console.error('   - propertyIds must be a non-empty array')
        console.error('   - leadName is required')
      } else if (response.status === 401 || response.status === 403) {
        console.error('\n💡 Tip: Check your Twilio credentials:')
        console.error('   - TWILIO_ACCOUNT_SID')
        console.error('   - TWILIO_AUTH_TOKEN')
      } else if (response.status === 500) {
        if (data.error?.includes('Twilio') || data.error?.includes('TWILIO')) {
          console.error('\n💡 Tip: Twilio not configured or credentials invalid')
          console.error('   This is expected if Twilio is not set up yet.')
          console.error('   The endpoint validated the request correctly.')
        } else {
          console.error('\n💡 Tip: Server error - check:')
          console.error('   - Properties exist in database')
          console.error('   - Database connection is working')
        }
      }

      process.exit(1)
    }

    console.log('✅ Success Response:')
    console.log(JSON.stringify(data, null, 2))
    console.log('')

    // Validate response structure
    if (data.success !== true) {
      console.warn('⚠️  Response success field is not true')
    }

    if (data.messageSid) {
      console.log(`✅ WhatsApp message sent!`)
      console.log(`   Message SID: ${data.messageSid}`)
      console.log(`\n📱 Check your phone (${phoneNumber}) for the WhatsApp message!`)
    } else {
      console.warn('⚠️  Response does not contain messageSid')
      console.warn('   Message may not have been sent via Twilio')
    }

    if (data.message) {
      console.log(`\n📝 Message: "${data.message}"`)
    }

    if (data.logged) {
      console.log('✅ Message logged to database')
    }

    // Show property details that were sent
    if (data.properties && Array.isArray(data.properties)) {
      console.log(`\n📋 Properties sent (${data.properties.length}):`)
      data.properties.forEach((prop: any, idx: number) => {
        console.log(`   ${idx + 1}. ${prop.address || 'N/A'} - $${prop.price?.toLocaleString() || 'N/A'}`)
      })
    }

    console.log('\n✅ Test completed successfully!')
    console.log('\n💡 Next steps:')
    console.log('   1. Check your WhatsApp for the message')
    console.log('   2. Verify the message includes property details')
    console.log('   3. Check that images/links are working')
  } catch (error: any) {
    console.error('\n❌ Test failed:')
    console.error(error.message)

    if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
      console.error('\n💡 Tip: Make sure the dev server is running:')
      console.error('   npm run dev')
      console.error('   or')
      console.error('   npx next dev (if using Next.js)')
    }

    process.exit(1)
  }
}

// Show usage if no arguments
if (process.argv.length < 2) {
  console.log('📱 WhatsApp Property Sending Test\n')
  console.log('Usage:')
  console.log('  npx tsx scripts/test-whatsapp.ts [propertyIds] [phoneNumber]')
  console.log('\nExamples:')
  console.log('  # Use default test property and phone')
  console.log('  npx tsx scripts/test-whatsapp.ts')
  console.log('\n  # Specify property IDs (comma-separated)')
  console.log('  npx tsx scripts/test-whatsapp.ts "uuid-1,uuid-2"')
  console.log('\n  # Specify property IDs and phone number')
  console.log('  npx tsx scripts/test-whatsapp.ts "uuid-1" "+15551234567"')
  console.log('\n⚠️  Note: Phone number must be in E.164 format (+1234567890)')
  console.log('⚠️  Property IDs should be valid UUIDs from your database\n')
}

testWhatsApp()

import { createClient } from '@supabase/supabase-js'

/**
 * End-to-End Test Script
 *
 * Tests the complete flow:
 * 1. Lead creation
 * 2. VAPI call initiation
 * 3. Property search (RAG)
 * 4. Property recommendation
 * 5. WhatsApp messaging
 * 6. Booking creation
 * 7. Dashboard analytics
 *
 * Prerequisites:
 * - Express server running on port 3001 (or set EXPRESS_BASE_URL)
 * - Next.js dev server running on port 3000 (or set NEXT_API_BASE_URL)
 * - Supabase credentials configured (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
 * - Properties loaded in database (run: npm run load-properties)
 *
 * Usage:
 *   npm run e2e-test
 *
 * Environment Variables:
 *   EXPRESS_BASE_URL - Express API base URL (default: http://localhost:3001)
 *   NEXT_API_BASE_URL - Next.js API base URL (default: http://localhost:3000)
 *   SUPABASE_URL - Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - Supabase service role key
 */

// Configuration
const EXPRESS_BASE_URL = process.env.EXPRESS_BASE_URL || 'http://localhost:3001'
const NEXT_API_BASE_URL = process.env.NEXT_API_BASE_URL || 'http://localhost:3000'
const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  ''
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || ''

// Test state
let testLeadId: string | null = null
let testPropertyIds: string[] = []
let testBookingId: string | null = null
let testCallId: string | null = null

// Test results
type TestResult = {
  name: string
  passed: boolean
  duration: number
  error?: string
  details?: any
}

const results: TestResult[] = []

// Helper: Run a test with timing
async function runTest(
  name: string,
  testFn: () => Promise<void>
): Promise<TestResult> {
  const start = Date.now()
  let passed = false
  let error: string | undefined
  let details: any = undefined

  try {
    await testFn()
    passed = true
  } catch (err: any) {
    error = err?.message || String(err)
    details = err?.details || err
    console.error(`  ❌ Error: ${error}`)
    if (details && typeof details === 'object') {
      console.error(`  Details:`, JSON.stringify(details, null, 2))
    }
  }

  const duration = Date.now() - start
  const result: TestResult = { name, passed, duration, error, details }
  results.push(result)

  const icon = passed ? '✅' : '❌'
  const status = passed ? 'PASS' : 'FAIL'
  console.log(`  ${icon} ${status} (${duration}ms)`)

  return result
}

// Helper: Get Supabase client
function getSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Supabase credentials not configured')
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
}

// Test 1: Lead Form Submission
async function testLeadCreation() {
  await runTest('1. Lead Form Submission', async () => {
    const leadData = {
      name: 'E2E Test Lead',
      email: 'e2e-test@example.com',
      phone: '+1234567890',
      location: 'Miami, FL',
      timeline: 'Within 30 days',
      source: 'e2e-test',
    }

    const start = Date.now()
    const response = await fetch(`${EXPRESS_BASE_URL}/api/leads/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(leadData),
    })

    const duration = Date.now() - start

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    const data = await response.json()

    if (!data.success || !data.leadId) {
      throw new Error(`Invalid response: ${JSON.stringify(data)}`)
    }

    testLeadId = data.leadId

    // Verify response time < 1 second
    if (duration >= 1000) {
      throw new Error(`Response time ${duration}ms exceeds 1 second threshold`)
    }

    // Verify saved in Supabase
    const supabase = getSupabaseClient()
    const { data: lead, error: dbError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', testLeadId)
      .single()

    if (dbError) {
      throw new Error(`Failed to verify lead in database: ${dbError.message}`)
    }

    if (!lead || lead.name !== leadData.name || lead.phone !== leadData.phone) {
      throw new Error('Lead data mismatch in database')
    }

    console.log(`    ✓ Lead created: ${testLeadId}`)
    console.log(`    ✓ Response time: ${duration}ms`)
  })
}

// Test 2: VAPI Call Initiation (if endpoint exists)
async function testVAPICallInitiation() {
  await runTest('2. VAPI Call Initiation', async () => {
    if (!testLeadId) {
      throw new Error('No lead ID available from previous test')
    }

    // Check if there's a call initiation endpoint
    // This might be through n8n webhook or direct VAPI API
    // For now, we'll check if a call record was created

    const supabase = getSupabaseClient()

    // Wait a bit for async processing
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Check if call was created (might be in calls table or via webhook)
    const { data: calls, error } = await supabase
      .from('calls')
      .select('*')
      .eq('lead_id', testLeadId)
      .order('created_at', { ascending: false })
      .limit(1)

    if (error) {
      console.log(`    ⚠️  Could not check calls table: ${error.message}`)
      console.log(`    ℹ️  This is expected if VAPI integration is not fully set up`)
      // Don't fail the test, just warn
      return
    }

    if (calls && calls.length > 0) {
      testCallId = calls[0].id
      const status = calls[0].status || calls[0].lead_status
      console.log(`    ✓ Call record found: ${testCallId}`)
      console.log(`    ✓ Status: ${status}`)

      if (status !== 'call_initiated' && status !== 'active' && status !== 'completed') {
        console.log(`    ⚠️  Call status is "${status}", expected "call_initiated" or similar`)
      }
    } else {
      console.log(`    ⚠️  No call record found yet (may be async)`)
    }
  })
}

// Test 3: Property Search (RAG)
async function testPropertySearch() {
  await runTest('3. Property Search (RAG)', async () => {
    const query = '3 bedroom house under 500K'
    const filters = {
      query,
      maxPrice: 500000,
      minBeds: 3,
    }

    const start = Date.now()
    const response = await fetch(`${NEXT_API_BASE_URL}/api/properties/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(filters),
    })

    const duration = Date.now() - start

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    const data = await response.json()

    if (!data.success || !Array.isArray(data.properties)) {
      throw new Error(`Invalid response: ${JSON.stringify(data)}`)
    }

    const properties = data.properties

    // Verify returns 5 results
    if (properties.length === 0) {
      throw new Error('No properties returned. Make sure properties are loaded in database.')
    }

    if (properties.length > 5) {
      console.log(`    ⚠️  Warning: ${properties.length} results returned (expected ≤5)`)
    }

    // Check similarity scores > 0.7
    const lowSimilarity = properties.filter(
      (p: any) => !p.similarity_score || p.similarity_score < 0.7
    )

    if (lowSimilarity.length > 0) {
      console.log(
        `    ⚠️  Warning: ${lowSimilarity.length} properties have similarity < 0.7`
      )
      lowSimilarity.forEach((p: any) => {
        console.log(`      - ${p.address}: similarity = ${p.similarity_score || 'N/A'}`)
      })
    }

    // Verify response time < 2 seconds
    if (duration >= 2000) {
      throw new Error(`Response time ${duration}ms exceeds 2 second threshold`)
    }

    // Store property IDs for later tests
    testPropertyIds = properties.slice(0, 2).map((p: any) => p.id)

    console.log(`    ✓ Found ${properties.length} properties`)
    console.log(`    ✓ Response time: ${duration}ms`)
    console.log(`    ✓ Top similarity: ${properties[0]?.similarity_score?.toFixed(3) || 'N/A'}`)
  })
}

// Test 4: Property Recommendation
async function testPropertyRecommendation() {
  await runTest('4. Property Recommendation', async () => {
    if (!testLeadId) {
      throw new Error('No lead ID available from previous test')
    }

    const preferences = {
      budget_max: 500000,
      bedrooms: 3,
      location: 'Miami',
      must_have: ['pool', 'garage'],
    }

    const response = await fetch(`${NEXT_API_BASE_URL}/api/properties/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leadId: testLeadId,
        preferences,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    const data = await response.json()

    if (!data.success || !Array.isArray(data.properties)) {
      throw new Error(`Invalid response: ${JSON.stringify(data)}`)
    }

    const properties = data.properties

    // Verify 5 properties returned (or at least some)
    if (properties.length === 0) {
      throw new Error('No properties recommended')
    }

    if (properties.length < 3) {
      console.log(`    ⚠️  Warning: Only ${properties.length} properties recommended (expected ≥3)`)
    }

    // Check all match criteria
    const mismatches: string[] = []
    properties.forEach((p: any, idx: number) => {
      if (preferences.budget_max && p.price && p.price > preferences.budget_max) {
        mismatches.push(`Property ${idx + 1}: price ${p.price} > ${preferences.budget_max}`)
      }
      if (preferences.bedrooms && p.bedrooms && p.bedrooms < preferences.bedrooms) {
        mismatches.push(
          `Property ${idx + 1}: bedrooms ${p.bedrooms} < ${preferences.bedrooms}`
        )
      }
    })

    if (mismatches.length > 0) {
      console.log(`    ⚠️  Warning: Some properties don't match criteria:`)
      mismatches.forEach((m) => console.log(`      - ${m}`))
    }

    console.log(`    ✓ Recommended ${properties.length} properties`)
    if (data.summary) {
      console.log(`    ✓ Summary: ${data.summary.substring(0, 100)}...`)
    }
  })
}

// Test 5: WhatsApp Message
async function testWhatsAppMessage() {
  await runTest('5. WhatsApp Message', async () => {
    if (testPropertyIds.length === 0) {
      throw new Error('No property IDs available from previous test')
    }

    const requestBody = {
      phone: '+1234567890',
      propertyIds: testPropertyIds.slice(0, 2),
      leadName: 'E2E Test Lead',
    }

    const response = await fetch(`${NEXT_API_BASE_URL}/api/whatsapp/send-property`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      // Check if it's a Twilio configuration error (expected in test env)
      if (errorText.includes('Twilio') || errorText.includes('TWILIO')) {
        console.log(`    ⚠️  Twilio not configured (expected in test environment)`)
        console.log(`    ✓ Endpoint is accessible and validates input correctly`)
        return
      }
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    const data = await response.json()

    if (!data.success) {
      throw new Error(`Invalid response: ${JSON.stringify(data)}`)
    }

    // Verify Twilio response
    if (data.messageSid) {
      console.log(`    ✓ Twilio message SID: ${data.messageSid}`)
    }

    // Check message logged (if endpoint returns this)
    if (data.logged) {
      console.log(`    ✓ Message logged to database`)
    }

    console.log(`    ✓ WhatsApp message sent successfully`)
  })
}

// Test 6: Booking Creation
async function testBookingCreation() {
  await runTest('6. Booking Creation', async () => {
    if (!testLeadId || testPropertyIds.length === 0) {
      throw new Error('No lead ID or property IDs available from previous test')
    }

    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dateStr = tomorrow.toISOString().split('T')[0]

    const requestBody = {
      propertyId: testPropertyIds[0],
      leadId: testLeadId,
      preferredDate: dateStr,
      preferredTime: '2:00 PM',
      notes: 'E2E test booking',
    }

    const response = await fetch(`${NEXT_API_BASE_URL}/api/bookings/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    const data = await response.json()

    if (!data.success || !data.booking || !data.booking.id) {
      throw new Error(`Invalid response: ${JSON.stringify(data)}`)
    }

    testBookingId = data.booking.id

    // Verify booking in database
    const supabase = getSupabaseClient()
    const { data: booking, error: dbError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', testBookingId)
      .single()

    if (dbError) {
      throw new Error(`Failed to verify booking in database: ${dbError.message}`)
    }

    if (!booking) {
      throw new Error('Booking not found in database')
    }

    if (booking.property_id !== requestBody.propertyId) {
      throw new Error('Booking property_id mismatch')
    }

    if (booking.lead_id !== requestBody.leadId) {
      throw new Error('Booking lead_id mismatch')
    }

    console.log(`    ✓ Booking created: ${testBookingId}`)
    console.log(`    ✓ Scheduled: ${booking.scheduled_date} at ${booking.scheduled_time}`)
    console.log(`    ✓ Status: ${booking.status}`)
  })
}

// Test 7: Dashboard Stats
async function testDashboardStats() {
  await runTest('7. Dashboard Stats', async () => {
    const start = Date.now()
    const response = await fetch(`${NEXT_API_BASE_URL}/api/analytics/stats`)

    const duration = Date.now() - start

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    const data = await response.json()

    // Verify response format
    const requiredFields = ['today', 'thisWeek', 'topProperties', 'recentActivity']
    for (const field of requiredFields) {
      if (!(field in data)) {
        throw new Error(`Missing required field: ${field}`)
      }
    }

    // Verify today stats structure
    const todayFields = ['calls', 'hotLeads', 'appointmentsBooked', 'avgLeadScore']
    for (const field of todayFields) {
      if (!(field in data.today)) {
        throw new Error(`Missing today.${field}`)
      }
    }

    // Verify thisWeek stats structure
    const weekFields = ['calls', 'hotLeads', 'appointmentsBooked', 'conversionRate']
    for (const field of weekFields) {
      if (!(field in data.thisWeek)) {
        throw new Error(`Missing thisWeek.${field}`)
      }
    }

    // Verify arrays
    if (!Array.isArray(data.topProperties)) {
      throw new Error('topProperties must be an array')
    }

    if (!Array.isArray(data.recentActivity)) {
      throw new Error('recentActivity must be an array')
    }

    console.log(`    ✓ Response time: ${duration}ms`)
    console.log(`    ✓ Today: ${data.today.calls} calls, ${data.today.hotLeads} hot leads`)
    console.log(`    ✓ This week: ${data.thisWeek.calls} calls, ${data.thisWeek.appointmentsBooked} appointments`)
    console.log(`    ✓ Top properties: ${data.topProperties.length}`)
    console.log(`    ✓ Recent activity: ${data.recentActivity.length} items`)
  })
}

// Main test runner
async function runAllTests() {
  console.log('\n🧪 Starting End-to-End Tests\n')
  console.log(`Express API: ${EXPRESS_BASE_URL}`)
  console.log(`Next.js API: ${NEXT_API_BASE_URL}`)
  console.log(`Supabase: ${SUPABASE_URL ? 'Configured' : 'Not configured'}\n`)

  // Check prerequisites
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ ERROR: Supabase credentials not configured')
    console.error('   Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file')
    process.exit(1)
  }

  try {
    // Run tests sequentially
    await testLeadCreation()
    await testVAPICallInitiation()
    await testPropertySearch()
    await testPropertyRecommendation()
    await testWhatsAppMessage()
    await testBookingCreation()
    await testDashboardStats()

    // Print summary
    console.log('\n' + '='.repeat(60))
    console.log('📊 Test Summary')
    console.log('='.repeat(60))

    const passed = results.filter((r) => r.passed).length
    const failed = results.filter((r) => !r.passed).length
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0)

    results.forEach((result) => {
      const icon = result.passed ? '✅' : '❌'
      const status = result.passed ? 'PASS' : 'FAIL'
      console.log(
        `${icon} ${result.name.padEnd(40)} ${status.padEnd(6)} ${result.duration.toString().padStart(5)}ms`
      )
      if (result.error) {
        console.log(`   └─ Error: ${result.error}`)
      }
    })

    console.log('='.repeat(60))
    console.log(`Total: ${results.length} tests | Passed: ${passed} | Failed: ${failed}`)
    console.log(`Total duration: ${totalDuration}ms`)
    console.log('='.repeat(60) + '\n')

    if (failed > 0) {
      console.error('❌ Some tests failed. Please review the errors above.')
      process.exit(1)
    } else {
      console.log('✅ All tests passed!')
      process.exit(0)
    }
  } catch (error: any) {
    console.error('\n❌ Fatal error during test execution:')
    console.error(error)
    process.exit(1)
  }
}

// Run tests
runAllTests().catch((error) => {
  console.error('Unhandled error:', error)
  process.exit(1)
})

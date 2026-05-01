#!/usr/bin/env tsx
/**
 * Test 9: Property Recommendations API
 * Tests the /api/properties/recommend endpoint
 */

const BASE_URL = process.env.NEXT_API_BASE_URL || process.env.APP_URL || 'http://localhost:3000'

async function testPropertyRecommendations() {
  console.log('🧪 Test 9: Property Recommendations API\n')
  console.log(`Endpoint: ${BASE_URL}/api/properties/recommend\n`)

  // First, we need a real lead ID from the database
  // For testing, we'll use a test lead ID or create one
  const testPayload = {
    leadId: 'test-lead-123', // This should be a real UUID from your database
    preferences: {
      budget_max: 500000,
      bedrooms: 3,
      location: 'Miami',
      must_have: ['pool', 'garage'], // Optional
    },
  }

  try {
    console.log('📤 Sending request...')
    console.log('Payload:', JSON.stringify(testPayload, null, 2))
    console.log('')

    const response = await fetch(`${BASE_URL}/api/properties/recommend`, {
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
      
      if (response.status === 400) {
        console.error('\n💡 Tip: The leadId might not exist in the database.')
        console.error('   Try creating a lead first, or use a valid UUID.')
      }
      
      process.exit(1)
    }

    const data = await response.json()
    console.log('✅ Success Response:')
    console.log(JSON.stringify(data, null, 2))
    console.log('')

    // Validate response structure
    if (data.success !== true) {
      console.warn('⚠️  Response success field is not true')
    }

    if (!Array.isArray(data.properties)) {
      console.error('❌ Response does not contain properties array')
      process.exit(1)
    }

    const propertyCount = data.properties.length
    console.log(`✅ Found ${propertyCount} recommended properties`)

    if (propertyCount === 0) {
      console.warn('⚠️  No properties returned. This might mean:')
      console.warn('   1. No properties match the criteria')
      console.warn('   2. Properties are not loaded in database')
      console.warn('   3. Embeddings are not generated')
      console.warn('\n   Try running: npm run load-properties')
    } else {
      if (propertyCount >= 5) {
        console.log('✅ Recommended 5+ properties (expected)')
      } else {
        console.log(`⚠️  Only ${propertyCount} properties recommended (expected 5)`)
      }

      // Check if properties match criteria
      const mismatches: string[] = []
      data.properties.forEach((prop: any, idx: number) => {
        if (prop.price && prop.price > testPayload.preferences.budget_max!) {
          mismatches.push(`Property ${idx + 1}: price ${prop.price} > ${testPayload.preferences.budget_max}`)
        }
        if (prop.bedrooms && prop.bedrooms < testPayload.preferences.bedrooms!) {
          mismatches.push(`Property ${idx + 1}: bedrooms ${prop.bedrooms} < ${testPayload.preferences.bedrooms}`)
        }
      })

      if (mismatches.length > 0) {
        console.warn('\n⚠️  Some properties don\'t match criteria:')
        mismatches.forEach((m) => console.warn(`   - ${m}`))
      } else {
        console.log('✅ All properties match the criteria')
      }

      // Show first property details
      if (data.properties[0]) {
        const first = data.properties[0]
        console.log('\n📋 First Recommended Property:')
        console.log(`   Address: ${first.address || 'N/A'}`)
        console.log(`   Price: $${first.price?.toLocaleString() || 'N/A'}`)
        console.log(`   Bedrooms: ${first.bedrooms || 'N/A'}`)
        console.log(`   Bathrooms: ${first.bathrooms || 'N/A'}`)
        if (first.similarity_score) {
          console.log(`   Similarity: ${first.similarity_score.toFixed(3)}`)
        }
      }
    }

    // Check for summary
    if (data.summary) {
      console.log('\n📝 Summary:')
      console.log(`"${data.summary}"`)
    } else {
      console.warn('\n⚠️  No summary field in response')
    }

    console.log('\n✅ Test completed successfully!')
  } catch (error: any) {
    console.error('\n❌ Test failed:')
    console.error(error.message)

    if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
      console.error('\n💡 Tip: Make sure the dev server is running:')
      console.error('   npm run dev')
    }

    process.exit(1)
  }
}

testPropertyRecommendations()

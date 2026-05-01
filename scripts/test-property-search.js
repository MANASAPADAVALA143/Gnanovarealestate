// Simple Node.js script to test property search API
// Usage: node scripts/test-property-search.js

// The API endpoint is on the Express server (port 3001)
// Vite runs on a different port for the frontend
async function findServerPort() {
  // Check if Express server (API) is running on 3001
  try {
    const response = await fetch(`http://localhost:3001/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(1000),
    });
    if (response.ok) {
      console.log(`✅ Found Express API server on port 3001\n`);
      return 3001;
    }
  } catch (error) {
    // Server not running
  }
  
  console.log('⚠️  Express server not found on port 3001');
  console.log('💡 Start it with: npm run webhook\n');
  return 3001; // Default to 3001 anyway
}

async function testPropertySearch() {
  // Find which port the server is on
  const port = await findServerPort();
  const baseUrl = process.env.API_URL || `http://localhost:${port}`;
  
  console.log('🔍 Testing Property Search API...\n');

  // Test 1: Basic search
  console.log('Test 1: Basic search for Miami properties');
  try {
    const response = await fetch(`${baseUrl}/api/properties/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: 'Miami',
        maxPrice: 500000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    const data = await response.json();
    console.log('✅ Success!');
    console.log(`Results: ${data.resultsCount || data.properties?.length || 0}`);
    if (data.properties && data.properties.length > 0) {
      data.properties.forEach((prop) => {
        console.log(`  - ${prop.address}, ${prop.city} - $${prop.price?.toLocaleString()}`);
      });
    } else {
      console.log('  (No properties found)');
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
    if (error.message.includes('ECONNREFUSED') || error.message.includes('fetch failed')) {
      console.log('💡 Make sure the dev server is running: npm run dev');
    }
  }

  console.log('\n');

  // Test 2: Search with filters
  console.log('Test 2: Search with filters (3 bedroom, under 500K)');
  try {
    const response = await fetch(`${baseUrl}/api/properties/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: '3 bedroom house',
        maxPrice: 500000,
        minBeds: 3,
        location: 'Miami',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    const data = await response.json();
    console.log('✅ Success!');
    console.log(`Results: ${data.resultsCount || data.properties?.length || 0}`);
    if (data.properties && data.properties.length > 0) {
      data.properties.forEach((prop) => {
        console.log(
          `  - ${prop.address}, ${prop.city} - $${prop.price?.toLocaleString()} - ${prop.bedrooms} bed`
        );
      });
    } else {
      console.log('  (No properties found)');
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  console.log('\n✅ Testing complete!');
}

// Run the test
testPropertySearch().catch(console.error);

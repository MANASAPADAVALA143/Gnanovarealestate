// Quick test script to verify the upload endpoint works
const testCSV = `title,address,city,state,country,price,bedrooms,bathrooms,sqft,property_type,amenities,description,virtual_tour_url
Test Property,123 Main St,Miami,FL,USA,500000,3,2,1500,single_family,pool;garage,Test property for upload,https://example.com`

fetch('http://localhost:3001/api/properties/upload-csv', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    csvText: testCSV,
    agentId: 'test-agent-123',
  }),
})
  .then(res => res.json())
  .then(data => {
    console.log('✅ Response:', data)
  })
  .catch(err => {
    console.error('❌ Error:', err.message)
  })

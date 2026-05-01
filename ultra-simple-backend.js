// Ultra-simple backend - no database, just returns success
import express from 'express'
import cors from 'cors'

const app = express()
app.use(cors())
app.use(express.json({ limit: '50mb' }))

console.log('🚀 Starting ultra-simple backend...')

// Health check
app.get('/health', (req, res) => {
  console.log('✅ Health check')
  res.json({ status: 'ok' })
})

// CSV Upload - just return success without database
app.post('/api/properties/upload-csv', (req, res) => {
  console.log('📤 CSV Upload request received!')
  
  try {
    const { csvText, agentId } = req.body
    
    console.log('Agent ID:', agentId)
    console.log('CSV length:', csvText ? csvText.length : 0)
    
    if (!csvText) {
      console.log('❌ No CSV text')
      return res.status(400).json({ error: 'CSV text is required' })
    }

    // Parse CSV to count rows
    const lines = csvText.trim().split('\n')
    const propertyCount = lines.length - 1 // minus header
    
    console.log(`✅ Parsed ${propertyCount} properties`)
    
    // Return success immediately (without saving to database for now)
    const response = {
      success: true,
      count: propertyCount,
      errors: [],
      message: `CSV parsed successfully! Found ${propertyCount} properties (database disabled for testing)`
    }
    
    console.log('✅ Sending response:', response)
    res.json(response)
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    res.status(500).json({ 
      success: false,
      error: error.message,
      count: 0,
      errors: [error.message]
    })
  }
})

// Get properties - return empty for now
app.get('/api/properties', (req, res) => {
  console.log('📋 Get properties request')
  res.json({ 
    success: true, 
    properties: [],
    message: 'Database disabled for testing'
  })
})

// Start server
const PORT = 3001
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅ ULTRA-SIMPLE BACKEND RUNNING`)
  console.log(`📍 Port: ${PORT}`)
  console.log(`📍 Listening on: 0.0.0.0:${PORT} (all interfaces)`)
  console.log(`📍 Upload: http://localhost:${PORT}/api/properties/upload-csv`)
  console.log(`\n⚠️  This version just parses CSV, doesn't save to database`)
  console.log(`⚠️  Keep this window open!\n`)
})

// Keep alive
setInterval(() => {
  console.log(`💓 Server alive at ${new Date().toLocaleTimeString()}`)
}, 30000)

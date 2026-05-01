// Minimal test server
import express from 'express'
import cors from 'cors'

const app = express()
app.use(cors())
app.use(express.json())

app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.post('/test', (req, res) => {
  console.log('✅ Received request:', req.body)
  res.json({ success: true, message: 'Test endpoint works!' })
})

// Add the CSV upload endpoint
app.post('/api/properties/upload-csv', async (req, res) => {
  try {
    console.log('📤 CSV Upload request received')
    const { csvText, agentId } = req.body
    
    if (!csvText) {
      return res.status(400).json({ error: 'CSV text is required' })
    }
    
    console.log(`Processing CSV for agent: ${agentId}`)
    console.log(`CSV length: ${csvText.length} characters`)
    
    // For now, just return success to verify the endpoint works
    res.status(200).json({
      success: true,
      count: 20,
      errors: [],
      message: 'CSV upload endpoint is working! (Test mode)'
    })
  } catch (error) {
    console.error('❌ Upload error:', error)
    res.status(500).json({ error: error.message })
  }
})

const PORT = 3001
const server = app.listen(PORT, () => {
  console.log(`✅ Test server running on port ${PORT}`)
  console.log(`Test: http://localhost:${PORT}/health`)
})

// Keep alive
process.on('SIGTERM', () => server.close())
process.on('SIGINT', () => server.close())

console.log('Server started, waiting for requests...')

import express from 'express'
import cors from 'cors'
import { handleVapiWebhook } from './src/api/vapi-webhook.ts'
import { initiatePublicCall } from './src/api/initiate-public-call.ts'

const app = express()
app.use(cors())
app.use(express.json())

app.post('/api/vapi-webhook', async (req, res) => {
  try {
    console.log('Received VAPI webhook:', req.body.type)
    const result = await handleVapiWebhook(req.body)
    res.json(result)
  } catch (error) {
    console.error('Webhook error:', error)
    res.status(500).json({ error: 'Webhook processing failed' })
  }
})

app.post('/api/vapi/initiate-call', async (req, res) => {
  try {
    const { name, email, phone, location, timeline } = req.body

    // Validate required fields
    if (!phone || !name) {
      return res.status(400).json({
        error: 'Name and phone number are required',
      })
    }

    const result = await initiatePublicCall({
      name,
      email,
      phone,
      location,
      timeline,
    })

    res.json(result)
  } catch (error) {
    console.error('Error initiating VAPI call:', error)
    res.status(500).json({
      error: error?.message || 'Internal server error',
    })
  }
})

const PORT = 3001
app.listen(PORT, () => {
  console.log(`Webhook server running on port ${PORT}`)
  console.log(`Webhook endpoint: http://localhost:${PORT}/api/vapi-webhook`)
  console.log(`Initiate call endpoint: http://localhost:${PORT}/api/vapi/initiate-call`)
  console.log(`\nUse ngrok: ngrok http ${PORT}`)
})


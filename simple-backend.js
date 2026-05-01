// Simple working backend for CSV upload
// This server will definitely stay alive!

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import express from 'express'
import cors from 'cors'
import { createClient } from '@supabase/supabase-js'

const app = express()
app.use(cors())
app.use(express.json({ limit: '50mb' }))

// Initialize Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

let supabase = null
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey)
  console.log('✅ Supabase connected:', supabaseUrl)
} else {
  console.error('❌ Supabase credentials missing!')
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', supabase: !!supabase })
})

// CSV Upload endpoint
app.post('/api/properties/upload-csv', async (req, res) => {
  try {
    console.log('📤 CSV Upload request received')
    const { csvText, agentId } = req.body
    
    if (!csvText) {
      return res.status(400).json({ error: 'CSV text is required' })
    }

    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not connected' })
    }

    // Parse CSV
    const lines = csvText.trim().split('\n')
    const headers = lines[0].split(',').map(h => h.trim())
    
    let successCount = 0
    const errors = []

    console.log(`Processing ${lines.length - 1} properties...`)

    // Process each row
    for (let i = 1; i < lines.length; i++) {
      try {
        const values = lines[i].split(',').map(v => v.trim())
        const property = {}

        headers.forEach((header, index) => {
          property[header] = values[index]
        })

        // Convert types
        property.price = parseFloat(property.price) || 0
        property.bedrooms = parseInt(property.bedrooms) || 0
        property.bathrooms = parseFloat(property.bathrooms) || 0
        property.sqft = parseInt(property.sqft) || null
        property.agent_id = agentId
        property.status = 'active'

        // Insert into Supabase
        const { error } = await supabase
          .from('properties')
          .insert(property)

        if (error) {
          console.error(`❌ Row ${i} error:`, error.message)
          errors.push(`Row ${i}: ${error.message}`)
        } else {
          successCount++
          console.log(`✅ Inserted property ${successCount}`)
        }
      } catch (error) {
        errors.push(`Row ${i}: ${error.message}`)
      }
    }

    console.log(`✅ Upload complete: ${successCount}/${lines.length - 1} properties`)

    res.json({
      success: true,
      count: successCount,
      errors,
      message: `Successfully uploaded ${successCount} properties`
    })
  } catch (error) {
    console.error('❌ Upload error:', error)
    res.status(500).json({ error: error.message })
  }
})

// Get properties
app.get('/api/properties', async (req, res) => {
  try {
    const agentId = req.query.agentId || req.headers['x-agent-id']
    
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not connected' })
    }

    let query = supabase.from('properties').select('*')
    
    if (agentId) {
      query = query.eq('agent_id', agentId)
    }

    const { data, error } = await query

    if (error) throw error

    res.json({ success: true, properties: data || [] })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Delete property
app.delete('/api/properties/:id', async (req, res) => {
  try {
    const { id } = req.params
    
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not connected' })
    }

    const { error } = await supabase
      .from('properties')
      .delete()
      .eq('id', id)

    if (error) throw error

    res.json({ success: true, message: 'Property deleted' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Start server
const PORT = 3001
const server = app.listen(PORT, () => {
  console.log(`\n✅ Simple Backend Server Running!`)
  console.log(`📍 Port: ${PORT}`)
  console.log(`📍 Health: http://localhost:${PORT}/health`)
  console.log(`📍 Upload CSV: http://localhost:${PORT}/api/properties/upload-csv`)
  console.log(`\n⚠️  Keep this window open!\n`)
})

// Keep alive
process.stdin.resume()
setInterval(() => {}, 1000) // Keep event loop alive

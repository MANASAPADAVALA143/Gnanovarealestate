// Load environment: .env then .env.local (local overrides)
import dotenv from 'dotenv'
dotenv.config({ path: '.env' })
const localResult = dotenv.config({ path: '.env.local', override: true })
if (!localResult.error) {
  console.log('✅ Loaded .env.local (overrides .env)')
} else {
  console.log('ℹ️ No .env.local — using .env only')
}

// Debug: Check if keys are loaded
console.log('🔑 OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? `Set (${process.env.OPENAI_API_KEY.substring(0, 20)}...)` : '❌ NOT SET')
console.log('🔑 SUPABASE_URL:', process.env.SUPABASE_URL ? `Set (${process.env.SUPABASE_URL})` : '❌ NOT SET')
console.log('🔑 VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL ? `Set (${process.env.VITE_SUPABASE_URL})` : '❌ NOT SET')
console.log('🔑 SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? `Set (${process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 20)}...)` : '❌ NOT SET')

import express from 'express'
import cors from 'cors'
import { createClient } from '@supabase/supabase-js'
import { handleVapiWebhook } from './src/api/vapi-webhook.ts'
import { initiatePublicCall } from './src/api/initiate-public-call.ts'
import { scheduleDemo } from './src/api/schedule-demo.ts'
import { supabase } from './src/lib/supabase.ts'
import { generateQueryEmbedding } from './lib/embeddings.ts'
import { verifyFacebookWebhook, handleFacebookLeadWebhook } from './src/api/facebook-webhook.ts'
import { handleVapiInboundCall, updateInboundCall } from './src/api/vapi-inbound.ts'
import { onLeadCreated } from './lib/crm-hooks.ts'
import { CONSENT_TEXT, logConsentToDb } from './src/lib/consent.ts'
import { syncToGoHighLevel } from './src/lib/gohighlevel.ts'
import { 
  createCampaign, 
  addLeadsToCampaign, 
  startCampaign, 
  pauseCampaign,
  getCampaignDetails,
  getAllCampaigns 
} from './src/api/campaigns.ts'
import {
  uploadPropertiesFromCSV,
  getProperties,
  deleteProperty,
  createProperty,
  embedProperties
} from './src/api/properties.ts'
import { searchProperties } from './src/lib/rag-search.ts'
import { generateListing } from './server/api/listing-writer-generate.js'
import { parseDocument, uploadMiddleware } from './server/api/listing-writer-parse.js'
import zillowRouter from './server/routes/zillow-webhook.ts'
import { realtorPortalHandler } from './server/routes/realtor-webhook.ts'
import openHouseRouter from './server/routes/open-house-routes.ts'
import dataDeleteRouter from './server/routes/data-delete-route.ts'
import { createAdSpendRouter } from './server/routes/ad-spend.ts'
import { runOpenHouseScheduler } from './server/lib/open-house-scheduler.ts'
import { runNudgeScheduler } from './server/lib/nudge-scheduler.ts'
import { handleWhatsAppInboundWebhook } from './server/lib/whatsapp-inbound.ts'
import {
  createDealHandler,
  listDealsHandler,
  getDealHandler,
  updateDealHandler,
  dealsSummaryHandler,
} from './server/lib/deals-api.ts'
import {
  updateCommissionHandler,
  listCommissionsHandler,
  commissionsSummaryHandler,
  bulkSubmitCommissionsHandler,
} from './server/lib/commission-api.ts'
import {
  listBrokerInvoicesHandler,
  createBrokerInvoiceHandler,
  updateBrokerInvoiceHandler,
  brokerPaymentStatusHandler,
} from './server/lib/broker-invoices-api.ts'
import {
  listThreadsHandler,
  getThreadHandler,
  assignThreadHandler,
  replyThreadHandler,
  addThreadNoteHandler,
  closeThreadHandler,
} from './server/lib/whatsapp-inbox.ts'
import {
  createViewingHandler,
  listViewingsHandler,
  upcomingViewingsHandler,
  updateViewingHandler,
} from './server/lib/viewings-api.ts'
import { captureRawBody } from './server/lib/capture-raw-body.ts'
import {
  rateLimiter,
  validateFacebookSignature,
  validateTwilioSignature,
  validateVapiSignature,
} from './server/lib/webhook-validation.ts'

const app = express()
app.use(cors())
app.use(rateLimiter)

// Realtor.com: verify HMAC on raw body — must run before express.json()
app.post(
  '/api/portal/realtor',
  express.raw({ type: 'application/json', limit: '2mb' }),
  realtorPortalHandler
)

app.use(express.json({ limit: '2mb', verify: captureRawBody }))
app.use(express.urlencoded({ extended: false, verify: captureRawBody }))

// Zillow: JSON body (parsed by express.json())
app.use('/api/portal/zillow', zillowRouter)

app.use('/api/open-house', openHouseRouter)
app.use('/api/admin', dataDeleteRouter)

app.post('/api/test/run-nudge', async (_req, res) => {
  try {
    await runNudgeScheduler()
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) })
  }
})

// Get Supabase client for server-side operations
function getSupabaseServerClient() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL

  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY

  if (!url) {
    throw new Error(
      'Supabase URL is not configured. Please set SUPABASE_URL in your environment.'
    )
  }

  if (!serviceKey) {
    throw new Error(
      'Supabase service role key is not configured. Please set SUPABASE_SERVICE_ROLE_KEY in your environment.'
    )
  }

  return createClient(url, serviceKey)
}

// Validate and normalize search filters
function validateFilters(body) {
  if (!body || typeof body !== 'object') {
    throw new Error('Request body must be a JSON object')
  }

  const { query, maxPrice, minPrice, minBeds, maxBeds, location, propertyType } = body

  if (!query || typeof query !== 'string' || !query.trim()) {
    throw new Error('query is required and must be a non-empty string')
  }

  const filters = {
    query: query.trim(),
  }

  if (typeof maxPrice === 'number') filters.maxPrice = maxPrice
  if (typeof minPrice === 'number') filters.minPrice = minPrice
  if (typeof minBeds === 'number') filters.minBeds = minBeds
  if (typeof maxBeds === 'number') filters.maxBeds = maxBeds
  if (typeof location === 'string' && location.trim()) filters.location = location.trim()
  if (typeof propertyType === 'string') filters.propertyType = propertyType

  return filters
}

// Apply filters to search results
function applyFilters(rows, filters) {
  let results = [...rows]

  if (typeof filters.minPrice === 'number') {
    results = results.filter((p) => (p.price ?? 0) >= filters.minPrice)
  }

  if (typeof filters.maxPrice === 'number') {
    results = results.filter((p) => (p.price ?? Number.MAX_SAFE_INTEGER) <= filters.maxPrice)
  }

  if (typeof filters.minBeds === 'number') {
    results = results.filter((p) => (p.bedrooms ?? 0) >= filters.minBeds)
  }

  if (typeof filters.maxBeds === 'number') {
    results = results.filter((p) => (p.bedrooms ?? 0) <= filters.maxBeds)
  }

  if (filters.location) {
    const loc = filters.location.toLowerCase()
    results = results.filter((p) => {
      const city = p.city?.toLowerCase() ?? ''
      const state = p.state?.toLowerCase() ?? ''
      return city.includes(loc) || state.includes(loc)
    })
  }

  if (filters.propertyType) {
    results = results.filter((p) => p.property_type === filters.propertyType)
  }

  // Map to PropertySearchResult and sort by similarity descending
  const mapped = results
    .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0))
    .slice(0, 5)
    .map((p, index) => ({
      ...p,
      similarity_score: p.similarity ?? 0,
      rank: index + 1,
    }))

  return mapped
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Debug endpoint to check environment variables (remove in production)
app.get('/debug/env', (req, res) => {
  res.json({
    openai_key_set: !!process.env.OPENAI_API_KEY,
    openai_key_length: process.env.OPENAI_API_KEY?.length || 0,
    openai_key_preview: process.env.OPENAI_API_KEY?.substring(0, 20) + '...' || 'not set',
    supabase_url_set: !!process.env.SUPABASE_URL,
  })
})

app.post('/api/vapi-webhook', validateVapiSignature, async (req, res) => {
  try {
    console.log('Received VAPI webhook:', req.body?.type || 'unknown')
    const result = await handleVapiWebhook(req.body)
    res.json(result)

    // Post-call follow-up email — AFTER 200 so VAPI is not delayed.
    // Does not alter scoring / call insert logic inside handleVapiWebhook.
    const eventType = req.body?.type || req.body?.message?.type
    if (eventType === 'call.ended' || eventType === 'end-of-call-report') {
      setImmediate(() => {
        import('./server/lib/post-call-followup.ts')
          .then(({ schedulePostCallFollowUpFromVapiPayload }) =>
            schedulePostCallFollowUpFromVapiPayload(getSupabaseServerClient(), req.body, result)
          )
          .catch((err) => console.error('[post-call-followup] schedule error:', err))
      })
    }
  } catch (error) {
    console.error('Webhook error:', error)
    const errorMessage = error?.message || 'Webhook processing failed'
    console.error('Error details:', {
      message: errorMessage,
      stack: error?.stack,
    })
    res.status(500).json({ error: errorMessage })
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
    const errorMessage = error?.message || 'Internal server error'
    console.error('Error details:', {
      message: errorMessage,
      stack: error?.stack,
    })
    res.status(500).json({
      error: errorMessage,
    })
  }
})

app.post('/api/schedule-demo', async (req, res) => {
  try {
    const { name, email, phone, company, country, preferredTime, message, consent_given } = req.body

    // Validate required fields
    if (!name || !email || !phone || !country || !preferredTime) {
      return res.status(400).json({
        error: 'Name, email, phone, country, and preferred time are required',
      })
    }

    if (!consent_given) {
      return res.status(400).json({
        error: 'Privacy consent is required before submitting',
      })
    }

    const result = await scheduleDemo({
      name,
      email,
      phone,
      company,
      country,
      preferredTime,
      message,
    })

    res.json(result)
  } catch (error) {
    console.error('Error scheduling demo:', error)
    const errorMessage = error?.message || 'Internal server error'
    console.error('Error details:', {
      message: errorMessage,
      stack: error?.stack,
    })
    res.status(500).json({
      error: errorMessage,
    })
  }
})

// Property search endpoint (RAG)
app.get('/api/properties/search', (req, res) => {
  res.status(405).json({
    error: 'Method not allowed',
    message: 'This endpoint requires a POST request',
    example: {
      method: 'POST',
      url: 'http://localhost:3001/api/properties/search',
      headers: {
        'Content-Type': 'application/json'
      },
      body: {
        query: '3 bedroom house under 500K',
        maxPrice: 500000,
        minBeds: 3,
        location: 'Miami'
      }
    },
    note: 'Use a tool like Postman, curl, or the test script: npm run test-property-search'
  })
})

// Cal.com slot lookup (server-side to avoid browser CORS; API key sent from authenticated dashboard only)
app.post('/api/calcom/slots', async (req, res) => {
  try {
    const { apiKey, username, eventTypeId, startDate, endDate } = req.body || {}
    if (!apiKey || !username || !eventTypeId || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Missing apiKey, username, eventTypeId, startDate, or endDate',
      })
    }
    const url = new URL('https://api.cal.com/v1/slots')
    url.searchParams.set('apiKey', String(apiKey))
    url.searchParams.set('username', String(username))
    url.searchParams.set('eventTypeId', String(eventTypeId))
    url.searchParams.set('startTime', String(startDate))
    url.searchParams.set('endTime', String(endDate))
    const r = await fetch(url.toString())
    const json = await r.json().catch(() => ({}))
    if (!r.ok) {
      return res.status(502).json({
        success: false,
        error: json?.message || json?.error || `Cal.com HTTP ${r.status}`,
        data: json,
      })
    }
    return res.json({ success: true, slots: json })
  } catch (e) {
    console.error('Cal.com slots error:', e)
    return res.status(500).json({ success: false, error: e?.message || 'Server error' })
  }
})

app.post('/api/properties/search', async (req, res) => {
  try {
    const filters = validateFilters(req.body)

    // Generate embedding for the query
    const embedding = await generateQueryEmbedding(filters.query)

    const supabase = getSupabaseServerClient()

    // Call the search_properties SQL function
    const { data, error } = await supabase.rpc('search_properties', {
      query_embedding: embedding,
      match_count: 30,
      similarity_threshold: 0,
    })

    if (error) {
      console.error('Supabase search_properties RPC error:', error)
      return res.status(500).json({
        success: false,
        error: 'Failed to search properties',
      })
    }

    const rows = data ?? []

    // Apply additional filters
    const properties = applyFilters(rows, filters)

    res.json({
      success: true,
      properties,
      query: filters.query,
      resultsCount: properties.length,
    })
  } catch (error) {
    console.error('Error in /api/properties/search:', error)
    res.status(400).json({
      success: false,
      error: error?.message || 'Unexpected server error',
    })
  }
})

app.post('/api/leads/create', async (req, res) => {
  try {
    const leadData = req.body

    // Validate required fields
    if (!leadData.name || !leadData.phone) {
      return res.status(400).json({
        error: 'Name and phone are required',
      })
    }

    if (!leadData.consent_given) {
      return res.status(400).json({
        error: 'Privacy consent is required before submitting',
      })
    }

    // 1. Save lead to Gnanova database
    if (!supabase) {
      return res.status(500).json({
        error: 'Database not configured',
      })
    }

    const { data: lead, error: dbError } = await supabase
      .from('leads')
      .insert({
        name: leadData.name,
        email: leadData.email || null,
        phone: leadData.phone,
        location: leadData.location || null,
        timeline: leadData.timeline || null,
        property_id: leadData.property_id || null,
        source: leadData.source || 'website',
        status: 'new',
        consent_given: true,
        consent_timestamp: leadData.consent_timestamp || new Date().toISOString(),
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (dbError) {
      console.error('Error saving lead:', dbError)
      return res.status(500).json({
        error: 'Failed to save lead to database',
      })
    }

    await onLeadCreated(getSupabaseServerClient(), {
      leadId: lead.id,
      agentId: lead.agent_id || null,
      source: lead.source || 'website',
      channel: 'web_form',
      status: lead.status || 'new',
      consentText: CONSENT_TEXT.lead,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || null,
    })

    await logConsentToDb(getSupabaseServerClient(), {
      lead_id: lead.id,
      email: leadData.email || undefined,
      phone: leadData.phone,
      context: 'lead',
    })

    // 2. NEW: Trigger VAPI call via n8n
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL || process.env.VITE_N8N_WEBHOOK_URL

    if (n8nWebhookUrl) {
      try {
        await fetch(`${n8nWebhookUrl}/lead-to-call`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leadId: lead.id,
            leadName: lead.name,
            leadPhone: lead.phone,
            leadEmail: lead.email,
            propertyId: lead.property_id,
            source: lead.source || 'website',
            timestamp: new Date().toISOString(),
          }),
        })
        console.log('Triggered n8n webhook for lead:', lead.id)
      } catch (n8nError) {
        console.error('Error triggering n8n webhook:', n8nError)
        // Log error but don't fail the request
      }
    } else {
      console.warn('N8N_WEBHOOK_URL not configured, skipping webhook trigger')
    }

    res.json({
      success: true,
      message: 'Lead captured. AI will call within 2 minutes.',
      leadId: lead.id,
    })
  } catch (error) {
    console.error('Error creating lead:', error)
    const errorMessage = error?.message || 'Internal server error'
    console.error('Error details:', {
      message: errorMessage,
      stack: error?.stack,
    })
    res.status(500).json({
      error: errorMessage,
    })
  }
})

// ========================================
// NEW FEATURES: Facebook, Inbound, Campaigns
// ========================================

// Facebook Lead Form Webhook
// GET for verification, POST for lead data
app.get('/api/webhooks/facebook-leads', (req, res) => {
  try {
    const result = verifyFacebookWebhook(req.query)
    if (result.success) {
      res.status(200).send(result.challenge)
    } else {
      res.status(403).json({ error: result.error })
    }
  } catch (error) {
    console.error('Facebook verification error:', error)
    res.status(500).json({ error: error?.message || 'Verification failed' })
  }
})

app.post('/api/webhooks/facebook-leads', validateFacebookSignature, async (req, res) => {
  try {
    const result = await handleFacebookLeadWebhook(req.body)
    if (result.success) {
      res.status(200).json({ success: true, leadId: result.leadId })
    } else {
      res.status(500).json({ error: result.error })
    }
  } catch (error) {
    console.error('Facebook webhook error:', error)
    res.status(500).json({ error: error?.message || 'Webhook processing failed' })
  }
})

// VAPI Inbound Receptionist
app.post('/api/vapi/inbound', validateVapiSignature, async (req, res) => {
  try {
    const result = await handleVapiInboundCall(req.body)
    if (result.success) {
      res.status(200).json({ success: true, callId: result.callId })
    } else {
      res.status(500).json({ error: result.error })
    }
  } catch (error) {
    console.error('Inbound call error:', error)
    res.status(500).json({ error: error?.message || 'Inbound call processing failed' })
  }
})

// VAPI Inbound Call Update (call ended)
app.post('/api/vapi/inbound/update', validateVapiSignature, async (req, res) => {
  try {
    await updateInboundCall(req.body)
    res.status(200).json({ success: true })
  } catch (error) {
    console.error('Inbound call update error:', error)
    res.status(500).json({ error: error?.message || 'Call update failed' })
  }
})

// Outbound Campaigns

// Create new campaign
app.post('/api/campaigns/create', async (req, res) => {
  try {
    const result = await createCampaign(req.body)
    if (result.success) {
      // Automatically add leads to campaign
      await addLeadsToCampaign(result.campaign.id)
      res.status(200).json({ success: true, campaign: result.campaign })
    } else {
      res.status(500).json({ error: result.error })
    }
  } catch (error) {
    console.error('Create campaign error:', error)
    res.status(500).json({ error: error?.message || 'Campaign creation failed' })
  }
})

// Get all campaigns
app.get('/api/campaigns', async (req, res) => {
  try {
    const agentId = req.query.agentId
    const result = await getAllCampaigns(agentId)
    if (result.success) {
      res.status(200).json({ success: true, campaigns: result.campaigns })
    } else {
      res.status(500).json({ error: result.error })
    }
  } catch (error) {
    console.error('Get campaigns error:', error)
    res.status(500).json({ error: error?.message || 'Failed to fetch campaigns' })
  }
})

// Get campaign details
app.get('/api/campaigns/:id', async (req, res) => {
  try {
    const result = await getCampaignDetails(req.params.id)
    if (result.success) {
      res.status(200).json({ success: true, campaign: result.campaign })
    } else {
      res.status(500).json({ error: result.error })
    }
  } catch (error) {
    console.error('Get campaign error:', error)
    res.status(500).json({ error: error?.message || 'Failed to fetch campaign' })
  }
})

// Start campaign
app.post('/api/campaigns/:id/start', async (req, res) => {
  try {
    const result = await startCampaign(req.params.id, req.body.agentId)
    if (result.success) {
      res.status(200).json({ success: true })
    } else {
      res.status(500).json({ error: result.error })
    }
  } catch (error) {
    console.error('Start campaign error:', error)
    res.status(500).json({ error: error?.message || 'Failed to start campaign' })
  }
})

// Pause campaign
app.post('/api/campaigns/:id/pause', async (req, res) => {
  try {
    const result = await pauseCampaign(req.params.id)
    if (result.success) {
      res.status(200).json({ success: true })
    } else {
      res.status(500).json({ error: result.error })
    }
  } catch (error) {
    console.error('Pause campaign error:', error)
    res.status(500).json({ error: error?.message || 'Failed to pause campaign' })
  }
})

// Test GoHighLevel sync
app.post('/api/test/gohighlevel', async (req, res) => {
  try {
    const result = await syncToGoHighLevel(req.body)
    res.status(200).json(result)
  } catch (error) {
    console.error('GHL test error:', error)
    res.status(500).json({ error: error?.message || 'GHL sync failed' })
  }
})

// ========================================
// PROPERTY MANAGEMENT ENDPOINTS
// ========================================

// Upload properties from CSV
app.post('/api/properties/upload-csv', async (req, res) => {
  try {
    const { csvText, agentId } = req.body

    if (!csvText) {
      return res.status(400).json({ error: 'CSV text is required' })
    }

    const result = await uploadPropertiesFromCSV(csvText, agentId)
    
    res.status(200).json({
      success: result.success,
      count: result.count,
      errors: result.errors,
      message: `Successfully uploaded ${result.count} properties`
    })
  } catch (error) {
    console.error('CSV upload error:', error)
    res.status(500).json({ error: error?.message || 'CSV upload failed' })
  }
})

// Generate embeddings for properties
app.post('/api/properties/embed', async (req, res) => {
  try {
    const { propertyIds } = req.body
    
    const count = await embedProperties(propertyIds)
    
    res.status(200).json({
      success: true,
      count,
      message: `Successfully generated embeddings for ${count} properties`
    })
  } catch (error) {
    console.error('Embedding generation error:', error)
    res.status(500).json({ error: error?.message || 'Embedding generation failed' })
  }
})

// Get all properties with optional filters
app.get('/api/properties', async (req, res) => {
  try {
    const filters = {
      agentId: req.query.agentId,
      city: req.query.city,
      minPrice: req.query.minPrice ? parseFloat(req.query.minPrice) : undefined,
      maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice) : undefined,
      bedrooms: req.query.bedrooms ? parseInt(req.query.bedrooms) : undefined,
      status: req.query.status,
    }

    const properties = await getProperties(filters)
    
    res.status(200).json({
      success: true,
      properties,
      count: properties.length
    })
  } catch (error) {
    console.error('Get properties error:', error)
    res.status(500).json({ error: error?.message || 'Failed to fetch properties' })
  }
})

// Create a single property
app.post('/api/properties', async (req, res) => {
  try {
    const property = req.body
    const agentId = req.body.agentId || req.query.agentId

    const propertyId = await createProperty(property, agentId)
    
    res.status(201).json({
      success: true,
      propertyId,
      message: 'Property created successfully'
    })
  } catch (error) {
    console.error('Create property error:', error)
    res.status(500).json({ error: error?.message || 'Failed to create property' })
  }
})

// Delete a property
app.delete('/api/properties/:id', async (req, res) => {
  try {
    const propertyId = req.params.id

    await deleteProperty(propertyId)
    
    res.status(200).json({
      success: true,
      message: 'Property deleted successfully'
    })
  } catch (error) {
    console.error('Delete property error:', error)
    res.status(500).json({ error: error?.message || 'Failed to delete property' })
  }
})

// RAG Search properties
app.post('/api/properties/rag-search', async (req, res) => {
  try {
    const { query, matchCount } = req.body

    if (!query) {
      return res.status(400).json({ error: 'Search query is required' })
    }

    const results = await searchProperties(query, matchCount || 5)
    
    res.status(200).json({
      success: true,
      results,
      count: results.length,
      query
    })
  } catch (error) {
    console.error('RAG search error:', error)
    res.status(500).json({ error: error?.message || 'Property search failed' })
  }
})

// ========================================
// LISTING WRITER ENDPOINTS
// ========================================

// Generate listing content with AI
app.post('/api/listing-writer/generate', generateListing)

// Parse property document with AI
app.post('/api/listing-writer/parse-document', uploadMiddleware, parseDocument)

// ========================================
// COMMISSIONS MODULE (register before /api/deals/:id)
// ========================================

app.get('/api/commissions/summary', async (req, res) => {
  try {
    await commissionsSummaryHandler(getSupabaseServerClient(), req, res)
  } catch (error) {
    console.error('Commissions summary error:', error)
    res.status(500).json({ error: error?.message || 'Internal server error' })
  }
})

app.get('/api/commissions', async (req, res) => {
  try {
    await listCommissionsHandler(getSupabaseServerClient(), req, res)
  } catch (error) {
    console.error('List commissions error:', error)
    res.status(500).json({ error: error?.message || 'Internal server error' })
  }
})

app.post('/api/commissions/bulk-submit', async (req, res) => {
  try {
    await bulkSubmitCommissionsHandler(getSupabaseServerClient(), req, res)
  } catch (error) {
    console.error('Bulk submit commissions error:', error)
    res.status(500).json({ error: error?.message || 'Internal server error' })
  }
})

app.patch('/api/deals/:id/commission', async (req, res) => {
  try {
    await updateCommissionHandler(getSupabaseServerClient(), req, res)
  } catch (error) {
    console.error('Update commission error:', error)
    res.status(500).json({ error: error?.message || 'Internal server error' })
  }
})

// ========================================
// BROKER INVOICES (additive — does not alter commission transitions)
// ========================================

app.get('/api/broker-invoices/payment-status', async (req, res) => {
  try {
    await brokerPaymentStatusHandler(getSupabaseServerClient(), req, res)
  } catch (error) {
    console.error('Broker payment status error:', error)
    res.status(500).json({ error: error?.message || 'Internal server error' })
  }
})

app.get('/api/broker-invoices', async (req, res) => {
  try {
    await listBrokerInvoicesHandler(getSupabaseServerClient(), req, res)
  } catch (error) {
    console.error('List broker invoices error:', error)
    res.status(500).json({ error: error?.message || 'Internal server error' })
  }
})

app.post('/api/broker-invoices', async (req, res) => {
  try {
    await createBrokerInvoiceHandler(getSupabaseServerClient(), req, res)
  } catch (error) {
    console.error('Create broker invoice error:', error)
    res.status(500).json({ error: error?.message || 'Internal server error' })
  }
})

app.patch('/api/broker-invoices/:id', async (req, res) => {
  try {
    await updateBrokerInvoiceHandler(getSupabaseServerClient(), req, res)
  } catch (error) {
    console.error('Update broker invoice error:', error)
    res.status(500).json({ error: error?.message || 'Internal server error' })
  }
})

// ========================================
// META / PORTAL AD SPEND (manual CPL attribution)
// ========================================
app.use('/api/ad-spend', createAdSpendRouter(getSupabaseServerClient))

// ========================================
// DEALS MODULE
// ========================================

app.get('/api/deals/summary', async (req, res) => {
  try {
    await dealsSummaryHandler(getSupabaseServerClient(), req, res)
  } catch (error) {
    console.error('Deals summary error:', error)
    res.status(500).json({ error: error?.message || 'Internal server error' })
  }
})

app.get('/api/deals', async (req, res) => {
  try {
    await listDealsHandler(getSupabaseServerClient(), req, res)
  } catch (error) {
    console.error('List deals error:', error)
    res.status(500).json({ error: error?.message || 'Internal server error' })
  }
})

app.post('/api/deals', async (req, res) => {
  try {
    await createDealHandler(getSupabaseServerClient(), req, res)
  } catch (error) {
    console.error('Create deal error:', error)
    res.status(500).json({ error: error?.message || 'Internal server error' })
  }
})

app.get('/api/deals/:id', async (req, res) => {
  try {
    await getDealHandler(getSupabaseServerClient(), req, res)
  } catch (error) {
    console.error('Get deal error:', error)
    res.status(500).json({ error: error?.message || 'Internal server error' })
  }
})

app.patch('/api/deals/:id', async (req, res) => {
  try {
    await updateDealHandler(getSupabaseServerClient(), req, res)
  } catch (error) {
    console.error('Update deal error:', error)
    res.status(500).json({ error: error?.message || 'Internal server error' })
  }
})

// ========================================
// WHATSAPP INBOX
// ========================================

app.get('/api/whatsapp/threads', async (req, res) => {
  try {
    await listThreadsHandler(getSupabaseServerClient(), req, res)
  } catch (error) {
    console.error('List WhatsApp threads error:', error)
    res.status(500).json({ error: error?.message || 'Internal server error' })
  }
})

app.get('/api/whatsapp/threads/:id', async (req, res) => {
  try {
    await getThreadHandler(getSupabaseServerClient(), req, res)
  } catch (error) {
    console.error('Get WhatsApp thread error:', error)
    res.status(500).json({ error: error?.message || 'Internal server error' })
  }
})

app.post('/api/whatsapp/threads/:id/assign', async (req, res) => {
  try {
    await assignThreadHandler(getSupabaseServerClient(), req, res)
  } catch (error) {
    console.error('Assign WhatsApp thread error:', error)
    res.status(500).json({ error: error?.message || 'Internal server error' })
  }
})

app.post('/api/whatsapp/threads/:id/reply', async (req, res) => {
  try {
    await replyThreadHandler(getSupabaseServerClient(), req, res)
  } catch (error) {
    console.error('Reply WhatsApp thread error:', error)
    res.status(500).json({ error: error?.message || 'Internal server error' })
  }
})

app.post('/api/whatsapp/threads/:id/notes', async (req, res) => {
  try {
    await addThreadNoteHandler(getSupabaseServerClient(), req, res)
  } catch (error) {
    console.error('WhatsApp thread note error:', error)
    res.status(500).json({ error: error?.message || 'Internal server error' })
  }
})

app.post('/api/whatsapp/threads/:id/close', async (req, res) => {
  try {
    await closeThreadHandler(getSupabaseServerClient(), req, res)
  } catch (error) {
    console.error('Close WhatsApp thread error:', error)
    res.status(500).json({ error: error?.message || 'Internal server error' })
  }
})

// ========================================
// VIEWINGS MODULE (register /upcoming before /:id)
// ========================================

app.get('/api/viewings/upcoming', async (req, res) => {
  try {
    await upcomingViewingsHandler(getSupabaseServerClient(), req, res)
  } catch (error) {
    console.error('Upcoming viewings error:', error)
    res.status(500).json({ error: error?.message || 'Internal server error' })
  }
})

app.get('/api/viewings', async (req, res) => {
  try {
    await listViewingsHandler(getSupabaseServerClient(), req, res)
  } catch (error) {
    console.error('List viewings error:', error)
    res.status(500).json({ error: error?.message || 'Internal server error' })
  }
})

app.post('/api/viewings', async (req, res) => {
  try {
    await createViewingHandler(getSupabaseServerClient(), req, res)
  } catch (error) {
    console.error('Create viewing error:', error)
    res.status(500).json({ error: error?.message || 'Internal server error' })
  }
})

app.patch('/api/viewings/:id', async (req, res) => {
  try {
    await updateViewingHandler(getSupabaseServerClient(), req, res)
  } catch (error) {
    console.error('Update viewing error:', error)
    res.status(500).json({ error: error?.message || 'Internal server error' })
  }
})

// Twilio inbound WhatsApp (urlencoded body — validated via x-twilio-signature)
app.post(
  '/webhook/whatsapp/inbound',
  validateTwilioSignature,
  async (req, res) => {
    try {
      const { twiml, status } = await handleWhatsAppInboundWebhook(req)
      res.type('text/xml').status(status).send(twiml)
    } catch (error) {
      console.error('WhatsApp inbound webhook error:', error)
      res
        .type('text/xml')
        .status(500)
        .send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>')
    }
  }
)

// Global error handler (must be last)
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err)
  }
  console.error('Unhandled error:', err)
  res.status(500).json({
    error: err?.message || 'Internal server error',
  })
})

// ========================================
// 404 Handler (must be LAST!)
// ========================================
app.use((req, res) => {
  console.log(`❌ 404 Not Found: ${req.method} ${req.path}`)
  res.status(404).json({ error: 'Endpoint not found', path: req.path })
})

// ========================================
// Start Server
// ========================================
const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`\n✅ Webhook server running on port ${PORT}`)
  console.log(`\n📍 Core Endpoints:`)
  console.log(`   Health check: http://localhost:${PORT}/health`)
  console.log(`   VAPI webhook: http://localhost:${PORT}/api/vapi-webhook`)
  console.log(`   Create lead: http://localhost:${PORT}/api/leads/create`)
  console.log(`   Property search: http://localhost:${PORT}/api/properties/search`)
  console.log(`   Schedule demo: http://localhost:${PORT}/api/schedule-demo`)
  console.log(`   Initiate call: http://localhost:${PORT}/api/vapi/initiate-call`)
  
  console.log(`\n📍 NEW: Integration Endpoints:`)
  console.log(`   Facebook webhook: http://localhost:${PORT}/api/webhooks/facebook-leads`)
  console.log(`   Inbound calls: http://localhost:${PORT}/api/vapi/inbound`)
  console.log(`   WhatsApp inbound: http://localhost:${PORT}/webhook/whatsapp/inbound`)
  console.log(`   Test GHL sync: http://localhost:${PORT}/api/test/gohighlevel`)
  
  console.log(`\n📍 NEW: Campaign Endpoints:`)
  console.log(`   Create campaign: http://localhost:${PORT}/api/campaigns/create`)
  console.log(`   List campaigns: http://localhost:${PORT}/api/campaigns`)
  console.log(`   Start campaign: http://localhost:${PORT}/api/campaigns/:id/start`)
  console.log(`   Get campaign: http://localhost:${PORT}/api/campaigns/:id`)
  
  console.log(`\n📍 Property Management Endpoints:`)
  console.log(`   Upload CSV: http://localhost:${PORT}/api/properties/upload-csv`)
  console.log(`   Generate embeddings: http://localhost:${PORT}/api/properties/embed`)
  console.log(`   Get properties: http://localhost:${PORT}/api/properties`)
  console.log(`   Create property: http://localhost:${PORT}/api/properties`)
  console.log(`   Delete property: http://localhost:${PORT}/api/properties/:id`)
  console.log(`   RAG search: http://localhost:${PORT}/api/properties/rag-search`)
  
  console.log(`\n📍 Listing Writer Endpoints:`)
  console.log(`   Generate listing: http://localhost:${PORT}/api/listing-writer/generate`)
  console.log(`   Parse document: http://localhost:${PORT}/api/listing-writer/parse-document`)
  
  console.log(`\n💡 Use ngrok: ngrok http ${PORT}`)
  console.log(`📚 Setup guide: See NEW_FEATURES_SETUP.md`)
  console.log(`\n📍 Lead nudge test: POST http://localhost:${PORT}/api/test/run-nudge\n`)

  void runOpenHouseScheduler().catch((e) => console.error('[open-house-scheduler] startup run:', e))
  setInterval(
    () => {
      void runOpenHouseScheduler().catch((e) => console.error('[open-house-scheduler]', e))
    },
    5 * 60 * 1000
  )

  void runNudgeScheduler().catch((e) => console.error('[nudge-scheduler] startup run:', e))
  setInterval(
    () => {
      void runNudgeScheduler().catch((e) => console.error('[nudge-scheduler]', e))
    },
    60 * 60 * 1000
  )
})

// ========================================
// Error Handlers - Keep Process Alive
// ========================================
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason)
})

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error)
})

// Keep process alive
process.stdin.resume()


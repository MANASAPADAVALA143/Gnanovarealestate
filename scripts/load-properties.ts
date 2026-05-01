import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { type Property } from '../types/property'
import {
  batchGenerateEmbeddings,
} from '../lib/embeddings'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

type DbPropertyInsert = Omit<Property, 'embedding'> & {
  embedding: number[] | null
}

function getSupabaseClient(): SupabaseClient {
  const url =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_ANON_KEY

  if (!url) {
    throw new Error(
      'Supabase URL is not set. Please set SUPABASE_URL, VITE_SUPABASE_URL, or NEXT_PUBLIC_SUPABASE_URL.'
    )
  }

  if (!serviceKey) {
    throw new Error(
      'Supabase service key is not set. Please set SUPABASE_SERVICE_ROLE_KEY (recommended) or SUPABASE_SERVICE_KEY.'
    )
  }

  return createClient(url, serviceKey)
}

async function loadSampleProperties() {
  console.log('🚀 Starting property load script...')

  const supabase = getSupabaseClient()

  const dataPath = path.resolve(__dirname, '../data/sample-properties.json')

  let raw: string
  try {
    raw = await fs.readFile(dataPath, 'utf-8')
  } catch (error) {
    console.error('❌ Failed to read sample-properties.json:', error)
    process.exit(1)
  }

  let properties: Property[]
  try {
    properties = JSON.parse(raw)
  } catch (error) {
    console.error('❌ Failed to parse sample-properties.json as JSON:', error)
    process.exit(1)
  }

  if (!Array.isArray(properties) || properties.length === 0) {
    console.error('❌ No properties found in sample-properties.json')
    process.exit(1)
  }

  console.log(`📦 Loaded ${properties.length} properties from JSON file`)

  // First generate embeddings in batches
  console.log('🧠 Generating embeddings for properties using OpenAI...')
  const withEmbeddings = await batchGenerateEmbeddings(properties)

  let loadedCount = 0
  let skippedCount = 0
  const errors: { address: string | null; error: unknown }[] = []

  for (let index = 0; index < withEmbeddings.length; index++) {
    const property = withEmbeddings[index]
    const label = `${index + 1}/${withEmbeddings.length}`

    const addressKey = [property.address, property.city, property.state]
      .filter(Boolean)
      .join(', ')

    if (!property.address) {
      console.warn(`⚠️ [${label}] Skipping property with missing address`)
      skippedCount++
      continue
    }

    try {
      // Check for duplicate by address + city + state
      const { data: existing, error: existingError } = await supabase
        .from('properties')
        .select('id, address, city, state')
        .eq('address', property.address)
        .eq('city', property.city)
        .eq('state', property.state)
        .limit(1)

      if (existingError) {
        throw existingError
      }

      if (existing && existing.length > 0) {
        console.log(`⏭️  [${label}] Skipping duplicate property: ${addressKey}`)
        skippedCount++
        continue
      }

      const insertPayload: DbPropertyInsert = {
        ...property,
        // Ensure nulls where appropriate
        hoa_fee: property.hoa_fee ?? null,
        photos: property.photos ?? [],
        amenities: property.amenities ?? [],
        metadata: property.metadata ?? {},
        embedding: property.embedding ?? null,
      }

      const { error: insertError } = await supabase
        .from('properties')
        .insert(insertPayload)

      if (insertError) {
        throw insertError
      }

      loadedCount++
      console.log(`✅ [${label}] Loaded property: ${addressKey}`)
    } catch (error) {
      console.error(`❌ [${label}] Failed to load property: ${addressKey}`, error)
      errors.push({ address: property.address ?? null, error })
    }
  }

  console.log('\n📊 Load summary')
  console.log('---------------------------')
  console.log(`Total properties in file : ${withEmbeddings.length}`)
  console.log(`✅ Loaded                 : ${loadedCount}`)
  console.log(`⏭️  Skipped (duplicates)   : ${skippedCount}`)
  console.log(`❌ Errors                 : ${errors.length}`)

  if (errors.length > 0) {
    console.log('\nError details:')
    errors.forEach((e, idx) => {
      console.log(
        `  ${idx + 1}. Address: ${e.address ?? 'Unknown'} | Error: ${
          (e.error as any)?.message || String(e.error)
        }`
      )
    })
  }

  console.log('\n🎉 Property load script finished.')
}

// Run if invoked directly
loadSampleProperties().catch((error) => {
  console.error('Unexpected error in load-properties script:', error)
  process.exit(1)
})


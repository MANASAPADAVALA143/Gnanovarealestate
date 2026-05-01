import OpenAI from 'openai'
import { type Property } from '../types/property'

const OPENAI_EMBEDDING_MODEL = 'text-embedding-ada-002'

// Simple factory so this module can be imported in environments
// where OPENAI_API_KEY might not be set (e.g. build step).
const getOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set. Please add it to your environment.')
  }

  return new OpenAI({ apiKey })
}

function propertyToEmbeddingText(property: Property): string {
  const address = property.address ?? 'Unknown address'
  const city = property.city ?? ''
  const state = property.state ?? ''
  const price = property.price ? `$${property.price.toLocaleString()}` : 'Price not specified'
  const beds = property.bedrooms ?? 'N/A'
  const baths = property.bathrooms ?? 'N/A'
  const sqft = property.sqft ? `${property.sqft} sqft` : 'Size not specified'
  const description = property.description ?? ''
  const amenities = property.amenities && property.amenities.length > 0 ? property.amenities.join(', ') : 'None specified'
  const schoolDistrict = property.school_district ?? 'Not specified'

  return `${address} in ${city}, ${state}. ${price}. ${beds} bed, ${baths} bath. ${sqft}. ${description}. Amenities: ${amenities}. School district: ${schoolDistrict}.`
}

async function createEmbedding(input: string): Promise<number[]> {
  const client = getOpenAIClient()

  try {
    const response = await client.embeddings.create({
      model: OPENAI_EMBEDDING_MODEL,
      input,
    })

    const embedding = response.data[0]?.embedding

    if (!embedding) {
      throw new Error('No embedding returned from OpenAI')
    }

    // text-embedding-ada-002 returns 1536-dim vectors
    if (embedding.length !== 1536) {
      console.warn(
        `Expected embedding length 1536, received ${embedding.length}. Continuing but check your model configuration.`
      )
    }

    return embedding
  } catch (error: any) {
    console.error('Error generating embedding with OpenAI:', error)
    throw new Error(error?.message || 'Failed to generate embedding')
  }
}

/**
 * Generate an embedding vector for a single property.
 */
export async function generatePropertyEmbedding(property: Property): Promise<number[]> {
  const text = propertyToEmbeddingText(property)
  return createEmbedding(text)
}

/**
 * Generate an embedding vector for a natural language search query.
 */
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  return createEmbedding(query)
}

/**
 * Generate embeddings for a list of properties in small batches.
 * Mutates the returned Property objects by setting the `embedding` field.
 *
 * Note: This function is intended for server-side use only.
 */
export async function batchGenerateEmbeddings(properties: Property[]): Promise<Property[]> {
  if (properties.length === 0) return []

  const client = getOpenAIClient()

  const BATCH_SIZE = 64 // OpenAI supports batching; keep this reasonable for rate-limits
  const RATE_LIMIT_DELAY_MS = 250 // basic client-side throttling between batches

  const updated: Property[] = []

  for (let i = 0; i < properties.length; i += BATCH_SIZE) {
    const batch = properties.slice(i, i + BATCH_SIZE)

    const inputs = batch.map((prop) => propertyToEmbeddingText(prop))

    try {
      const response = await client.embeddings.create({
        model: OPENAI_EMBEDDING_MODEL,
        input: inputs,
      })

      if (!response.data || response.data.length !== batch.length) {
        console.warn(
          `Embedding batch size mismatch. Expected ${batch.length}, got ${response.data?.length ?? 0}.`
        )
      }

      batch.forEach((prop, index) => {
        const embedding = response.data[index]?.embedding
        if (!embedding) {
          console.warn(`Missing embedding for property id=${prop.id} in batch starting at index ${i}`)
          updated.push({ ...prop, embedding: null })
          return
        }

        if (embedding.length !== 1536) {
          console.warn(
            `Property id=${prop.id} embedding length ${embedding.length} (expected 1536).`
          )
        }

        updated.push({ ...prop, embedding })
      })

      // Simple progress indicator in logs
      const processed = Math.min(i + BATCH_SIZE, properties.length)
      console.log(`Generated embeddings for ${processed}/${properties.length} properties`)
    } catch (error: any) {
      console.error(
        `Error generating embeddings for batch starting at index ${i}:`,
        error
      )

      // On error, push originals without embeddings so caller can decide what to do
      batch.forEach((prop) => {
        updated.push({ ...prop, embedding: prop.embedding ?? null })
      })
    }

    // Basic delay between batches to stay under rate limits
    if (i + BATCH_SIZE < properties.length) {
      await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY_MS))
    }
  }

  return updated
}


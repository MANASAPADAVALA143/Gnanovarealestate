import OpenAI from 'openai'
import dotenv from 'dotenv'

dotenv.config()

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

/**
 * Helper function to call GPT and get text response
 */
async function callGPT(systemPrompt, userPrompt, temperature = 0.7) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    temperature,
    max_tokens: 2048,
    messages: [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: userPrompt
      }
    ]
  })

  return response.choices[0].message.content
}

/**
 * Generate listing content using OpenAI GPT-4
 */
export async function generateListing(req, res) {
  try {
    const { propertyData, agentName, agentEmail } = req.body

    if (!propertyData) {
      return res.status(400).json({
        success: false,
        error: 'Property data is required'
      })
    }

    // Build property description
    const propertyDetails = `
Property Type: ${propertyData.propertyType || 'Not specified'}
Location: ${propertyData.location || 'Not specified'}
Price: ${propertyData.price || 'Not specified'}
Bedrooms: ${propertyData.bedrooms || 'Not specified'}
Bathrooms: ${propertyData.bathrooms || 'Not specified'}
Square Feet: ${propertyData.sqft || 'Not specified'}
Features: ${propertyData.features?.join(', ') || 'Not specified'}
Unique Selling Points: ${propertyData.sellingPoints || 'Not specified'}
    `.trim()

    console.log('🤖 Generating listing content for:', propertyData.location)

    // Generate all content types in parallel
    const [fullDescription, instagramCaption, facebookPost, buyerEmail, whatsappMessage] = await Promise.all([
      generateFullDescription(propertyDetails, agentName),
      generateInstagramCaption(propertyDetails),
      generateFacebookPost(propertyDetails, agentName),
      generateBuyerEmail(propertyDetails, agentName, agentEmail),
      generateWhatsAppMessage(propertyDetails, agentName)
    ])

    return res.json({
      success: true,
      content: {
        fullDescription,
        instagramCaption,
        facebookPost,
        buyerEmail,
        whatsappMessage
      }
    })

  } catch (error) {
    console.error('❌ Error generating listing:', error)
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate listing content'
    })
  }
}

async function generateFullDescription(propertyDetails, agentName) {
  return await callGPT(
    'You are a professional real estate copywriter. Write compelling, detailed property descriptions that highlight key features and create emotional appeal. Use vivid language and focus on lifestyle benefits.',
    `Write a comprehensive property listing description (300-400 words) for:\n\n${propertyDetails}\n\nMake it engaging, highlight the best features, and paint a picture of the lifestyle. End with a call to action mentioning ${agentName}.`,
    0.7
  )
}

async function generateInstagramCaption(propertyDetails) {
  return await callGPT(
    'You are a social media expert for real estate. Write engaging Instagram captions that are concise, use emojis strategically, and include relevant hashtags.',
    `Write an Instagram caption (150 characters max) for this property:\n\n${propertyDetails}\n\nInclude 3-5 emojis and 5-8 relevant hashtags at the end. Be catchy and scroll-stopping.`,
    0.8
  )
}

async function generateFacebookPost(propertyDetails, agentName) {
  return await callGPT(
    'You are a social media expert for real estate. Write Facebook posts that are conversational, engaging, and encourage comments and shares.',
    `Write a Facebook post (200-250 words) for this property:\n\n${propertyDetails}\n\nMake it conversational and engaging. Include a question to encourage engagement. Mention ${agentName} at the end with contact info prompt.`,
    0.7
  )
}

async function generateBuyerEmail(propertyDetails, agentName, agentEmail) {
  return await callGPT(
    'You are a professional real estate agent. Write personalized email templates to send property details to potential buyers. Be professional but warm.',
    `Write a professional email to send to a potential buyer about this property:\n\n${propertyDetails}\n\nInclude:
- Warm greeting
- Property highlights
- Why it matches their needs
- Next steps / call to action
- Professional signature from ${agentName}${agentEmail ? ` (${agentEmail})` : ''}

Keep it 250-300 words.`,
    0.6
  )
}

async function generateWhatsAppMessage(propertyDetails, agentName) {
  return await callGPT(
    'You are a real estate agent sending property details via WhatsApp. Write concise, friendly messages that work well for instant messaging. Use emojis but not excessively.',
    `Write a WhatsApp message (100-150 words) to send property details:\n\n${propertyDetails}\n\nBe friendly and conversational. Use 2-3 emojis. Keep it brief but informative. Sign off as ${agentName}.`,
    0.7
  )
}

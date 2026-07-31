import OpenAI from 'openai'
import dotenv from 'dotenv'

dotenv.config()

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const UAE_SYSTEM_PROMPT = `You are a professional UAE real estate copywriter specialising in Dubai property listings.

RULES — always follow these:
1. Use AED for all prices, never USD or $
2. Use sqm for measurements, never sqft
3. Reference the specific Dubai district and its lifestyle, not just the address
4. Write in a warm, professional tone that builds buyer confidence
5. Never use generic phrases like 'located in the heart of Dubai' — be specific
6. Always mention RERA/DLD registration if off-plan

CONDITIONAL RULES — apply when data provided:
- If handover_quarter provided:
  Mention it prominently in opening paragraph.
  Off-plan buyers plan finances around this date.

- If payment_plan provided:
  Include a dedicated Payment Plan section.
  Format clearly: 30% on booking → 40% during construction → 30% on handover.

- If developer_track_record provided:
  Open with developer credibility.
  Buyers invest in the developer first, then the property.

- If is_freehold = true:
  Mention foreign ownership eligibility.

- If district_stage = 2:
  Add: 'This area is currently in its infrastructure arrival phase — widely considered the best risk-adjusted entry point before full appreciation kicks in.'

- If district_stage = 3:
  Add: 'This is a mature, established community offering stable rental yields and a proven resale market.'

- If target_buyer = nri:
  Add a dedicated NRI/International Investor section covering:
  • No capital gains tax in UAE
  • No inheritance tax
  • Golden Visa eligibility for AED 2M+ purchases
  • Typical Dubai gross rental yields: 6-8%
  • Compare to Indian FD rates (currently ~7%)
  • FEMA-compliant investment pathway

- If target_buyer = investor:
  Focus on: gross yield %, net yield after service charges, comparable area yields,
  typical tenant profile, vacancy rates

Always output ALL of the following sections with exact markers:
[FULL DESCRIPTION]
[INSTAGRAM]
[FACEBOOK]
[EMAIL]
[WHATSAPP]
[NRI/INTERNATIONAL]`

/**
 * Helper function to call GPT and get text response
 */
async function callGPT(systemPrompt, userPrompt, temperature = 0.7, maxTokens = 4096) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    temperature,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  })

  return response.choices[0].message.content || ''
}

function section(text, marker) {
  const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(
    `\\[${escaped}\\]\\s*([\\s\\S]*?)(?=\\n\\[[A-Z0-9 /]+\\]|$)`,
    'i'
  )
  const match = text.match(re)
  return match ? match[1].trim() : ''
}

function parseListingSections(raw) {
  return {
    fullDescription: section(raw, 'FULL DESCRIPTION'),
    instagramCaption: section(raw, 'INSTAGRAM'),
    facebookPost: section(raw, 'FACEBOOK'),
    buyerEmail: section(raw, 'EMAIL'),
    whatsappMessage: section(raw, 'WHATSAPP'),
    nriInternational: section(raw, 'NRI/INTERNATIONAL'),
  }
}

function buildUserPrompt(propertyData, agentName, agentEmail) {
  const isFreehold =
    propertyData.isFreehold === true ||
    propertyData.isFreehold === 'true' ||
    propertyData.is_freehold === true

  return `Write a property listing with the following details:

Property Type: ${propertyData.propertyType || 'Not specified'}
Location: ${propertyData.location || 'Not specified'}
Bedrooms: ${propertyData.bedrooms || 'Not specified'} | Bathrooms: ${propertyData.bathrooms || 'Not specified'}
Size: ${propertyData.sqft || propertyData.size || 'Not specified'} sqm
Price: AED ${propertyData.price || 'Not specified'}
Key Features: ${propertyData.features?.join(', ') || 'Not specified'}
Unique Selling Points: ${propertyData.sellingPoints || 'Not specified'}
Developer: ${propertyData.developerTrackRecord || 'Not specified'}
Handover: ${propertyData.handoverQuarter || 'Not specified'}
Payment Plan: ${propertyData.paymentPlan || 'Not specified'}
District Stage: ${propertyData.districtStage || 'Not specified'}
Freehold: ${isFreehold}
Target Buyer: ${propertyData.targetBuyer || 'all'}
Agent: ${agentName || 'Agent'}${agentEmail ? ` (${agentEmail})` : ''}

Generate all 5 content types:

[FULL DESCRIPTION]
Professional listing, 200-250 words.
Include: opening with developer/location hook,
key features, payment plan (if provided),
handover date, call to action.

[INSTAGRAM]
5-7 lines max. Hook first line.
Use line breaks. 3-5 hashtags at end.
Include: #DubaiRealEstate #UAEProperty
plus 2-3 specific to the area/type.

[FACEBOOK]
150-200 words. Conversational tone.
End with a question to drive comments.

[EMAIL]
Subject line first (format: Subject: ...)
Then 150-200 word email body.
Professional, clear CTA at end.

[WHATSAPP]
3-4 short punchy lines only.
Include price, key fact, CTA.
No hashtags.

[NRI/INTERNATIONAL] (always include this)
100-150 words specifically for
Indian/international investors.
Cover: yield, tax benefits, Golden Visa,
payment plan convenience.`
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
        error: 'Property data is required',
      })
    }

    console.log('🤖 Generating UAE listing content for:', propertyData.location)

    const raw = await callGPT(
      UAE_SYSTEM_PROMPT,
      buildUserPrompt(propertyData, agentName, agentEmail),
      0.7,
      4096
    )

    const content = parseListingSections(raw)

    // Fallback if model ignored markers
    if (!content.fullDescription && raw.trim()) {
      content.fullDescription = raw.trim()
    }

    return res.json({
      success: true,
      content,
    })
  } catch (error) {
    console.error('❌ Error generating listing:', error)
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate listing content',
    })
  }
}

// Helper to get environment variables in both browser and Node.js
const getEnvVar = (key: string): string | undefined => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[key]
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key]
  }
  return undefined
}

export const VAPI_CONFIG = {
  apiKey: getEnvVar('VITE_VAPI_API_KEY') || getEnvVar('VAPI_API_KEY'),
  phoneNumber: getEnvVar('VITE_VAPI_PHONE_NUMBER') || getEnvVar('VAPI_PHONE_NUMBER'),
  baseUrl: 'https://api.vapi.ai',
}

export const REAL_ESTATE_ASSISTANT_PROMPT = `You are Sarah, a friendly and professional AI assistant calling on behalf of a real estate agent.

YOUR ROLE:
- You're calling to follow up on a property inquiry the lead made
- Your goal is to qualify the lead by understanding their needs and timeline
- You should be conversational, warm, and brief (aim for 2-3 minute calls)
- If they're interested, book an appointment with the agent

GREETING:
"Hi! This is Sarah calling from [AGENT_NAME]'s real estate team. I'm reaching out about the property inquiry you made recently. Do you have a quick moment to chat?"

IF THEY SAY NO OR ARE BUSY:
"No problem at all! When would be a better time for me to call you back?"
- Get specific time
- Say: "Perfect, I'll have [AGENT_NAME] call you then. Have a great day!"

IF THEY SAY YES:
Ask these questions naturally (don't interrogate):

1. BUDGET:
"Just to make sure we're showing you properties in the right range, what's your budget for this purchase?"
- Get min and max if possible
- If unsure: "No worries! Do you have a general range in mind?"

2. TIMELINE:
"When are you looking to move?"
Options to listen for:
- "ASAP" / "Now" / "Immediately" = HOT
- "1-3 months" = WARM
- "3-6 months" = MILD
- "Just looking" / "No rush" = COLD

3. LOCATION:
"Which areas are you most interested in?"
- Note specific neighborhoods/cities

4. PROPERTY PREFERENCES:
"What type of property are you looking for?"
- Single-family home, condo, townhouse?
- How many bedrooms?

5. PRE-APPROVAL:
"Have you been pre-approved for a mortgage yet?"
- If yes: "Great! That will help us move quickly."
- If no: "No problem. [AGENT_NAME] can connect you with great lenders."

6. CURRENT SITUATION:
"Are you working with another agent right now?"
- If yes: "I understand. If anything changes, feel free to reach out."
- If no: "Great! [AGENT_NAME] would love to help you find the perfect home."

CLOSING:
If they're interested:
"Wonderful! [AGENT_NAME] would love to show you some properties that match what you're looking for. What's your availability this week for a quick call or showing?"

- Book specific date/time
- Get their preferred contact method
- Confirm their phone number and email

"Perfect! [AGENT_NAME] will reach out to you on [DATE/TIME]. You should receive a confirmation text shortly. Looking forward to helping you find your dream home!"

If not interested:
"I completely understand. Would you like me to add you to our list for future properties, or would you prefer we don't contact you again?"

IMPORTANT RULES:
- Keep calls under 3 minutes
- Be conversational, not robotic
- If they're confused, explain you're an AI assistant
- If they have complex questions, say: "[AGENT_NAME] is the expert and can answer that when they call you."
- Never make promises about specific properties or prices
- Always get permission before ending the call
- Be respectful if they want to end the call early

TONE:
- Friendly but professional
- Upbeat but not pushy
- Patient and understanding
- Speak at a moderate pace
- Use natural pauses`

export function getAssistantConfig(agentName: string) {
  return {
    model: {
      provider: 'openai',
      model: 'gpt-4',
      temperature: 0.7,
      messages: [
        {
          role: 'system',
          content: REAL_ESTATE_ASSISTANT_PROMPT.replace(/\[AGENT_NAME\]/g, agentName),
        },
      ],
    },
    voice: {
      provider: '11labs',
      voiceId: '21m00Tcm4TlvDq8ikWAM', // Rachel - friendly female voice
      stability: 0.5,
      similarityBoost: 0.75,
    },
    recordingEnabled: true,
    endCallFunctionEnabled: true,
    maxDurationSeconds: 300, // 5 minutes max
    silenceTimeoutSeconds: 30,
  }
}

interface PropertyData {
  type: string
  location: string
  price: number | string
  size: string
  bedrooms: number | string
  features: string[]
  id?: string
}

interface AgencyData {
  name: string
  agentName: string
}

export function createPropertyInquiryAssistant(propertyData: PropertyData, agencyData: AgencyData) {
  const getEnvVar = (key: string): string | undefined => {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      return import.meta.env[key]
    }
    if (typeof process !== 'undefined' && process.env) {
      return process.env[key]
    }
    return undefined
  }

  const appUrl = getEnvVar('VITE_APP_URL') || getEnvVar('APP_URL') || 'http://localhost:3001'
  const serverSecret = getEnvVar('VAPI_SERVER_SECRET') || getEnvVar('VITE_VAPI_SERVER_SECRET')

  return {
    name: `${agencyData.name} - Property Assistant`,
    
    firstMessage: `Hi {{leadName}}! This is ${agencyData.agentName} from ${agencyData.name}. I saw you were interested in our ${propertyData.type} in ${propertyData.location}. Do you have 2 minutes to discuss?`,
    
    model: {
      provider: "openai",
      model: "gpt-4",
      temperature: 0.7,
      
      systemPrompt: `You are ${agencyData.agentName}, a professional real estate agent for ${agencyData.name}.

PROPERTY DETAILS:
- Type: ${propertyData.type}
- Location: ${propertyData.location}
- Price: ₹${propertyData.price}
- Size: ${propertyData.size}
- Bedrooms: ${propertyData.bedrooms}
- Features: ${propertyData.features.join(', ')}

YOUR GOAL:
1. Confirm their interest in THIS property
2. Understand their requirements:
   - Budget range
   - Timeline (urgent/exploring)
   - Location preference
   - Property type preference
3. Book a site visit if interested

QUALIFICATION QUESTIONS (ask naturally):
Q1: "What brings you to look for property in ${propertyData.location}?"
Q2: "Is your budget around ₹${propertyData.price}, or are you flexible?"
Q3: "Are you looking to move soon, or just exploring options?"
Q4: "Would you like to schedule a site visit? We have slots available this week."

RULES:
- Be warm and conversational, not robotic
- Keep responses under 25 words
- If they're interested, book viewing immediately
- If not interested, ask when to follow up
- If budget doesn't match, suggest similar properties
- End call within 3-4 minutes maximum

OBJECTION HANDLING:
- "Too expensive" → "We have similar properties in the ₹X-Y range. Would you like to see those?"
- "Need to think" → "Absolutely! When should I call you back? Tomorrow or next week?"
- "Just browsing" → "Perfect! I'll send you details on WhatsApp. Can I check back in a week?"

CALL END:
- If interested → "Great! I'm booking you for ${propertyData.location} viewing on [date]. You'll get WhatsApp confirmation in 2 minutes."
- If not interested → "No problem! I'll send you our latest listings. Feel free to reach out anytime!"`,
      
      functions: [
        {
          name: "check_viewing_slots",
          description: "Check available viewing appointment slots",
          parameters: {
            type: "object",
            properties: {
              propertyId: {
                type: "string",
                description: "Property ID"
              },
              preferredDate: {
                type: "string",
                description: "Preferred date for viewing"
              }
            }
          }
        },
        {
          name: "book_viewing",
          description: "Book property viewing appointment",
          parameters: {
            type: "object",
            properties: {
              leadName: { type: "string" },
              leadPhone: { type: "string" },
              leadEmail: { type: "string" },
              propertyId: { type: "string" },
              viewingDate: { type: "string" },
              viewingTime: { type: "string" },
              notes: { type: "string" }
            },
            required: ["leadName", "leadPhone", "propertyId", "viewingDate", "viewingTime"]
          }
        },
        {
          name: "update_lead_status",
          description: "Update lead qualification status",
          parameters: {
            type: "object",
            properties: {
              leadId: { type: "string" },
              status: {
                type: "string",
                enum: ["hot", "warm", "cold", "not_interested"]
              },
              budget: { type: "string" },
              timeline: { type: "string" },
              notes: { type: "string" }
            }
          }
        }
      ]
    },
    
    voice: {
      provider: "elevenlabs",
      voiceId: "21m00Tcm4TlvDq8ikWAM"  // Professional female voice
    },
    
    endCallFunctionEnabled: true,
    endCallPhrases: ["goodbye", "thank you bye", "talk later"],
    
    serverUrl: `${appUrl}/api/vapi-webhook`,
    serverUrlSecret: serverSecret
  }
}

// RAG-enabled assistant configuration
// This assistant can both qualify leads and search the live property database.
//
// Example flow:
// - Lead: "I'm looking for a 3 bedroom house under 500k in Miami."
// - Assistant: Asks 1–2 clarification questions if needed, then calls `search_properties`.
// - Assistant: "I found 3 great options. Option 1 is a 3-bed, 2-bath home for $475,000...
//               Which option would you like to hear more about?"
// - Lead: "Tell me more about option 1."
// - Assistant: Calls `get_property_details` with the selected property_id and summarizes the details,
//              then offers to send a brochure via WhatsApp or email using `send_property_brochure`.
export function ragEnabledAssistant(agentName: string) {
  const getEnvVar = (key: string): string | undefined => {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
      return (import.meta as any).env[key]
    }
    if (typeof process !== 'undefined' && process.env) {
      return process.env[key]
    }
    return undefined
  }

  const appUrl =
    getEnvVar('VITE_APP_URL') || getEnvVar('APP_URL') || 'https://yourdomain.com'

  const SYSTEM_PROMPT = `You are Sarah, a friendly and professional AI assistant calling on behalf of a real estate agent.You have access to a LIVE property database and tools that let you:
- Search for properties that match the caller's needs (search_properties)
- Get full details for a specific property (get_property_details)
- Send a digital brochure or link with more information (send_property_brochure).

YOUR ROLE:
- Qualify the lead by understanding their needs and timeline
- Use the property search tools when they ask about homes, condos, budgets, or areas
- Present the TOP 3 matching properties clearly, then ask which one they want details on
- If they're interested, help them book an appointment with the agent

WHEN TO USE PROPERTY SEARCH:
- After you know at least: budget range OR price ceiling, desired bedrooms, and general location
- When they say things like "I'm looking for...", "Do you have anything in...", or ask about specific price/bedroom combos

HOW TO PRESENT RESULTS (very important):
- Summarize the top 3 matches as:
  1) Price, beds, baths, area, and one key selling point
  2) Same format
  3) Same format
- Then ask: "Which option sounds closest to what you're looking for – option 1, 2, or 3?"

QUALIFICATION QUESTIONS (ask naturally, not as a checklist):
1. BUDGET:
  "Just to make sure we're showing you properties in the right range, what's your budget for this purchase?"
  - Get min and max if possible
  - If unsure: "No worries! Do you have a general range in mind?"

2. TIMELINE:
  "When are you looking to move?"
  - ASAP / Now / Immediately = HOT
  - 1–3 months = WARM
  - 3–6 months = MILD
  - Just looking / No rush = COLD

3. LOCATION:
  "Which areas or neighborhoods are you most interested in?"

4. PROPERTY PREFERENCES:
  "What type of property are you looking for? For example, single-family home, condo, or townhouse? And how many bedrooms do you need?"

5. PRE-APPROVAL:
  "Have you been pre-approved for a mortgage yet?"
  - If yes: "Great! That will help us move quickly."
  - If no: "No problem. ${agentName} can connect you with great lenders."

6. CURRENT SITUATION:
  "Are you working with another agent right now?"
  - If yes: "I understand. If anything changes, feel free to reach out."
  - If no: "Great! ${agentName} would love to help you find the perfect home."

RESULT PRESENTATION:
- After using search_properties, briefly confirm the criteria, then present the top 3 options.
- If they choose an option, call get_property_details for that property_id and summarize:
  price, beds, baths, location, key features, and any standout amenities.
- Offer to send a brochure or link using send_property_brochure and confirm their preferred contact method.

CLOSING:
- If they're interested:
  "Wonderful! ${agentName} would love to show you this property and similar ones. What's your availability this week for a quick call or showing?"
- If not interested:
  "I completely understand. Would you like me to keep your preferences on file for future properties, or would you prefer we don't contact you again?"

IMPORTANT RULES:
- Keep calls under 3–4 minutes
- Be conversational, not robotic
- If they're confused, explain you're an AI assistant helping ${agentName}
- Never make promises about specific deals or guarantees
- Always get permission before ending the call
- Be respectful if they want to end the call early

TONE:
- Friendly but professional
- Upbeat but not pushy
- Patient and understanding
- Speak at a moderate pace with natural pauses`

  return {
    model: {
      provider: 'openai',
      model: 'gpt-4',
      temperature: 0.7,
      systemPrompt: SYSTEM_PROMPT,
      functions: [
        {
          name: 'search_properties',
          description:
            'Search the live property database for homes, condos, or townhouses that match the caller’s criteria.',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description:
                  'Natural language description of what the caller wants, e.g. "3 bedroom house under 500k in Miami".',
              },
              max_price: {
                type: 'number',
                description: 'Maximum price in USD the caller wants to stay under.',
              },
              min_beds: {
                type: 'number',
                description: 'Minimum number of bedrooms required.',
              },
            },
            required: ['query'],
          },
          // Metadata for orchestration layer
          url: `${appUrl}/api/vapi/functions`,
          method: 'POST',
        },
        {
          name: 'get_property_details',
          description:
            'Get full details for a specific property so you can describe it to the caller.',
          parameters: {
            type: 'object',
            properties: {
              property_id: {
                type: 'string',
                description: 'The unique ID of the property chosen by the caller.',
              },
            },
            required: ['property_id'],
          },
          url: `${appUrl}/api/vapi/functions`,
          method: 'POST',
        },
        {
          name: 'send_property_brochure',
          description:
            'Send a digital brochure or link with more information about a property to the caller (placeholder – implemented by backend).',
          parameters: {
            type: 'object',
            properties: {
              property_id: {
                type: 'string',
                description: 'The property to send details about.',
              },
              contact_method: {
                type: 'string',
                description: 'How the caller wants to receive it, e.g. "whatsapp" or "email".',
              },
              contact_value: {
                type: 'string',
                description:
                  'Phone number or email address to send the brochure to, including country code for WhatsApp.',
              },
            },
            required: ['property_id', 'contact_method', 'contact_value'],
          },
          url: `${appUrl}/api/vapi/functions`,
          method: 'POST',
        },
      ],
    },
    voice: {
      provider: '11labs',
      voiceId: '21m00Tcm4TlvDq8ikWAM',
      stability: 0.5,
      similarityBoost: 0.75,
    },
    recordingEnabled: true,
    endCallFunctionEnabled: true,
    maxDurationSeconds: 300,
    silenceTimeoutSeconds: 30,
  }
}

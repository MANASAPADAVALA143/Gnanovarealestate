interface PublicCallParams {
  name: string
  email?: string
  phone: string
  location?: string
  timeline?: string
}

export async function initiatePublicCall({
  name,
  email,
  phone,
  location,
  timeline,
}: PublicCallParams) {
  try {
    // Validate required fields
    if (!phone || !name) {
      throw new Error('Name and phone number are required')
    }

    const vapiApiKey = process.env.VAPI_API_KEY || 'c360e136-6f49-4c3b-b346-4125a57245f8'
    const vapiUrl = 'https://api.vapi.ai/call/phone'

    const vapiPayload = {
      phoneNumber: phone,
      assistant: {
        model: {
          provider: 'openai',
          model: 'gpt-4',
          temperature: 0.7,
          messages: [
            {
              role: 'system',
              content: `You are Sarah, a friendly AI assistant from Gnanova Real Estate calling ${name}. Timeline: ${timeline || 'not specified'}. Ask about: 1) Budget range, 2) Timeline, 3) Location preferences, 4) Property type, 5) Bedrooms needed, 6) Pre-approval status. Keep call under 3 minutes. Be warm and professional.`,
            },
          ],
        },
        voice: {
          provider: '11labs',
          voiceId: '21m00Tcm4TlvDq8ikWAM',
        },
        recordingEnabled: true,
        maxDurationSeconds: 300,
        firstMessage: `Hi ${name}! This is Sarah from Gnanova Real Estate. I'm reaching out about your property inquiry. Do you have a quick moment?`,
      },
    }

    const vapiResponse = await fetch(vapiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${vapiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(vapiPayload),
    })

    const vapiData = await vapiResponse.json()

    if (!vapiResponse.ok) {
      throw new Error(vapiData.message || 'Failed to initiate call')
    }

    return {
      success: true,
      callId: vapiData.id,
      message: 'Call initiated successfully',
      phoneNumber: phone,
    }
  } catch (error: any) {
    console.error('Error initiating VAPI call:', error)
    throw error
  }
}


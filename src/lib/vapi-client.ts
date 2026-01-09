import { VAPI_CONFIG } from './vapi-config'

type InitiateCallParams = {
  phoneNumber: string
  agentName: string
  leadId?: string
  agentId?: string
}

export class VapiClient {
  private baseUrl = VAPI_CONFIG.baseUrl
  private apiKey = VAPI_CONFIG.apiKey

  private get headers() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    }
  }

  async initiateCall({ phoneNumber, agentName, leadId, agentId }: InitiateCallParams) {
    try {
      const response = await fetch(`${this.baseUrl}/call/phone`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          phoneNumber,
          assistant: {
            model: {
              provider: 'openai',
              model: 'gpt-4',
              temperature: 0.7,
              messages: [
                {
                  role: 'system',
                  content: `You are Sarah, a friendly AI assistant calling on behalf of ${agentName}'s real estate team. Qualify the lead by asking about their budget, timeline, location preferences, and property needs. Keep the call under 3 minutes. Be warm and conversational.`,
                },
              ],
            },
            voice: {
              provider: '11labs',
              voiceId: '21m00Tcm4TlvDq8ikWAM',
            },
            recordingEnabled: true,
            maxDurationSeconds: 300,
          },
          metadata: {
            leadId,
            agentId,
            agentName,
          },
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`VAPI API error: ${error}`)
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error('Error initiating call:', error)
      throw error
    }
  }

  async getCall(callId: string) {
    try {
      const response = await fetch(`${this.baseUrl}/call/${callId}`, {
        headers: this.headers,
      })

      if (!response.ok) {
        throw new Error('Failed to fetch call')
      }

      return await response.json()
    } catch (error) {
      console.error('Error getting call:', error)
      throw error
    }
  }
}

export const vapiClient = new VapiClient()








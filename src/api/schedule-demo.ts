interface ScheduleDemoParams {
  name: string
  email: string
  phone: string
  company?: string
  country: string
  preferredTime: string
  message?: string
}

export async function scheduleDemo({
  name,
  email,
  phone,
  company,
  country,
  preferredTime,
  message,
}: ScheduleDemoParams) {
  try {
    // Validate required fields
    if (!name || !email || !phone || !country || !preferredTime) {
      throw new Error('Please fill in all required fields')
    }

    // Get country details
    const countries: { [key: string]: { name: string; prefix: string } } = {
      US: { name: 'United States', prefix: '+1' },
      UK: { name: 'United Kingdom', prefix: '+44' },
      AU: { name: 'Australia', prefix: '+61' },
      AE: { name: 'UAE/Dubai', prefix: '+971' },
      IN: { name: 'India', prefix: '+91' },
    }

    const selectedCountry = countries[country]
    if (!selectedCountry) {
      throw new Error('Invalid country selected')
    }

    const fullPhone = `${selectedCountry.prefix}${phone}`

    // Here you can:
    // 1. Save to database (Supabase, MongoDB, etc.)
    // 2. Send to Google Calendar
    // 3. Send confirmation email
    // 4. Send to CRM (Salesforce, HubSpot, etc.)
    // 5. Send Slack notification to your team

    // Example: Log to console (replace with actual implementation)
    console.log('Demo Scheduled:', {
      name,
      email,
      phone: fullPhone,
      company,
      country: selectedCountry.name,
      preferredTime,
      message,
      scheduledAt: new Date().toISOString(),
    })

    // TODO: Add your integrations here
    // await saveToDatabase({ ... });
    // await sendConfirmationEmail({ ... });
    // await addToCalendar({ ... });

    // Return success response
    return {
      success: true,
      message: 'Demo scheduled successfully!',
      data: {
        name,
        email,
        phone: fullPhone,
        preferredTime,
      },
    }
  } catch (error: any) {
    console.error('Error scheduling demo:', error)
    throw error
  }
}




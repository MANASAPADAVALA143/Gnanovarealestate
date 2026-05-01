import { supabase } from '../lib/supabase'

export async function checkViewingSlots(propertyId: string) {
  try {
    if (!supabase) {
      console.warn('Supabase not configured, returning mock slots')
      // Return mock slots if Supabase is not configured
      return generateMockSlots()
    }

    // Query viewing slots from database
    // Note: You may need to create a 'viewing_slots' table in Supabase
    const { data, error } = await supabase
      .from('viewing_slots')
      .select('*')
      .eq('property_id', propertyId)
      .eq('is_available', true)
      .order('datetime', { ascending: true })
      .limit(5)

    if (error) {
      console.error('Error fetching viewing slots:', error)
      return generateMockSlots()
    }

    if (!data || data.length === 0) {
      return generateMockSlots()
    }

    return data.map((slot: any) => ({
      date: slot.date || slot.datetime?.split('T')[0],
      time: slot.time || slot.datetime?.split('T')[1]?.substring(0, 5),
      agent: slot.agent_name || 'Available Agent',
    }))
  } catch (error) {
    console.error('Error in checkViewingSlots:', error)
    return generateMockSlots()
  }
}

export async function bookViewing(params: {
  leadName: string
  leadPhone: string
  leadEmail?: string
  propertyId: string
  viewingDate: string
  viewingTime: string
  notes?: string
}) {
  try {
    if (!supabase) {
      console.warn('Supabase not configured, returning mock booking')
      return {
        id: `mock-${Date.now()}`,
        date: params.viewingDate,
        time: params.viewingTime,
        message: 'Viewing booked successfully (mock)',
      }
    }

    // Insert viewing booking
    const { data, error } = await supabase
      .from('viewings')
      .insert({
        lead_name: params.leadName,
        lead_phone: params.leadPhone,
        lead_email: params.leadEmail || null,
        property_id: params.propertyId,
        viewing_date: params.viewingDate,
        viewing_time: params.viewingTime,
        notes: params.notes || null,
        status: 'scheduled',
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('Error booking viewing:', error)
      throw error
    }

    // Update lead status to 'hot' if leads table exists
    if (data) {
      await supabase
        .from('leads')
        .update({
          status: 'hot',
          last_contact: new Date().toISOString(),
        })
        .eq('phone', params.leadPhone)
        .catch((err) => {
          console.warn('Could not update lead status:', err)
          // Non-critical error, continue
        })
    }

    return {
      id: data.id,
      date: params.viewingDate,
      time: params.viewingTime,
      message: `Viewing booked for ${params.viewingDate} at ${params.viewingTime}`,
    }
  } catch (error) {
    console.error('Error in bookViewing:', error)
    throw error
  }
}

export async function updateLeadStatus(params: {
  leadId?: string
  leadPhone?: string
  status: 'hot' | 'warm' | 'cold' | 'not_interested'
  budget?: string
  timeline?: string
  notes?: string
}) {
  try {
    if (!supabase) {
      console.warn('Supabase not configured, skipping lead update')
      return { success: true }
    }

    const updateData: any = {
      status: params.status,
      updated_at: new Date().toISOString(),
    }

    if (params.budget) updateData.budget = params.budget
    if (params.timeline) updateData.timeline = params.timeline
    if (params.notes) updateData.notes = params.notes

    let query = supabase.from('leads').update(updateData)

    if (params.leadId) {
      query = query.eq('id', params.leadId)
    } else if (params.leadPhone) {
      query = query.eq('phone', params.leadPhone)
    } else {
      throw new Error('Either leadId or leadPhone must be provided')
    }

    const { error } = await query

    if (error) {
      console.error('Error updating lead status:', error)
      throw error
    }

    return { success: true }
  } catch (error) {
    console.error('Error in updateLeadStatus:', error)
    throw error
  }
}

function generateMockSlots() {
  const today = new Date()
  const slots = []
  
  for (let i = 1; i <= 5; i++) {
    const date = new Date(today)
    date.setDate(today.getDate() + i)
    
    slots.push({
      date: date.toISOString().split('T')[0],
      time: '10:00',
      agent: 'Available Agent',
    })
    slots.push({
      date: date.toISOString().split('T')[0],
      time: '14:00',
      agent: 'Available Agent',
    })
  }
  
  return slots.slice(0, 5)
}

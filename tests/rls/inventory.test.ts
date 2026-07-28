import { describe, expect, it } from 'vitest'
import {
  inventoryGaps,
  NON_TABLE_TENANT_CONCEPTS,
  RLS_INVENTORY,
  tablesExpectingIsolation,
} from './inventory'

describe('RLS inventory (static)', () => {
  it('catalogues the core tenant-scoped surfaces from the Phase 2 brief', () => {
    const names = new Set(RLS_INVENTORY.map((e) => e.table))
    for (const required of [
      'leads',
      'deals',
      'calls',
      'properties',
      'bookings',
      'viewings',
      'outbound_campaigns',
      'campaign_leads',
      'whatsapp_threads',
      'whatsapp_thread_messages',
      'open_house_events',
      'open_house_attendees',
      'agents',
      'consent_log',
      'speed_to_lead_log',
    ]) {
      expect(names.has(required), `missing inventory entry: ${required}`).toBe(true)
    }
  })

  it('documents that commissions and pipeline_stage are not separate tenant tables', () => {
    expect(NON_TABLE_TENANT_CONCEPTS.map((c) => c.name)).toEqual(
      expect.arrayContaining(['pipeline_stage', 'commissions'])
    )
  })

  it('flags critical gaps only when still present (027 closes referrals/nudges/portal)', () => {
    const critical = inventoryGaps('critical').map((e) => e.table)
    expect(critical).not.toContain('lead_referrals')
    expect(critical).not.toContain('lead_nudges')
    expect(critical).not.toContain('portal_events')
    expect(critical).not.toContain('leads')
  })

  it('documents option A shared claim pool on leads', () => {
    const leads = RLS_INVENTORY.find((e) => e.table === 'leads')
    expect(leads?.policies.toLowerCase()).toContain('null')
    expect(leads?.notes.toLowerCase()).toMatch(/shared|claim pool|null/)
  })

  it('marks enabled tables that should isolate assigned rows', () => {
    const expected = tablesExpectingIsolation().map((e) => e.table)
    expect(expected).toEqual(
      expect.arrayContaining([
        'leads',
        'calls',
        'deals',
        'viewings',
        'open_house_events',
        'agents',
      ])
    )
  })

  it('does not claim org_id multi-tenancy (product uses agent_id = auth.uid())', () => {
    for (const entry of RLS_INVENTORY) {
      expect(entry.tenantKey.toLowerCase()).not.toContain('org_id')
    }
  })
})

/**
 * RLS inventory for Gnanova (Phase 2).
 *
 * Tenant model today: agent-scoped (`agents.id = auth.uid()`), NOT org_id.
 * "Org A / Org B" in the test plan maps to Agent A / Agent B.
 * Managers (`agents.is_manager`) bypass via `public.is_deal_manager()`.
 * `service_role` (webhook-server / Next APIs) bypasses RLS entirely.
 */

export type RlsStatus = 'enabled' | 'missing' | 'n/a'
export type GapSeverity = 'none' | 'info' | 'warn' | 'critical'

export type TableInventoryEntry = {
  table: string
  tenantKey: string
  rls: RlsStatus
  policies: string
  /** Whether Agent A should be blocked from Agent B's assigned rows */
  isolationExpected: boolean
  gap: GapSeverity
  notes: string
  sourceMigrations: string[]
}

export const RLS_INVENTORY: TableInventoryEntry[] = [
  {
    table: 'leads',
    tenantKey: 'agent_id',
    rls: 'enabled',
    policies: 'SELECT/INSERT/UPDATE: own | NULL | manager; DELETE: manager only',
    isolationExpected: true,
    gap: 'info',
    notes:
      'LIVE FIXED 2026-07-23 (026_enable_leads_rls.sql): assigned-row SELECT/UPDATE isolate. Option A shared claim pool kept — agent_id IS NULL visible to all agents for SLA claim/escalation. Revisit if unassigned leads linger without auto-assign.',
    sourceMigrations: ['024_rls_policies.sql', '026_enable_leads_rls.sql'],
  },
  {
    table: 'calls',
    tenantKey: 'agent_id',
    rls: 'enabled',
    policies: 'SELECT/INSERT: own | NULL | manager; UPDATE/DELETE: manager only',
    isolationExpected: true,
    gap: 'warn',
    notes: 'Same NULL-agent shared-pool leak on SELECT/INSERT as leads.',
    sourceMigrations: ['024_rls_policies.sql'],
  },
  {
    table: 'properties',
    tenantKey: 'agent_id',
    rls: 'enabled',
    policies: 'SELECT: all authenticated; INSERT/UPDATE/DELETE: own | manager',
    isolationExpected: false,
    gap: 'info',
    notes: 'Intentional brokerage-wide property catalog on SELECT; mutations are scoped.',
    sourceMigrations: ['024_rls_policies.sql'],
  },
  {
    table: 'deals',
    tenantKey: 'agent_id',
    rls: 'enabled',
    policies: 'CRUD: own | NULL | manager (DELETE excludes NULL)',
    isolationExpected: true,
    gap: 'warn',
    notes: 'Commission fields live on deals (no separate commissions table). NULL agent_id leak on SELECT/UPDATE.',
    sourceMigrations: ['019_deals_module.sql'],
  },
  {
    table: 'deal_activities',
    tenantKey: 'via deals.agent_id',
    rls: 'enabled',
    policies: 'SELECT/INSERT via parent deal ownership (incl. NULL | manager)',
    isolationExpected: true,
    gap: 'warn',
    notes: 'Inherits NULL-agent openness from parent deal.',
    sourceMigrations: ['019_deals_module.sql'],
  },
  {
    table: 'lead_tasks',
    tenantKey: 'agent_id',
    rls: 'enabled',
    policies: '024: SELECT/INSERT own|NULL|manager; DELETE own|manager. 018 also had UPDATE.',
    isolationExpected: true,
    gap: 'warn',
    notes: '018 originally had SELECT USING (true); 024 tightens SELECT. NULL still shared.',
    sourceMigrations: ['018_crm_layer.sql', '024_rls_policies.sql'],
  },
  {
    table: 'lead_activities',
    tenantKey: 'via leads.agent_id',
    rls: 'enabled',
    policies: 'SELECT/INSERT via parent lead (own | NULL)',
    isolationExpected: true,
    gap: 'warn',
    notes: '018 policies do not include is_deal_manager(); NULL lead agent still shared.',
    sourceMigrations: ['018_crm_layer.sql'],
  },
  {
    table: 'lead_consent',
    tenantKey: 'via leads.agent_id',
    rls: 'enabled',
    policies: 'SELECT via parent lead (own | NULL)',
    isolationExpected: true,
    gap: 'warn',
    notes: 'No INSERT/UPDATE/DELETE policies for authenticated — inserts likely service_role only.',
    sourceMigrations: ['018_crm_layer.sql'],
  },
  {
    table: 'lead_referrals',
    tenantKey: 'via leads.agent_id',
    rls: 'enabled',
    policies: '027: CRUD via parent lead (own | NULL | manager); delete own|manager',
    isolationExpected: true,
    gap: 'none',
    notes: 'Approved A + 027. Apply 027 in SQL editor if not yet live.',
    sourceMigrations: ['017_lead_enhancements.sql', '027_rls_referrals_nudges_portal_events.sql'],
  },
  {
    table: 'lead_nudges',
    tenantKey: 'via leads.agent_id',
    rls: 'enabled',
    policies: '027: SELECT/INSERT via parent lead; DELETE manager-only',
    isolationExpected: true,
    gap: 'none',
    notes: 'Scheduler writes via service_role. Apply 027 if not yet live.',
    sourceMigrations: ['017_lead_enhancements.sql', '027_rls_referrals_nudges_portal_events.sql'],
  },
  {
    table: 'bookings',
    tenantKey: 'agent_id (or via property)',
    rls: 'enabled',
    policies: 'SELECT own|manager|unowned-via-property; INSERT/UPDATE/DELETE from 007',
    isolationExpected: true,
    gap: 'none',
    notes: '024 only redefines SELECT; 007 insert/update/delete policies remain.',
    sourceMigrations: ['007_appointments_bookings.sql', '024_rls_policies.sql'],
  },
  {
    table: 'viewings',
    tenantKey: 'agent_id',
    rls: 'enabled',
    policies: 'CRUD: own | manager (no NULL leak)',
    isolationExpected: true,
    gap: 'none',
    notes: 'Stricter than leads/deals — no agent_id IS NULL clause.',
    sourceMigrations: ['022_viewing_management.sql'],
  },
  {
    table: 'outbound_campaigns',
    tenantKey: 'agent_id',
    rls: 'enabled',
    policies: 'SELECT own|NULL|manager; INSERT/UPDATE/DELETE manager only',
    isolationExpected: true,
    gap: 'warn',
    notes: 'NULL agent_id campaigns visible to all agents. Mutations manager-gated.',
    sourceMigrations: ['024_rls_policies.sql', '024b_add_campaign_agent_id.sql'],
  },
  {
    table: 'campaign_leads',
    tenantKey: 'via outbound_campaigns.agent_id',
    rls: 'enabled',
    policies: 'SELECT via campaign; INSERT/UPDATE manager only',
    isolationExpected: true,
    gap: 'warn',
    notes: 'Inherits NULL-campaign openness.',
    sourceMigrations: ['024_rls_policies.sql'],
  },
  {
    table: 'whatsapp_threads',
    tenantKey: 'assigned_agent_id',
    rls: 'enabled',
    policies: 'CRUD: assigned | NULL | manager',
    isolationExpected: true,
    gap: 'warn',
    notes: 'Unassigned threads (NULL) visible/editable by every agent.',
    sourceMigrations: ['021_whatsapp_inbox.sql'],
  },
  {
    table: 'whatsapp_thread_messages',
    tenantKey: 'via whatsapp_threads',
    rls: 'enabled',
    policies: 'SELECT/INSERT via parent thread',
    isolationExpected: true,
    gap: 'warn',
    notes: 'Inherits NULL assigned_agent_id openness.',
    sourceMigrations: ['021_whatsapp_inbox.sql'],
  },
  {
    table: 'whatsapp_internal_notes',
    tenantKey: 'via whatsapp_threads + agent_id',
    rls: 'enabled',
    policies: 'SELECT via thread; INSERT requires agent_id = auth.uid() + thread access',
    isolationExpected: true,
    gap: 'warn',
    notes: 'Same NULL-thread leak on SELECT.',
    sourceMigrations: ['021_whatsapp_inbox.sql'],
  },
  {
    table: 'whatsapp_messages',
    tenantKey: 'legacy / manager',
    rls: 'enabled',
    policies: 'SELECT: manager only (024)',
    isolationExpected: true,
    gap: 'info',
    notes: 'Legacy CRM table; non-managers cannot read. Prefer whatsapp_threads*.',
    sourceMigrations: ['018_crm_layer.sql', '024_rls_policies.sql'],
  },
  {
    table: 'open_house_events',
    tenantKey: 'agent_id',
    rls: 'enabled',
    policies: 'CRUD: own only (no manager bypass in 016)',
    isolationExpected: true,
    gap: 'none',
    notes: 'Strict self-only; managers do not get brokerage-wide access here.',
    sourceMigrations: ['016_open_house_events.sql'],
  },
  {
    table: 'open_house_attendees',
    tenantKey: 'via open_house_events.agent_id',
    rls: 'enabled',
    policies: 'SELECT/UPDATE via event owner; INSERT: authenticated owner OR public WITH CHECK (true)',
    isolationExpected: true,
    gap: 'info',
    notes: 'Public INSERT is intentional for guest check-in (tablet/QR). SELECT remains owner-scoped.',
    sourceMigrations: ['016_open_house_events.sql', '024_rls_policies.sql'],
  },
  {
    table: 'agents',
    tenantKey: 'id = auth.uid()',
    rls: 'enabled',
    policies: 'SELECT self|manager; INSERT self; UPDATE self|manager; DELETE manager',
    isolationExpected: true,
    gap: 'none',
    notes: '025 enables RLS + agents_directory view (id, full_name, is_available) for reassignment UI.',
    sourceMigrations: ['005_fix_agents_rls_signup.sql', '024_rls_policies.sql', '025_rls_gaps_patch.sql'],
  },
  {
    table: 'agents_directory',
    tenantKey: 'n/a (safe view)',
    rls: 'n/a',
    policies: 'VIEW of id, full_name, is_available; GRANT SELECT to authenticated',
    isolationExpected: false,
    gap: 'info',
    notes: 'Directory is intentionally shared (non-sensitive). Confirm view uses security_invoker or is safe under agents RLS.',
    sourceMigrations: ['025_rls_gaps_patch.sql'],
  },
  {
    table: 'integration_settings',
    tenantKey: 'manager-only',
    rls: 'enabled',
    policies: 'CRUD: is_deal_manager() only',
    isolationExpected: true,
    gap: 'none',
    notes: '024 replaced per-user policies with manager-only.',
    sourceMigrations: ['003_add_integrations_and_campaigns.sql', '024_rls_policies.sql'],
  },
  {
    table: 'consent_log',
    tenantKey: 'manager-only read',
    rls: 'enabled',
    policies: 'SELECT manager; INSERT WITH CHECK (true)',
    isolationExpected: false,
    gap: 'info',
    notes: 'Open INSERT is intentional for public lead/demo forms. Reads are manager-gated.',
    sourceMigrations: ['023_consent_log.sql', '024_rls_policies.sql'],
  },
  {
    table: 'speed_to_lead_log',
    tenantKey: 'service_role only',
    rls: 'enabled',
    policies: 'No anon/authenticated policies → deny-all except service_role',
    isolationExpected: true,
    gap: 'none',
    notes: 'Correct for portal/speed-to-lead backend paths (025 patch).',
    sourceMigrations: ['014_speed_to_lead_log.sql', '025_rls_gaps_patch.sql'],
  },
  {
    table: 'portal_events',
    tenantKey: 'via leads.agent_id',
    rls: 'enabled',
    policies: '027: SELECT via parent lead | manager; DELETE manager; no auth INSERT',
    isolationExpected: true,
    gap: 'none',
    notes: 'Webhook inserts stay service_role-only. Apply 027 if not yet live.',
    sourceMigrations: ['008_portal_intake.sql', '027_rls_referrals_nudges_portal_events.sql'],
  },
  {
    table: 'agent_round_robin',
    tenantKey: 'singleton config',
    rls: 'missing',
    policies: 'none',
    isolationExpected: false,
    gap: 'warn',
    notes: 'No RLS on matching cursor table. Low sensitivity but writable by any authenticated user.',
    sourceMigrations: ['009_agent_matching.sql'],
  },
  {
    table: 'ai_action_audit',
    tenantKey: 'agent_id',
    rls: 'enabled',
    policies: 'SELECT/INSERT own',
    isolationExpected: true,
    gap: 'none',
    notes: 'Scoped to auth.uid() in 007.',
    sourceMigrations: ['007_appointments_bookings.sql'],
  },
  {
    table: 'data_deletion_log',
    tenantKey: 'manager-only',
    rls: 'enabled',
    policies: 'SELECT: is_deal_manager()',
    isolationExpected: true,
    gap: 'none',
    notes: 'PDPL deletion audit; writes via SECURITY DEFINER / service_role.',
    sourceMigrations: ['025_data_deletion.sql'],
  },
  {
    table: 'agent_settings',
    tenantKey: 'agent_id',
    rls: 'enabled',
    policies: 'SELECT own|manager; INSERT/UPDATE own (024, if table exists)',
    isolationExpected: true,
    gap: 'info',
    notes: 'Policy is conditional on table existence — confirm table is present in target DB.',
    sourceMigrations: ['024_rls_policies.sql'],
  },
]

/** Pipeline stages are an enum column on leads, not a tenant table. */
export const NON_TABLE_TENANT_CONCEPTS = [
  {
    name: 'pipeline_stage',
    notes: 'Enum on public.leads (018) — isolation follows leads RLS.',
  },
  {
    name: 'commissions',
    notes: 'No commissions table — fields on public.deals (agent_commission, brokerage_commission, etc.).',
  },
] as const

export function inventoryGaps(severity?: GapSeverity) {
  return RLS_INVENTORY.filter((e) =>
    severity ? e.gap === severity : e.gap !== 'none'
  )
}

export function tablesExpectingIsolation() {
  return RLS_INVENTORY.filter((e) => e.isolationExpected && e.rls === 'enabled')
}

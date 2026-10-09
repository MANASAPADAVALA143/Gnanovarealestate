import type { PipelineStage } from './pipeline'

export type WorkspaceSlug = 'venkateswara-suites' | 'viseshta-avenues'

export type LeadFieldKey = 'name' | 'phone' | 'email' | 'location' | 'source'

/** A lead form field: either a core `leads` column or a key inside `leads.custom_fields`. */
export type LeadFieldDef = {
  label: string
  type: 'text' | 'tel' | 'email' | 'number' | 'textarea' | 'source'
  required?: boolean
} & ({ column: LeadFieldKey; customKey?: never } | { customKey: string; column?: never })

export type WorkspaceProject = {
  name: string
  type: string
  location: string
  pricePerUnit: number
  monthlyRental: number
  totalUnits: number
  yearlyAppreciationPct: number
  security: string
}

export type WorkspaceConfig = {
  slug: WorkspaceSlug
  name: string
  shortName: string
  currency: 'INR' | 'AED'
  pipelineName: string
  pipelineStages: readonly PipelineStage[]
  /** Fixed list of lead sources; null means free-text source. */
  sourceTags: readonly string[] | null
  leadFields: readonly LeadFieldDef[]
  project: WorkspaceProject | null
  automations: {
    /** Generic 3-question WhatsApp qualification bot (lib/crm-hooks.ts). */
    whatsappQualificationBot: boolean
    bolnaCall: {
      agentName: string
      languages: readonly string[]
      /** Env var holding the Bolna agent id for this workspace. */
      agentIdEnv: string
    } | null
    whatsappWelcome: {
      message: string
      /** Env var naming a Meta-approved template to use instead of free text. */
      templateEnv: string
      /** Env var holding a public brochure PDF URL, sent as a WhatsApp document. */
      brochureUrlEnv: string
      /** Reply sent when the lead answers with the keyword. */
      keywordReplies: Readonly<Record<string, string>>
    } | null
  }
}

export const DEFAULT_WORKSPACE_SLUG: WorkspaceSlug = 'venkateswara-suites'

const VISESHTA_INFO_REPLY = `Viseshta Avenues — Commercial Co-working, Gachibowli
📍 7G Vyshnavi Cynosure, Gachibowli, Hyderabad - 500032

💰 Investment: ₹30,00,000 per unit
💵 Monthly rental income: ₹25,000
📈 Yearly appreciation: 5%
🏦 Security: 100% Bank Guaranteed
🏢 Units: 69 available

Our team will call you shortly to answer your questions and schedule a site visit.`

export const WORKSPACES: Record<WorkspaceSlug, WorkspaceConfig> = {
  'venkateswara-suites': {
    slug: 'venkateswara-suites',
    name: 'Venkateswara Suites',
    shortName: 'VSR',
    currency: 'AED',
    pipelineName: 'Pipeline',
    pipelineStages: [
      'new',
      'contacted',
      'qualified',
      'viewing_scheduled',
      'viewing_done',
      'negotiation',
      'booked',
      'closed',
      'lost',
    ],
    sourceTags: null,
    leadFields: [
      { label: 'Name', type: 'text', column: 'name', required: true },
      { label: 'Phone', type: 'tel', column: 'phone', required: true },
      { label: 'Email', type: 'email', column: 'email' },
      { label: 'Location', type: 'text', column: 'location' },
      { label: 'Source', type: 'source', column: 'source' },
    ],
    project: null,
    automations: {
      whatsappQualificationBot: true,
      bolnaCall: null,
      whatsappWelcome: null,
    },
  },
  'viseshta-avenues': {
    slug: 'viseshta-avenues',
    name: 'Viseshta Avenues',
    shortName: 'VA',
    currency: 'INR',
    pipelineName: 'Viseshta Avenues Leads',
    pipelineStages: [
      'new',
      'brochure_sent',
      'qualified',
      'meeting_scheduled',
      'site_visit',
      'registered',
      'closed',
    ],
    sourceTags: [
      'Instagram',
      'YouTube',
      'WhatsApp Broadcast',
      'LinkedIn',
      'Channel Partner Referral',
      'Cold Database',
    ],
    leadFields: [
      { label: 'Investor Name', type: 'text', column: 'name', required: true },
      { label: 'Phone Number', type: 'tel', column: 'phone', required: true },
      { label: 'Email', type: 'email', column: 'email' },
      { label: 'Investment Budget', type: 'text', customKey: 'investment_budget' },
      { label: 'Occupation', type: 'text', customKey: 'occupation' },
      { label: 'City', type: 'text', column: 'location' },
      { label: 'Source', type: 'source', column: 'source' },
      { label: 'Units Interested', type: 'number', customKey: 'units_interested' },
      { label: 'Campaign', type: 'text', customKey: 'campaign' },
      { label: 'Notes', type: 'textarea', customKey: 'notes' },
    ],
    project: {
      name: 'Viseshta Avenues',
      type: 'Commercial Co-working',
      location: '7G Vyshnavi Cynosure, Gachibowli, Hyderabad - 500032',
      pricePerUnit: 3_000_000,
      monthlyRental: 25_000,
      totalUnits: 69,
      yearlyAppreciationPct: 5,
      security: '100% Bank Guaranteed',
    },
    automations: {
      whatsappQualificationBot: false,
      bolnaCall: {
        agentName: 'Viseshta Telugu Agent',
        languages: ['Telugu', 'English'],
        agentIdEnv: 'BOLNA_VISESHTA_AGENT_ID',
      },
      whatsappWelcome: {
        message:
          'Hi, thank you for your interest in Viseshta Avenues. We have sent you the brochure. Investment: ₹30 Lakhs. Monthly Income: ₹25,000. 100% Bank Guaranteed. Reply INFO for full details.',
        templateEnv: 'WHATSAPP_VISESHTA_WELCOME_TEMPLATE',
        brochureUrlEnv: 'VISESHTA_BROCHURE_URL',
        keywordReplies: { INFO: VISESHTA_INFO_REPLY },
      },
    },
  },
}

export const WORKSPACE_LIST: readonly WorkspaceConfig[] = Object.values(WORKSPACES)

export function isWorkspaceSlug(value: unknown): value is WorkspaceSlug {
  return typeof value === 'string' && value in WORKSPACES
}

export function getWorkspaceConfig(slug: string | null | undefined): WorkspaceConfig {
  return isWorkspaceSlug(slug) ? WORKSPACES[slug] : WORKSPACES[DEFAULT_WORKSPACE_SLUG]
}

export function formatMoney(amount: number | null | undefined, currency: WorkspaceConfig['currency']): string {
  if (amount == null || Number.isNaN(Number(amount))) return '—'
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-AE', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(amount))
}

export const WORKSPACE_HEADER = 'x-workspace'

/** UAE property display helpers (district stage, freehold, AED/sqm). */

export type DistrictStage = 1 | 2 | 3 | 4

export const DISTRICT_STAGE_OPTIONS: Array<{
  value: DistrictStage
  label: string
  shortLabel: string
  badgeClass: string
}> = [
  {
    value: 1,
    label: '1 — Early Speculation (highest upside, highest risk)',
    shortLabel: '1 · Early Speculation',
    badgeClass: 'bg-orange-100 text-orange-800 border-orange-200',
  },
  {
    value: 2,
    label: '2 — Infrastructure Arrival (best risk-adjusted entry)',
    shortLabel: '2 · Infrastructure Arrival',
    badgeClass: 'bg-green-100 text-green-800 border-green-200',
  },
  {
    value: 3,
    label: '3 — Community Maturity (stable yields)',
    shortLabel: '3 · Community Maturity',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  {
    value: 4,
    label: '4 — Saturation / Repositioning (building-level due diligence)',
    shortLabel: '4 · Saturation',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
  },
]

export function getDistrictStageMeta(stage: number | null | undefined) {
  if (stage == null) return null
  return DISTRICT_STAGE_OPTIONS.find((o) => o.value === stage) ?? null
}

export function formatPricePerSqm(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(Number(value)) || Number(value) <= 0) return null
  return `AED ${Math.round(Number(value)).toLocaleString()} / sqm`
}

export function computePricePerSqm(
  price: number | null | undefined,
  sqm: number | null | undefined
): number | null {
  if (price == null || sqm == null || !(Number(sqm) > 0) || !(Number(price) > 0)) return null
  return Number(price) / Number(sqm)
}

/** Display-only: "dubai" → "Dubai" */
export function capitalizeWords(str: string | null | undefined): string {
  if (!str || !String(str).trim()) return ''
  return String(str)
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

export type CompletionStatus = 'off_plan' | 'ready' | 'under_construction'

export const COMPLETION_STATUS_OPTIONS: Array<{
  value: CompletionStatus
  label: string
  badgeClass: string
}> = [
  {
    value: 'off_plan',
    label: 'Off-Plan',
    badgeClass: 'bg-orange-100 text-orange-800 border-orange-200',
  },
  {
    value: 'ready',
    label: 'Ready to Move',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  {
    value: 'under_construction',
    label: 'Under Construction',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
  },
]

export function getCompletionStatusMeta(status: string | null | undefined) {
  if (!status) return null
  return COMPLETION_STATUS_OPTIONS.find((o) => o.value === status) ?? null
}

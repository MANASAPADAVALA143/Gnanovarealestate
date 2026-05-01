import Papa from 'papaparse'
import * as XLSX from 'xlsx'

import {
  EMAIL_ALIASES,
  LOCATION_ALIASES,
  NAME_ALIASES,
  PHONE_ALIASES,
  guessColumn,
} from './import-column-guess'

export { NAME_ALIASES, PHONE_ALIASES, LOCATION_ALIASES, EMAIL_ALIASES, guessColumn }

/** Digits only for dedupe / unique key; keep last 10–15 digits for local numbers */
export function normalizePhone(raw: string): string {
  if (!raw || typeof raw !== 'string') return ''
  const digits = raw.replace(/\D/g, '')
  if (digits.length >= 11 && digits.startsWith('1')) {
    return digits.slice(-10)
  }
  if (digits.length > 10) {
    return digits.slice(-10)
  }
  return digits
}

export type ParsedTable = {
  headers: string[]
  rows: Record<string, unknown>[]
}

export function parseSpreadsheet(
  buffer: Buffer,
  filename: string
): ParsedTable {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.csv')) {
    const text = buffer.toString('utf8')
    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) => h.replace(/\ufeff/g, '').trim(),
    })
    if (parsed.errors?.length) {
      const msg = parsed.errors.map((e) => e.message).join('; ')
      throw new Error(`CSV parse error: ${msg}`)
    }
    const rows = (parsed.data || []).filter(
      (r) => r && Object.values(r).some((v) => String(v || '').trim() !== '')
    ) as Record<string, unknown>[]
    const headers = parsed.meta.fields?.filter(Boolean) as string[]
    return { headers: headers || [], rows }
  }

  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
    const sheetName = wb.SheetNames[0]
    if (!sheetName) throw new Error('Excel workbook has no sheets')
    const sheet = wb.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: '',
      raw: false,
    })
    const headers =
      rows.length > 0
        ? Object.keys(rows[0] as object).map((h) => String(h).trim())
        : []
    return { headers, rows }
  }

  throw new Error('Unsupported file type. Use .csv or .xlsx')
}

export function pickCell(row: Record<string, unknown>, header: string | null): string {
  if (!header) return ''
  const v = row[header]
  if (v == null) return ''
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (v instanceof Date) return v.toISOString()
  return String(v).trim()
}

import { NextRequest, NextResponse } from 'next/server'
import { Buffer } from 'node:buffer'
import { getSupabaseServiceClient } from '../../../../lib/supabase-service'
import {
  initImportJob,
  patchImportJob,
} from '../../../../lib/leads-import-status'
import {
  normalizePhone,
  parseSpreadsheet,
  pickCell,
  guessColumn,
  NAME_ALIASES,
  PHONE_ALIASES,
  LOCATION_ALIASES,
  EMAIL_ALIASES,
} from '../../../../lib/bulk-import-helpers'

export const runtime = 'nodejs'
export const maxDuration = 300

const BATCH = 500

type LeadUpsert = {
  name: string
  phone: string
  email: string | null
  location: string | null
  status: string
  source: string
  created_at: string
  updated_at: string
}

function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id
  )
}

function buildRows(
  rows: Record<string, unknown>[],
  headers: string[],
  nameCol: string | null,
  phoneCol: string | null,
  locationCol: string | null,
  emailCol: string | null
): { leads: LeadUpsert[]; fileDuplicates: number; rowErrors: number; errorSamples: string[] } {
  const seen = new Set<string>()
  const leads: LeadUpsert[] = []
  let fileDuplicates = 0
  let rowErrors = 0
  const errorSamples: string[] = []
  const now = new Date().toISOString()

  const nCol = nameCol || guessColumn(headers, NAME_ALIASES)
  const pCol = phoneCol || guessColumn(headers, PHONE_ALIASES)
  const lCol = locationCol || guessColumn(headers, LOCATION_ALIASES)
  const eCol = emailCol || guessColumn(headers, EMAIL_ALIASES)

  if (!pCol) {
    throw new Error('Could not resolve a phone column. Map "phone" explicitly.')
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rawPhone = pickCell(row, pCol)
    const phoneKey = normalizePhone(rawPhone)
    if (!phoneKey || phoneKey.length < 8) {
      rowErrors++
      if (errorSamples.length < 5) {
        errorSamples.push(`Row ${i + 2}: invalid or missing phone (${rawPhone || 'empty'})`)
      }
      continue
    }
    if (seen.has(phoneKey)) {
      fileDuplicates++
      continue
    }
    seen.add(phoneKey)

    const nameRaw = nCol ? pickCell(row, nCol) : ''
    const name = nameRaw.trim() || 'Unknown'
    const location = lCol ? pickCell(row, lCol) || null : null
    const emailRaw = eCol ? pickCell(row, eCol) : ''
    const email = emailRaw.trim() ? emailRaw.trim() : null

    leads.push({
      name,
      phone: phoneKey,
      email,
      location,
      status: 'new',
      source: 'bulk_import',
      created_at: now,
      updated_at: now,
    })
  }

  return { leads, fileDuplicates, rowErrors, errorSamples }
}

async function upsertBatches(jobId: string, leads: LeadUpsert[], baseErrors: number, baseSamples: string[]) {
  const supabase = getSupabaseServiceClient()
  let imported = 0
  let errors = baseErrors
  const errorSamples = [...baseSamples]

  try {
    for (let i = 0; i < leads.length; i += BATCH) {
      const chunk = leads.slice(i, i + BATCH)
      const { error } = await supabase.from('leads').upsert(chunk, {
        onConflict: 'phone',
      })
      if (error) {
        errors += chunk.length
        if (errorSamples.length < 5) {
          errorSamples.push(error.message)
        }
        patchImportJob(jobId, {
          imported,
          errors,
          errorSamples,
        })
      } else {
        imported += chunk.length
        patchImportJob(jobId, {
          imported,
          errors,
          errorSamples,
        })
      }
    }

    patchImportJob(jobId, {
      status: 'completed',
      imported,
      errors,
      errorSamples,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Import failed'
    patchImportJob(jobId, {
      status: 'failed',
      message: msg,
      errorSamples:
        errorSamples.length < 5 ? [...errorSamples, msg] : errorSamples,
    })
  }
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const jobId = String(form.get('jobId') || '')
    const file = form.get('file')

    if (!jobId || !isUuid(jobId)) {
      return NextResponse.json({ error: 'jobId (UUID) is required' }, { status: 400 })
    }
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 })
    }

    const nameColumn = form.get('nameColumn') ? String(form.get('nameColumn')) : ''
    const phoneColumn = form.get('phoneColumn') ? String(form.get('phoneColumn')) : ''
    const locationColumn = form.get('locationColumn')
      ? String(form.get('locationColumn'))
      : ''
    const emailColumn = form.get('emailColumn') ? String(form.get('emailColumn')) : ''

    const filename =
      (typeof (file as File).name === 'string' && (file as File).name) || 'upload.csv'
    const ab = await file.arrayBuffer()
    const buffer = Buffer.from(ab)

    const { headers, rows } = parseSpreadsheet(buffer, filename)

    const { leads, fileDuplicates, rowErrors, errorSamples } = buildRows(
      rows,
      headers,
      nameColumn || null,
      phoneColumn || null,
      locationColumn || null,
      emailColumn || null
    )

    initImportJob(jobId, leads.length)
    patchImportJob(jobId, {
      duplicates: fileDuplicates,
      errors: rowErrors,
      errorSamples,
    })

    void upsertBatches(jobId, leads, rowErrors, errorSamples)

    return NextResponse.json({
      jobId,
      total: leads.length,
      duplicates: fileDuplicates,
      errors: rowErrors,
      imported: 0,
      message: 'Import started',
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Import failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}

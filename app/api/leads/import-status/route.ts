import { NextRequest, NextResponse } from 'next/server'
import { isAgentAuth, requireAgent } from '../../../../lib/require-agent'
import { getImportJob } from '../../../../lib/leads-import-status'

export const runtime = 'nodejs'

function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id
  )
}

export async function GET(req: NextRequest) {
  const auth = await requireAgent(req)
  if (!isAgentAuth(auth)) return auth

  const jobId = req.nextUrl.searchParams.get('jobId') || ''

  if (!jobId || !isUuid(jobId)) {
    return NextResponse.json(
      { status: 'unknown', imported: 0, total: 0, message: 'jobId query required' },
      { status: 400 }
    )
  }

  const state = getImportJob(jobId)
  if (!state) {
    return NextResponse.json({
      status: 'processing',
      imported: 0,
      total: 0,
      duplicates: 0,
      errors: 0,
      errorSamples: [] as string[],
    })
  }

  return NextResponse.json({
    status: state.status,
    imported: state.imported,
    total: state.total,
    duplicates: state.duplicates,
    errors: state.errors,
    errorSamples: state.errorSamples,
    message: state.message,
  })
}

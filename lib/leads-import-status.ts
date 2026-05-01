/**
 * In-memory import job state for bulk lead uploads.
 * Swap for Redis with the same fields for multi-instance deployments.
 */

export type ImportJobStatus = 'queued' | 'processing' | 'completed' | 'failed'

export type ImportJobState = {
  status: ImportJobStatus
  imported: number
  total: number
  duplicates: number
  errors: number
  errorSamples: string[]
  message?: string
}

const jobs = new Map<string, ImportJobState>()

export function initImportJob(jobId: string, total: number): void {
  jobs.set(jobId, {
    status: 'processing',
    imported: 0,
    total,
    duplicates: 0,
    errors: 0,
    errorSamples: [],
  })
}

export function patchImportJob(
  jobId: string,
  patch: Partial<ImportJobState> & { appendError?: string }
): void {
  const cur = jobs.get(jobId)
  if (!cur) return
  const { appendError, errorSamples, ...rest } = patch
  let samples = errorSamples ?? cur.errorSamples
  if (appendError && samples.length < 5) {
    samples = [...samples, appendError]
  }
  jobs.set(jobId, { ...cur, ...rest, errorSamples: samples })
}

export function getImportJob(jobId: string): ImportJobState | undefined {
  return jobs.get(jobId)
}

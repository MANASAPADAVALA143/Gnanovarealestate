'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import Papa from 'papaparse'
import {
  EMAIL_ALIASES,
  LOCATION_ALIASES,
  NAME_ALIASES,
  PHONE_ALIASES,
  guessColumn,
} from '../../../../../lib/import-column-guess'
import { apiFetch } from '../../../../../lib/api-fetch'

type PreviewState = {
  headers: string[]
  previewRows: Record<string, string>[]
  rowCount: number | null
  file: File
}

type StatusPayload = {
  status: string
  imported: number
  total: number
  duplicates?: number
  errors?: number
  errorSamples?: string[]
  message?: string
}

const ACCEPT = '.csv,.xlsx,.xls'

export default function ImportContactsPage() {
  const [dragActive, setDragActive] = useState(false)
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [nameColumn, setNameColumn] = useState('')
  const [phoneColumn, setPhoneColumn] = useState('')
  const [locationColumn, setLocationColumn] = useState('')
  const [emailColumn, setEmailColumn] = useState('')
  const [importing, setImporting] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [progress, setProgress] = useState<StatusPayload | null>(null)
  const [finalResult, setFinalResult] = useState<StatusPayload | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  useEffect(() => () => stopPoll(), [stopPoll])

  const analyzeFile = async (file: File) => {
    setParseError(null)
    setPreview(null)
    setFinalResult(null)
    setProgress(null)

    const lower = file.name.toLowerCase()
    if (!lower.endsWith('.csv') && !lower.endsWith('.xlsx') && !lower.endsWith('.xls')) {
      setParseError('Please upload a .csv or .xlsx file.')
      return
    }

    try {
      if (lower.endsWith('.csv')) {
        const maxInline = 12 * 1024 * 1024
        const text =
          file.size <= maxInline
            ? await file.text()
            : await file.slice(0, maxInline).text()
        const parsed = Papa.parse<Record<string, string>>(text, {
          header: true,
          skipEmptyLines: 'greedy',
          transformHeader: (h) => h.replace(/\ufeff/g, '').trim(),
        })
        if (parsed.errors.length) {
          setParseError(parsed.errors.map((e) => e.message).join('; '))
          return
        }
        const headers = (parsed.meta.fields || []).filter(Boolean) as string[]
        const data = (parsed.data || []).filter((r) =>
          Object.values(r || {}).some((v) => String(v || '').trim() !== '')
        ) as Record<string, string>[]
        const rowCount = file.size <= maxInline ? data.length : null
        const previewRows = data.slice(0, 3)
        setPreview({ headers, previewRows, rowCount, file })
        setNameColumn(guessColumn(headers, NAME_ALIASES) || '')
        setPhoneColumn(guessColumn(headers, PHONE_ALIASES) || '')
        setLocationColumn(guessColumn(headers, LOCATION_ALIASES) || '')
        setEmailColumn(guessColumn(headers, EMAIL_ALIASES) || '')
        return
      }

      const XLSX = await import('xlsx')
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array', cellDates: true })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const data = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
        defval: '',
        raw: false,
      })
      const headers =
        data.length > 0 ? Object.keys(data[0]).map((h) => h.trim()) : []
      setPreview({
        headers,
        previewRows: data.slice(0, 3) as Record<string, string>[],
        rowCount: data.length,
        file,
      })
      setNameColumn(guessColumn(headers, NAME_ALIASES) || '')
      setPhoneColumn(guessColumn(headers, PHONE_ALIASES) || '')
      setLocationColumn(guessColumn(headers, LOCATION_ALIASES) || '')
      setEmailColumn(guessColumn(headers, EMAIL_ALIASES) || '')
    } catch (e: unknown) {
      setParseError(e instanceof Error ? e.message : 'Failed to read file')
    }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    const f = e.dataTransfer.files?.[0]
    if (f) void analyzeFile(f)
  }

  const pollStatus = (id: string) => {
    stopPoll()
    pollRef.current = setInterval(async () => {
      try {
        const res = await apiFetch(`/api/leads/import-status?jobId=${encodeURIComponent(id)}`)
        const json = (await res.json()) as StatusPayload
        setProgress(json)
        if (json.status === 'completed' || json.status === 'failed') {
          stopPoll()
          setImporting(false)
          setFinalResult(json)
        }
      } catch {
        /* ignore transient poll errors */
      }
    }, 2000)
  }

  const startImport = async () => {
    if (!preview?.file) return
    const id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`
    setJobId(id)
    setImporting(true)
    setFinalResult(null)
    setProgress({
      status: 'processing',
      imported: 0,
      total: preview.rowCount ?? 0,
    })

    const form = new FormData()
    form.set('jobId', id)
    form.set('file', preview.file)
    form.set('nameColumn', nameColumn)
    form.set('phoneColumn', phoneColumn)
    form.set('locationColumn', locationColumn)
    form.set('emailColumn', emailColumn)

    try {
      const res = await apiFetch('/api/leads/bulk-import', {
        method: 'POST',
        body: form,
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || 'Import failed to start')
      }
      setProgress({
        status: 'processing',
        imported: json.imported ?? 0,
        total: json.total ?? 0,
        duplicates: json.duplicates,
        errors: json.errors,
      })
      pollStatus(id)
    } catch (e: unknown) {
      stopPoll()
      setImporting(false)
      setParseError(e instanceof Error ? e.message : 'Import failed')
    }
  }

  const pct =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.imported / progress.total) * 100))
      : 0

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Import Contacts</h1>
          <p className="text-sm text-slate-600">
            Upload a CSV or Excel file (large lists supported). Map columns, then start the
            import.
          </p>
        </div>
        <Link
          href="/dashboard/campaigns"
          className="inline-flex items-center rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
        >
          Back to Campaigns
        </Link>
      </div>

      {parseError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          {parseError}
        </div>
      )}

      <div
        onDragEnter={(e) => {
          e.preventDefault()
          setDragActive(true)
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        className={`rounded-xl border-2 border-dashed px-6 py-12 text-center transition ${
          dragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50'
        }`}
      >
        <p className="text-sm font-semibold text-slate-800 mb-1">
          Drag and drop your file here
        </p>
        <p className="text-xs text-slate-500 mb-4">.csv or .xlsx only</p>
        <label className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition cursor-pointer">
          Browse files
          <input
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void analyzeFile(f)
            }}
          />
        </label>
      </div>

      {preview && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
          <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-600">
            <span className="font-semibold text-slate-900">{preview.file.name}</span>
            <span>
              {preview.rowCount != null
                ? `${preview.rowCount.toLocaleString()} rows`
                : 'Row count will be finalized when import starts (large CSV preview)'}
            </span>
          </div>

          <p className="text-sm font-semibold text-slate-900">Column mapping</p>
          <p className="text-xs text-slate-500">
            First rows of your file (confirm which column is name, phone, and location). Phone is
            required.
          </p>

          <div className="overflow-x-auto rounded-lg border border-slate-100">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600">
                  {preview.headers.map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preview.previewRows.map((row, idx) => (
                  <tr key={idx}>
                    {preview.headers.map((h) => (
                      <td key={h} className="px-3 py-2 text-slate-700 whitespace-nowrap max-w-[200px] truncate">
                        {String(row[h] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-xs font-medium text-slate-700 flex flex-col gap-1">
              Name column
              <select
                value={nameColumn}
                onChange={(e) => setNameColumn(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 bg-white"
              >
                <option value="">— Auto-detect —</option>
                {preview.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-slate-700 flex flex-col gap-1">
              Phone column
              <select
                value={phoneColumn}
                onChange={(e) => setPhoneColumn(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 bg-white"
              >
                <option value="">— Auto-detect —</option>
                {preview.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-slate-700 flex flex-col gap-1">
              Location column
              <select
                value={locationColumn}
                onChange={(e) => setLocationColumn(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 bg-white"
              >
                <option value="">— Optional / auto —</option>
                {preview.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-slate-700 flex flex-col gap-1">
              Email column (optional)
              <select
                value={emailColumn}
                onChange={(e) => setEmailColumn(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 bg-white"
              >
                <option value="">— None —</option>
                {preview.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button
            type="button"
            disabled={importing}
            onClick={() => void startImport()}
            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition disabled:opacity-50"
          >
            {importing ? 'Importing…' : 'Start Import'}
          </button>
        </div>
      )}

      {importing && progress && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-2">
          <p className="text-sm font-semibold text-slate-900">Import progress</p>
          <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-slate-600">
            {progress.imported.toLocaleString()} / {progress.total.toLocaleString()} rows (
            {progress.status})
          </p>
          {jobId && (
            <p className="text-[11px] text-slate-400 break-all">Job: {jobId}</p>
          )}
        </div>
      )}

      {finalResult && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          <p className="text-sm font-semibold text-slate-900">Results</p>
          <ul className="text-sm text-slate-700 space-y-1">
            <li>
              ✅ {finalResult.imported.toLocaleString()} contacts imported
            </li>
            <li>⚠️ {(finalResult.duplicates ?? 0).toLocaleString()} duplicates skipped (same phone in file)</li>
            <li>❌ {(finalResult.errors ?? 0).toLocaleString()} rows failed</li>
          </ul>
          {finalResult.status === 'failed' && finalResult.message && (
            <p className="text-xs text-red-600">{finalResult.message}</p>
          )}
          {(finalResult.errorSamples?.length ?? 0) > 0 && (
            <div className="text-xs text-slate-600">
              <p className="font-semibold text-slate-800 mb-1">First errors</p>
              <ul className="list-disc pl-4 space-y-0.5">
                {finalResult.errorSamples?.slice(0, 5).map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          <Link
            href="/dashboard/campaigns"
            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition"
          >
            Go to Campaigns
          </Link>
        </div>
      )}
    </div>
  )
}

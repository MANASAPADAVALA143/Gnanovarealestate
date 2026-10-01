import React, { useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Upload, Eye, Play, AlertCircle, CheckCircle, Loader2, FileText, X } from 'lucide-react'

type RawRow = Record<string, string>

type MappedLead = {
  name: string
  phone: string
  email: string | null
  suite_preference: string | null
  status: string
  source: string
  raw: RawRow
}

type ImportResult = {
  success: number
  skipped: number
  errors: { row: number; reason: string }[]
}

const STATUS_MAP: Record<string, string> = {
  new: 'new', interested: 'new', enquiry: 'new',
  contacted: 'contacted', 'in progress': 'contacted',
  qualified: 'qualified', hot: 'qualified',
  booked: 'booked', 'site visit': 'booked',
  closed: 'closed_won', won: 'closed_won', sold: 'closed_won',
  lost: 'closed_lost', 'not interested': 'closed_lost',
}

function parseCSV(text: string): RawRow[] {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map((h) => h.replace(/^"|"$/g, '').trim().toLowerCase())
  return lines.slice(1).map((line) => {
    const vals = line.match(/(".*?"|[^,]+|(?<=,)(?=,)|(?<=,)$|^(?=,))/g) || line.split(',')
    const row: RawRow = {}
    headers.forEach((h, i) => {
      row[h] = (vals[i] || '').replace(/^"|"$/g, '').trim()
    })
    return row
  }).filter((r) => Object.values(r).some((v) => v))
}

function mapRow(row: RawRow): MappedLead | null {
  const name =
    row['customer name'] || row['name'] || row['full name'] || row['client name'] || ''
  const phone =
    row['phone'] || row['mobile'] || row['phone number'] || row['contact'] || row['whatsapp'] || ''

  if (!name.trim() || !phone.trim()) return null

  const rawStatus = (row['status'] || row['pipeline stage'] || row['stage'] || 'new').toLowerCase()
  const mappedStatus = STATUS_MAP[rawStatus] || 'new'

  return {
    name: name.trim(),
    phone: phone.trim().replace(/\s/g, ''),
    email: (row['email'] || row['email address'] || '').trim() || null,
    suite_preference: (row['property'] || row['suite'] || row['unit'] || row['preference'] || '').trim() || null,
    status: mappedStatus,
    source: 'csv_import',
    raw: row,
  }
}

export default function DataMigrationPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<RawRow[]>([])
  const [mapped, setMapped] = useState<MappedLead[]>([])
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [progress, setProgress] = useState(0)

  function handleFile(file: File) {
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const parsed = parseCSV(text)
      const mappedRows = parsed.map(mapRow).filter(Boolean) as MappedLead[]
      setRows(parsed)
      setMapped(mappedRows)
      setStep('preview')
    }
    reader.readAsText(file)
  }

  async function runImport() {
    setStep('importing')
    setProgress(0)
    const errors: { row: number; reason: string }[] = []
    let success = 0
    let skipped = 0

    for (let i = 0; i < mapped.length; i++) {
      const lead = mapped[i]
      setProgress(Math.round(((i + 1) / mapped.length) * 100))

      // Duplicate check
      const { data: existing } = await supabase
        .from('leads')
        .select('id')
        .eq('phone', lead.phone)
        .maybeSingle()

      if (existing) {
        skipped++
        continue
      }

      const { error } = await supabase.from('leads').insert({
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        suite_preference: lead.suite_preference,
        status: lead.status,
        source: lead.source,
        consent_given: true,
        consent_timestamp: new Date().toISOString(),
        created_at: new Date().toISOString(),
      })

      if (error) {
        errors.push({ row: i + 1, reason: error.message })
      } else {
        success++
      }
    }

    setResult({ success, skipped, errors })
    setStep('done')
  }

  function reset() {
    setStep('upload')
    setFileName('')
    setRows([])
    setMapped([])
    setResult(null)
    setProgress(0)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Data Migration</h1>
          <p className="text-slate-500 text-sm mt-1">Import leads from Tranquil CRM or any CSV export</p>
        </div>
        {step !== 'upload' && (
          <button onClick={reset} className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 text-sm">
            <X className="w-4 h-4" /> Start Over
          </button>
        )}
      </div>

      {/* Field Mapping Reference */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-blue-800 mb-2">Expected CSV Columns (auto-detected)</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-blue-700">
          {[
            ['Customer Name / Name', 'leads.name'],
            ['Phone / Mobile', 'leads.phone'],
            ['Email', 'leads.email'],
            ['Property / Suite / Unit', 'leads.suite_preference'],
            ['Status / Pipeline Stage', 'leads.status'],
          ].map(([from, to]) => (
            <div key={from} className="bg-white border border-blue-100 rounded-lg px-3 py-2">
              <p className="font-medium">{from}</p>
              <p className="text-blue-400">→ {to}</p>
            </div>
          ))}
        </div>
      </div>

      {/* STEP 1: Upload */}
      {step === 'upload' && (
        <div
          className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center hover:border-blue-400 transition-colors cursor-pointer"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
        >
          <Upload className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-lg font-medium text-slate-700">Drop your CSV file here</p>
          <p className="text-slate-400 text-sm mt-1">or click to browse</p>
          <p className="text-xs text-slate-300 mt-3">Supports exports from Tranquil CRM, Excel, Google Sheets</p>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
        </div>
      )}

      {/* STEP 2: Preview */}
      {step === 'preview' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white border border-slate-100 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-blue-500" />
              <div>
                <p className="font-medium text-slate-900">{fileName}</p>
                <p className="text-sm text-slate-500">{rows.length} rows found · {mapped.length} valid leads · {rows.length - mapped.length} skipped (missing name/phone)</p>
              </div>
            </div>
            <button
              onClick={runImport}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
            >
              <Play className="w-4 h-4" /> Import {mapped.length} Leads
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
              <Eye className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-700">Preview (first 10 rows)</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left px-4 py-2.5 text-slate-500 font-medium">#</th>
                    <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Name</th>
                    <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Phone</th>
                    <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Email</th>
                    <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Suite Pref.</th>
                    <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {mapped.slice(0, 10).map((lead, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 text-slate-400">{i + 1}</td>
                      <td className="px-4 py-2.5 font-medium text-slate-900">{lead.name}</td>
                      <td className="px-4 py-2.5 text-slate-600">{lead.phone}</td>
                      <td className="px-4 py-2.5 text-slate-500">{lead.email || '—'}</td>
                      <td className="px-4 py-2.5 text-slate-500">{lead.suite_preference || '—'}</td>
                      <td className="px-4 py-2.5">
                        <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">{lead.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {mapped.length > 10 && (
                <p className="text-center text-xs text-slate-400 py-3">+ {mapped.length - 10} more rows</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: Importing */}
      {step === 'importing' && (
        <div className="bg-white rounded-xl border border-slate-100 p-12 text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-lg font-medium text-slate-900">Importing leads...</p>
          <p className="text-slate-500 text-sm mt-1">{progress}% complete</p>
          <div className="mt-4 w-full bg-slate-100 rounded-full h-2 max-w-sm mx-auto">
            <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* STEP 4: Done */}
      {step === 'done' && result && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
              <p className="text-3xl font-bold text-green-700">{result.success}</p>
              <p className="text-sm text-green-600 mt-1">Imported</p>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
              <AlertCircle className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
              <p className="text-3xl font-bold text-yellow-700">{result.skipped}</p>
              <p className="text-sm text-yellow-600 mt-1">Duplicates Skipped</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
              <X className="w-8 h-8 text-red-400 mx-auto mb-2" />
              <p className="text-3xl font-bold text-red-600">{result.errors.length}</p>
              <p className="text-sm text-red-500 mt-1">Errors</p>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="bg-white rounded-xl border border-red-100 overflow-hidden">
              <div className="px-4 py-3 bg-red-50 border-b border-red-100">
                <p className="text-sm font-medium text-red-700">Error Log</p>
              </div>
              <div className="divide-y divide-slate-50">
                {result.errors.map((e, i) => (
                  <div key={i} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                    <span className="text-slate-400">Row {e.row}</span>
                    <span className="text-red-600">{e.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={reset} className="px-5 py-2.5 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 text-sm">
              Import Another File
            </button>
            <a href="/dashboard/leads" className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              View Leads →
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

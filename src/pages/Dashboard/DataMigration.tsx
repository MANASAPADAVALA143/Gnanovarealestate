import React, { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  Upload, Eye, Play, AlertCircle, CheckCircle, Loader2,
  FileText, X, Download, History, Undo2, ChevronRight,
  Database, AlertTriangle, SkipForward
} from 'lucide-react'

type RawRow = Record<string, string>
type Step = 1 | 2 | 3 | 4 | 5

type MappedLead = {
  name: string
  phone: string
  email: string | null
  suite_preference: string | null
  pipeline_stage: string
  source: string
  notes: string | null
  row_index: number
  issues: string[]
  skip: boolean
}

type ImportResult = {
  success: number
  duplicates: number
  errors: { row: number; name: string; phone: string; reason: string }[]
  migration_log_id: string
}

type MigrationLog = {
  id: string
  migration_date: string
  total_records: number
  successful: number
  failed: number
  duplicates: number
  file_name: string
  status: string
}

const GNANOVA_FIELDS = [
  { value: 'name', label: 'Lead Name' },
  { value: 'phone', label: 'Phone' },
  { value: 'email', label: 'Email' },
  { value: 'suite_preference', label: 'Suite Preference' },
  { value: 'pipeline_stage', label: 'Pipeline Stage' },
  { value: 'source', label: 'Source' },
  { value: 'notes', label: 'Notes' },
  { value: '__skip__', label: '— Skip this field —' },
]

const AUTO_MAPPING: Record<string, string> = {
  'customer name': 'name', 'name': 'name', 'full name': 'name', 'client name': 'name',
  'mobile': 'phone', 'phone': 'phone', 'mobile number': 'phone', 'contact': 'phone', 'phone number': 'phone',
  'email id': 'email', 'email': 'email', 'email address': 'email',
  'property type': 'suite_preference', 'property': 'suite_preference', 'interest': 'suite_preference',
  'status': 'pipeline_stage', 'lead status': 'pipeline_stage', 'stage': 'pipeline_stage',
  'source': 'source', 'lead source': 'source',
  'assigned to': '__skip__', 'remarks': 'notes', 'comment': 'notes', 'notes': 'notes',
}

const STAGE_MAP: Record<string, string> = {
  'new': 'New Lead', 'new lead': 'New Lead', 'fresh': 'New Lead',
  'contacted': 'Contacted', 'called': 'Contacted',
  'interested': 'Site Visit', 'site visit': 'Site Visit', 'visit scheduled': 'Site Visit',
  'negotiation': 'Negotiation', 'negotiating': 'Negotiation',
  'booked': 'Closed Won', 'closed': 'Closed Won', 'won': 'Closed Won', 'sold': 'Closed Won',
  'lost': 'Closed Lost', 'not interested': 'Closed Lost',
  'on hold': 'On Hold', 'hold': 'On Hold',
}

const SOURCE_MAP: Record<string, string> = {
  'walk in': 'Walk In', 'walkin': 'Walk In', 'walk-in': 'Walk In',
  'reference': 'Referral', 'referral': 'Referral', 'ref': 'Referral',
  'online': 'Website', 'website': 'Website', 'web': 'Website',
  'agent': 'Broker', 'broker': 'Broker',
}

function normalizePhone(raw: string): string {
  let p = raw.replace(/\D/g, '')
  if (p.startsWith('91') && p.length === 12) p = p.slice(2)
  if (p.startsWith('0') && p.length === 11) p = p.slice(1)
  return p
}

function isValidPhone(p: string): boolean { return /^\d{10}$/.test(p) }
function isValidEmail(e: string): boolean { return !e || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) }

async function parseFile(file: File): Promise<{ headers: string[]; rows: RawRow[] }> {
  if (file.name.endsWith('.csv')) {
    const text = await file.text()
    const Papa = (await import('papaparse')).default
    const result = Papa.parse<RawRow>(text, { header: true, skipEmptyLines: true, transformHeader: h => h.trim() })
    return { headers: result.meta.fields || [], rows: result.data }
  } else {
    const XLSX = await import('xlsx')
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf)
    const ws = wb.Sheets[wb.SheetNames[0]]
    const data = XLSX.utils.sheet_to_json<RawRow>(ws, { defval: '' })
    const headers = data.length > 0 ? Object.keys(data[0]) : []
    return { headers, rows: data }
  }
}

export default function DataMigration() {
  const [step, setStep] = useState<Step>(1)
  const [file, setFile] = useState<File | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<RawRow[]>([])
  const [fieldMap, setFieldMap] = useState<Record<string, string>>({})
  const [mappedLeads, setMappedLeads] = useState<MappedLead[]>([])
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [logs, setLogs] = useState<MigrationLog[]>([])
  const [activeTab, setActiveTab] = useState<'migrate' | 'history'>('migrate')
  const [dragging, setDragging] = useState(false)
  const [undoing, setUndoing] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadHistory() }, [])

  async function loadHistory() {
    const { data } = await supabase
      .from('migration_logs')
      .select('*')
      .order('migration_date', { ascending: false })
      .limit(20)
    setLogs((data || []) as MigrationLog[])
  }

  async function handleFile(f: File) {
    if (f.size > 10 * 1024 * 1024) { alert('File too large. Max 10 MB.'); return }
    setFile(f)
    try {
      const { headers: h, rows } = await parseFile(f)
      setHeaders(h)
      setRawRows(rows)
      const map: Record<string, string> = {}
      h.forEach(col => {
        const key = col.toLowerCase().trim()
        map[col] = AUTO_MAPPING[key] || '__skip__'
      })
      setFieldMap(map)
      setStep(2)
    } catch (e) {
      alert('Could not parse file. Make sure it is a valid CSV or Excel file.')
    }
  }

  function buildMappedLeads(): MappedLead[] {
    return rawRows.map((row, idx) => {
      const get = (gField: string) => {
        const col = Object.keys(fieldMap).find(c => fieldMap[c] === gField)
        return col ? String(row[col] || '').trim() : ''
      }

      const rawPhone = normalizePhone(get('phone'))
      const name = get('name')
      const email = get('email')
      const issues: string[] = []
      let skip = false

      if (!name) { issues.push('Missing name'); skip = true }
      if (!isValidPhone(rawPhone)) { issues.push('Invalid phone'); skip = true }
      if (email && !isValidEmail(email)) issues.push('Invalid email (warning)')

      const rawStage = get('pipeline_stage').toLowerCase()
      const pipeline_stage = STAGE_MAP[rawStage] || 'New Lead'

      const rawSource = get('source').toLowerCase()
      const source = SOURCE_MAP[rawSource] || 'Other'

      return {
        name,
        phone: rawPhone,
        email: email || null,
        suite_preference: get('suite_preference') || null,
        pipeline_stage,
        source,
        notes: get('notes') || null,
        row_index: idx + 2,
        issues,
        skip,
      }
    })
  }

  function goToPreview() {
    const leads = buildMappedLeads()
    setMappedLeads(leads)
    setStep(3)
  }

  async function runImport() {
    setImporting(true)
    setProgress(0)
    setStep(4)

    const toImport = mappedLeads.filter(l => !l.skip)
    const errors: ImportResult['errors'] = []
    let success = 0, duplicates = 0

    // Check existing phones in bulk
    const phones = toImport.map(l => l.phone)
    const { data: existing } = await supabase.from('leads').select('phone').in('phone', phones)
    const existingPhones = new Set((existing || []).map(r => r.phone))

    for (let i = 0; i < toImport.length; i++) {
      const lead = toImport[i]
      setProgress(Math.round(((i + 1) / toImport.length) * 100))

      if (existingPhones.has(lead.phone)) {
        duplicates++
        errors.push({ row: lead.row_index, name: lead.name, phone: lead.phone, reason: 'Duplicate phone' })
        continue
      }

      const { error } = await supabase.from('leads').insert({
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        suite_preference: lead.suite_preference,
        pipeline_stage: lead.pipeline_stage,
        source: lead.source,
        notes: lead.notes,
        status: 'active',
      })

      if (error) {
        errors.push({ row: lead.row_index, name: lead.name, phone: lead.phone, reason: error.message })
      } else {
        success++
        existingPhones.add(lead.phone)
      }
    }

    // Save migration log
    const { data: logData } = await supabase.from('migration_logs').insert({
      total_records: rawRows.length,
      successful: success,
      failed: errors.filter(e => e.reason !== 'Duplicate phone').length,
      duplicates,
      file_name: file?.name || 'unknown',
      status: 'Completed',
      error_log: errors,
    }).select('id').single()

    setResult({ success, duplicates, errors, migration_log_id: logData?.id || '' })
    setImporting(false)
    setProgress(100)
    setStep(5)
    loadHistory()
  }

  async function undoMigration(logId: string) {
    if (!confirm('This will delete ALL leads imported in this batch. Cannot be undone. Proceed?')) return
    setUndoing(true)
    // We store migration context: delete leads imported after the migration start time
    const log = logs.find(l => l.id === logId)
    if (!log) { setUndoing(false); return }
    // Delete leads created around the migration time (±5 seconds)
    const from = new Date(new Date(log.migration_date).getTime() - 5000).toISOString()
    const to = new Date(new Date(log.migration_date).getTime() + log.total_records * 200 + 10000).toISOString()
    await supabase.from('leads').delete().gte('created_at', from).lte('created_at', to)
    await supabase.from('migration_logs').update({ status: 'Failed' }).eq('id', logId)
    setUndoing(false)
    loadHistory()
    alert('Migration undone successfully.')
  }

  function downloadErrors() {
    if (!result) return
    const rows = [['Row', 'Name', 'Phone', 'Reason'], ...result.errors.map(e => [e.row, e.name, e.phone, e.reason])]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'migration_errors.csv'; a.click()
  }

  function reset() {
    setStep(1); setFile(null); setHeaders([]); setRawRows([])
    setFieldMap({}); setMappedLeads([]); setResult(null); setProgress(0)
  }

  const readyCount = mappedLeads.filter(l => !l.skip && l.issues.length === 0).length
  const warnCount = mappedLeads.filter(l => !l.skip && l.issues.length > 0).length
  const skipCount = mappedLeads.filter(l => l.skip).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Data Migration</h1>
          <p className="text-slate-500 text-sm mt-1">Import leads from Tranquil CRM or any CSV/Excel file</p>
        </div>
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
          {(['migrate', 'history'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition-all ${activeTab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
              {t === 'history' ? <span className="flex items-center gap-1"><History className="w-3.5 h-3.5" /> History</span> : <span className="flex items-center gap-1"><Upload className="w-3.5 h-3.5" /> Migrate</span>}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'history' && (
        <div className="bg-white rounded-xl border border-slate-200">
          {logs.length === 0 ? (
            <div className="p-12 text-center text-slate-400">No migrations yet</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>{['Date', 'File', 'Total', 'Imported', 'Duplicates', 'Failed', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600">{new Date(log.migration_date).toLocaleDateString('en-IN')}</td>
                    <td className="px-4 py-3 font-medium text-slate-900 max-w-32 truncate">{log.file_name}</td>
                    <td className="px-4 py-3">{log.total_records}</td>
                    <td className="px-4 py-3 text-green-700 font-medium">{log.successful}</td>
                    <td className="px-4 py-3 text-amber-700">{log.duplicates}</td>
                    <td className="px-4 py-3 text-red-600">{log.failed}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs rounded-full px-2 py-0.5 ${log.status === 'Completed' ? 'bg-green-100 text-green-700' : log.status === 'Failed' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{log.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      {log.status === 'Completed' && (
                        <button onClick={() => undoMigration(log.id)} disabled={undoing} className="text-xs text-red-500 hover:underline flex items-center gap-1">
                          <Undo2 className="w-3 h-3" /> Undo
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'migrate' && (
        <div className="space-y-6">
          {/* Step Indicators */}
          <div className="flex items-center gap-2 overflow-x-auto">
            {[
              { n: 1, label: 'Upload' },
              { n: 2, label: 'Map Fields' },
              { n: 3, label: 'Preview' },
              { n: 4, label: 'Import' },
              { n: 5, label: 'Done' },
            ].map((s, i) => (
              <React.Fragment key={s.n}>
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium flex-shrink-0 ${step === s.n ? 'bg-amber-600 text-white' : step > s.n ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                  {step > s.n ? <CheckCircle className="w-3.5 h-3.5" /> : <span className="w-4 h-4 flex items-center justify-center text-xs">{s.n}</span>}
                  {s.label}
                </div>
                {i < 4 && <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />}
              </React.Fragment>
            ))}
          </div>

          {/* Step 1: Upload */}
          {step === 1 && (
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
              className={`border-2 border-dashed rounded-xl p-16 text-center transition-colors cursor-pointer ${dragging ? 'border-amber-400 bg-amber-50' : 'border-slate-200 hover:border-slate-300'}`}
              onClick={() => fileRef.current?.click()}
            >
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
              <Upload className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-lg font-semibold text-slate-700">Drop your CSV or Excel file here</p>
              <p className="text-slate-400 text-sm mt-1">or click to browse — max 10 MB</p>
              <p className="text-slate-400 text-xs mt-3">Supports: Tranquil CRM export, any CSV or .xlsx file</p>
            </div>
          )}

          {/* Step 2: Field Mapping */}
          {step === 2 && (
            <div className="bg-white rounded-xl border border-slate-200">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-800">Map Fields</h3>
                  <p className="text-sm text-slate-500 mt-0.5">{file?.name} — {rawRows.length} rows</p>
                </div>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-1">
                  <span>Tranquil CRM Field</span>
                  <span>Gnanova Field</span>
                </div>
                <div className="space-y-2">
                  {headers.map(col => (
                    <div key={col} className="grid grid-cols-2 gap-2 items-center">
                      <div className="bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-700 font-medium border border-slate-200">{col}</div>
                      <select
                        value={fieldMap[col] || '__skip__'}
                        onChange={e => setFieldMap(m => ({ ...m, [col]: e.target.value }))}
                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                      >
                        {GNANOVA_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
                <button onClick={goToPreview} className="mt-6 w-full py-3 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-700 flex items-center justify-center gap-2">
                  <Eye className="w-4 h-4" /> Preview Data
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 3 && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                  <p className="text-2xl font-bold text-slate-900">{mappedLeads.length}</p>
                  <p className="text-xs text-slate-500">Total Rows</p>
                </div>
                <div className="bg-green-50 rounded-xl border border-green-200 p-4 text-center">
                  <p className="text-2xl font-bold text-green-700">{readyCount}</p>
                  <p className="text-xs text-green-600">Ready</p>
                </div>
                <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 text-center">
                  <p className="text-2xl font-bold text-amber-700">{warnCount}</p>
                  <p className="text-xs text-amber-600">Warnings</p>
                </div>
                <div className="bg-red-50 rounded-xl border border-red-200 p-4 text-center">
                  <p className="text-2xl font-bold text-red-700">{skipCount}</p>
                  <p className="text-xs text-red-600">Will Skip</p>
                </div>
              </div>

              {/* Preview Table */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100">
                  <h3 className="font-semibold text-slate-800">First 10 rows preview</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>{['Row', 'Name', 'Phone', 'Stage', 'Source', 'Status'].map(h => (
                        <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {mappedLeads.slice(0, 10).map(lead => (
                        <tr key={lead.row_index} className={lead.skip ? 'bg-red-50' : lead.issues.length ? 'bg-amber-50' : ''}>
                          <td className="px-3 py-2 text-slate-400 text-xs">{lead.row_index}</td>
                          <td className="px-3 py-2 font-medium text-slate-900">{lead.name || <span className="text-red-500 italic">missing</span>}</td>
                          <td className="px-3 py-2 text-slate-600 font-mono text-xs">{lead.phone || <span className="text-red-500 italic">missing</span>}</td>
                          <td className="px-3 py-2 text-slate-600">{lead.pipeline_stage}</td>
                          <td className="px-3 py-2 text-slate-600">{lead.source}</td>
                          <td className="px-3 py-2">
                            {lead.skip ? (
                              <span className="flex items-center gap-1 text-red-600 text-xs"><X className="w-3 h-3" /> Skip: {lead.issues[0]}</span>
                            ) : lead.issues.length ? (
                              <span className="flex items-center gap-1 text-amber-600 text-xs"><AlertTriangle className="w-3 h-3" />{lead.issues[0]}</span>
                            ) : (
                              <span className="flex items-center gap-1 text-green-600 text-xs"><CheckCircle className="w-3 h-3" /> Ready</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="px-6 py-3 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50">← Back</button>
                <button onClick={runImport} className="flex-1 py-3 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-700 flex items-center justify-center gap-2">
                  <Play className="w-4 h-4" /> Import {readyCount + warnCount} Leads
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Importing */}
          {step === 4 && (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <Loader2 className="w-12 h-12 text-amber-600 animate-spin mx-auto mb-6" />
              <h3 className="text-xl font-bold text-slate-900 mb-2">Importing leads…</h3>
              <p className="text-slate-500 mb-6">{progress}% complete</p>
              <div className="w-full max-w-md mx-auto bg-slate-100 rounded-full h-3">
                <div className="bg-amber-600 h-3 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-sm text-slate-400 mt-4">Do not close this tab</p>
            </div>
          )}

          {/* Step 5: Done */}
          {step === 5 && result && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-slate-900 mb-6">Migration Complete</h3>
                <div className="grid grid-cols-3 gap-6 max-w-md mx-auto mb-8">
                  <div>
                    <p className="text-3xl font-bold text-green-600">{result.success}</p>
                    <p className="text-sm text-slate-500">Imported</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-amber-600">{result.duplicates}</p>
                    <p className="text-sm text-slate-500">Duplicates</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-red-600">{result.errors.filter(e => e.reason !== 'Duplicate phone').length}</p>
                    <p className="text-sm text-slate-500">Failed</p>
                  </div>
                </div>
                <div className="flex gap-3 justify-center flex-wrap">
                  <a href="/dashboard/leads" className="px-6 py-3 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-700">View Leads →</a>
                  <button onClick={reset} className="px-6 py-3 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50">Import Another File</button>
                  {result.errors.length > 0 && (
                    <button onClick={downloadErrors} className="px-6 py-3 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                      <Download className="w-4 h-4" /> Download Error Log
                    </button>
                  )}
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200">
                  <div className="p-4 border-b border-slate-100">
                    <h3 className="font-semibold text-slate-800">Skipped / Failed Records</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>{['Row', 'Name', 'Phone', 'Reason'].map(h => (
                          <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase">{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {result.errors.slice(0, 50).map((e, i) => (
                          <tr key={i} className={e.reason === 'Duplicate phone' ? 'bg-amber-50' : 'bg-red-50'}>
                            <td className="px-4 py-2 text-slate-400">{e.row}</td>
                            <td className="px-4 py-2">{e.name}</td>
                            <td className="px-4 py-2 font-mono text-xs">{e.phone}</td>
                            <td className="px-4 py-2 text-red-600">{e.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { Users, Pencil, X, Loader2 } from 'lucide-react'

type AgentWorkloadRow = {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  zip_codes: string[] | null
  specialty_tags: string[] | null
  max_leads: number | null
  is_available: boolean | null
  active_lead_count: number
}

function arrToCsv(arr: string[] | null | undefined): string {
  if (!arr?.length) return ''
  return arr.join(', ')
}

function csvToArr(s: string): string[] {
  return s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
}

export default function AgentSettingsPage() {
  const { agent } = useAuth()
  const [rows, setRows] = useState<AgentWorkloadRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editRow, setEditRow] = useState<AgentWorkloadRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    is_available: true,
    zip_csv: '',
    tags_csv: '',
    max_leads: 50,
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: qErr } = await supabase.from('agent_workload').select('*').order('full_name')
      if (qErr) throw qErr
      setRows((data as AgentWorkloadRow[]) || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load agents')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openEdit = (r: AgentWorkloadRow) => {
    setEditRow(r)
    setForm({
      full_name: r.full_name || '',
      email: r.email || '',
      phone: r.phone || '',
      is_available: r.is_available !== false,
      zip_csv: arrToCsv(r.zip_codes),
      tags_csv: arrToCsv(r.specialty_tags),
      max_leads: r.max_leads ?? 50,
    })
  }

  const saveEdit = async () => {
    if (!editRow) return
    setSaving(true)
    setError(null)
    try {
      const { error: uErr } = await supabase
        .from('agents')
        .update({
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
          is_available: form.is_available,
          zip_codes: csvToArr(form.zip_csv),
          specialty_tags: csvToArr(form.tags_csv),
          max_leads: Math.max(1, Number(form.max_leads) || 50),
        } as never)
        .eq('id', editRow.id)
      if (uErr) throw uErr
      setEditRow(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (!agent) {
    return <div className="flex items-center justify-center h-64 text-slate-600">Sign in to manage agents.</div>
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2 text-slate-600">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        Loading agents…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Agent settings</h1>
        <p className="text-slate-600 mt-1">Coverage zip codes, capacity, and availability for lead matching</p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800 text-sm">{error}</div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="bg-slate-50 text-left text-xs font-medium text-slate-600 uppercase">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Available</th>
                <th className="px-4 py-3">Zip codes</th>
                <th className="px-4 py-3">Max leads</th>
                <th className="px-4 py-3">Active leads</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    No agents found. Run migration 009 and ensure your <code className="text-slate-700">agents</code>{' '}
                    table is populated.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{r.full_name || '—'}</td>
                    <td className="px-4 py-3 text-slate-700">{r.email || '—'}</td>
                    <td className="px-4 py-3 text-slate-700">{r.phone || '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          r.is_available !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {r.is_available !== false ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate" title={arrToCsv(r.zip_codes)}>
                      {arrToCsv(r.zip_codes) || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{r.max_leads ?? 50}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{r.active_lead_count ?? 0}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openEdit(r)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-800 hover:bg-slate-50 text-sm font-medium"
                      >
                        <Pencil className="w-4 h-4" />
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editRow && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full shadow-xl">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Edit agent
              </h2>
              <button type="button" onClick={() => setEditRow(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3 max-h-[85vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Full name</label>
                <input
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  value={form.full_name}
                  onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Email</label>
                <input
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Phone</label>
                <input
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-800">
                <input
                  type="checkbox"
                  checked={form.is_available}
                  onChange={(e) => setForm((f) => ({ ...f, is_available: e.target.checked }))}
                />
                Available for new leads
              </label>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Zip codes (comma-separated)</label>
                <input
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="500001, 500032"
                  value={form.zip_csv}
                  onChange={(e) => setForm((f) => ({ ...f, zip_csv: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Specialty tags (comma-separated)</label>
                <input
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="luxury, rental"
                  value={form.tags_csv}
                  onChange={(e) => setForm((f) => ({ ...f, tags_csv: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Max leads</label>
                <input
                  type="number"
                  min={1}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  value={form.max_leads}
                  onChange={(e) => setForm((f) => ({ ...f, max_leads: Number(e.target.value) }))}
                />
              </div>
              <p className="text-xs text-slate-500">
                Active leads (read-only): <strong>{editRow.active_lead_count ?? 0}</strong>
              </p>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditRow(null)}
                  className="flex-1 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={saveEdit}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { apiFetch } from '@/lib/api-fetch'
import type { LeadFieldDef, WorkspaceConfig } from '@/lib/workspaces'

type Props = {
  workspace: WorkspaceConfig
  onClose: () => void
  onCreated: (summary: string) => void
}

const STATUS_TEXT = { done: 'sent', skipped: 'not configured', failed: 'failed' } as const

function fieldId(field: LeadFieldDef): string {
  return field.column ?? `custom.${field.customKey}`
}

export default function AddLeadModal({ workspace, onClose, onCreated }: Props) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { bolnaCall, whatsappWelcome } = workspace.automations

  async function submit() {
    setSaving(true)
    setError(null)
    try {
      const body: Record<string, unknown> = { custom_fields: {} as Record<string, string> }
      for (const field of workspace.leadFields) {
        const value = values[fieldId(field)]?.trim()
        if (!value) continue
        if (field.column) body[field.column] = value
        else if (field.customKey) (body.custom_fields as Record<string, string>)[field.customKey] = value
      }
      const res = await apiFetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const j = (await res.json().catch(() => ({}))) as {
        error?: string
        automations?: { bolnaCall: keyof typeof STATUS_TEXT; whatsappWelcome: keyof typeof STATUS_TEXT }
      }
      if (!res.ok) throw new Error(j.error || 'Could not create lead')

      const parts = ['Lead added.']
      if (bolnaCall && j.automations) parts.push(`${bolnaCall.agentName} call: ${STATUS_TEXT[j.automations.bolnaCall]}.`)
      if (whatsappWelcome && j.automations) parts.push(`WhatsApp welcome: ${STATUS_TEXT[j.automations.whatsappWelcome]}.`)
      onCreated(parts.join(' '))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not create lead')
    } finally {
      setSaving(false)
    }
  }

  const missingRequired = workspace.leadFields.some((f) => f.required && !values[fieldId(f)]?.trim())
  const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Add lead · {workspace.name}</h2>
          <button type="button" onClick={onClose} className="text-lg leading-none text-slate-400 hover:text-slate-700">
            ✕
          </button>
        </div>

        {(bolnaCall || whatsappWelcome) && (
          <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-900">
            On save:
            {bolnaCall && ` ${bolnaCall.agentName} calls instantly (${bolnaCall.languages.join(' + ')}).`}
            {whatsappWelcome && ' WhatsApp welcome message is sent.'}
          </p>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {workspace.leadFields.map((field) => {
            const id = fieldId(field)
            const value = values[id] ?? ''
            const set = (v: string) => setValues((prev) => ({ ...prev, [id]: v }))
            const label = `${field.label}${field.required ? ' *' : ''}`

            if (field.type === 'textarea') {
              return (
                <label key={id} className="sm:col-span-2 text-xs font-medium text-slate-700">
                  {label}
                  <textarea value={value} onChange={(e) => set(e.target.value)} rows={3} className={inputClass} />
                </label>
              )
            }
            if (field.type === 'source' && workspace.sourceTags) {
              return (
                <label key={id} className="text-xs font-medium text-slate-700">
                  {label}
                  <select value={value} onChange={(e) => set(e.target.value)} className={inputClass}>
                    <option value="">Select source…</option>
                    {workspace.sourceTags.map((tag) => (
                      <option key={tag} value={tag}>
                        {tag}
                      </option>
                    ))}
                  </select>
                </label>
              )
            }
            return (
              <label key={id} className="text-xs font-medium text-slate-700">
                {label}
                <input
                  type={field.type === 'source' ? 'text' : field.type}
                  min={field.type === 'number' ? 0 : undefined}
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  className={inputClass}
                />
              </label>
            )
          })}
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || missingRequired}
            onClick={() => void submit()}
            className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Add lead'}
          </button>
        </div>
      </div>
    </div>
  )
}

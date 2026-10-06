'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../../../../lib/api-fetch'

type Thread = {
  id: string
  phone_number: string
  status: string
  last_message_preview: string | null
  last_message_at: string | null
  unread_count: number
  contact_name: string
}

type Message = {
  id: string
  direction: 'inbound' | 'outbound'
  sender_type: string
  body: string
  created_at: string
}

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'unassigned', label: 'Unassigned' },
  { id: 'bot_handling', label: 'Bot' },
  { id: 'agent_handling', label: 'Agent' },
  { id: 'closed', label: 'Closed' },
]

function statusClass(status: string) {
  if (status === 'unassigned') return 'bg-amber-100 text-amber-800'
  if (status === 'bot_handling') return 'bg-sky-100 text-sky-800'
  if (status === 'agent_handling') return 'bg-emerald-100 text-emerald-800'
  return 'bg-slate-200 text-slate-600'
}

export default function WhatsAppInboxPage() {
  const [filter, setFilter] = useState('all')
  const [threads, setThreads] = useState<Thread[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadThreads = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = filter === 'all' ? '' : `?status=${filter}`
      const res = await apiFetch(`/api/whatsapp/threads${params}`)
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Failed to load threads')
      const rows = (j.threads as Thread[]) || []
      setThreads(rows)
      setSelectedId((prev) => prev || rows[0]?.id || null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [filter])

  const loadMessages = useCallback(async (id: string) => {
    const res = await apiFetch(`/api/whatsapp/threads/${id}/messages`)
    const j = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(j.error || 'Failed to load messages')
      return
    }
    setMessages((j.messages as Message[]) || [])
  }, [])

  useEffect(() => {
    void loadThreads()
  }, [loadThreads])

  useEffect(() => {
    if (selectedId) void loadMessages(selectedId)
  }, [selectedId, loadMessages])

  async function send() {
    if (!selectedId || !draft.trim()) return
    setSending(true)
    const res = await apiFetch(`/api/whatsapp/threads/${selectedId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: draft.trim() }),
    })
    setSending(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(j.error || 'Send failed')
      return
    }
    setDraft('')
    void loadMessages(selectedId)
    void loadThreads()
  }

  const selected = threads.find((t) => t.id === selectedId)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">WhatsApp</h1>
        <p className="text-sm text-slate-500 mt-1">Lead inbox from whatsapp_threads</p>
      </div>
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{error}</div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] min-h-[520px] rounded-xl overflow-hidden border border-slate-800">
        <aside className="bg-slate-950 text-slate-100 flex flex-col">
          <div className="flex flex-wrap gap-1 p-3 border-b border-slate-800">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`rounded-md px-2 py-1 text-[11px] font-semibold ${
                  filter === f.id ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <p className="text-xs text-slate-500 p-4">Loading…</p>
            ) : threads.length === 0 ? (
              <p className="text-xs text-slate-500 p-4">No threads</p>
            ) : (
              threads.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedId(t.id)}
                  className={`w-full text-left px-3 py-3 border-b border-slate-800 ${
                    selectedId === t.id ? 'bg-slate-800' : 'hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold truncate">{t.contact_name}</span>
                    <span className="text-[10px] text-slate-500">
                      {t.last_message_at ? new Date(t.last_message_at).toLocaleTimeString() : ''}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 truncate mt-1">{t.last_message_preview || '—'}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${statusClass(t.status)}`}>{t.status}</span>
                    {t.unread_count > 0 && (
                      <span className="text-[10px] bg-blue-600 text-white rounded-full px-1.5">{t.unread_count}</span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>
        <section className="bg-slate-900 text-slate-100 flex flex-col">
          <div className="px-4 py-3 border-b border-slate-800">
            <p className="text-sm font-semibold">{selected?.contact_name || 'Select a conversation'}</p>
            {selected && <p className="text-xs text-slate-400">{selected.phone_number}</p>}
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                  m.direction === 'outbound'
                    ? 'ml-auto bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-100'
                }`}
              >
                <p className="whitespace-pre-wrap">{m.body}</p>
                <p className="text-[10px] opacity-70 mt-1">{new Date(m.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
          <form
            className="p-3 border-t border-slate-800 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              void send()
            }}
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Type a message…"
              className="flex-1 rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white"
            />
            <button
              type="submit"
              disabled={sending || !draft.trim() || !selectedId}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}

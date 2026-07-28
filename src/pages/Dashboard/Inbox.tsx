import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import {
  Bot,
  ChevronDown,
  ChevronUp,
  Loader2,
  MessageCircle,
  Send,
  StickyNote,
  UserCheck,
  XCircle,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import {
  addWhatsAppThreadNote,
  assignWhatsAppThread,
  closeWhatsAppThread,
  fetchWhatsAppThread,
  fetchWhatsAppThreads,
  replyWhatsAppThread,
  threadDisplayName,
  WHATSAPP_THREAD_STATUSES,
  WHATSAPP_THREAD_STATUS_BADGE,
  WHATSAPP_THREAD_STATUS_LABELS,
  type WhatsAppInternalNoteRow,
  type WhatsAppThreadMessageRow,
  type WhatsAppThreadRow,
  type WhatsAppThreadStatus,
} from '../../lib/whatsapp-inbox'

type AgentPick = { id: string; full_name: string | null }

function StatusBadge({ status }: { status: WhatsAppThreadStatus }) {
  const style = WHATSAPP_THREAD_STATUS_BADGE[status]
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${style.bg} ${style.text} ${style.border}`}
    >
      {WHATSAPP_THREAD_STATUS_LABELS[status]}
    </span>
  )
}

function MessageBubble({ message }: { message: WhatsAppThreadMessageRow }) {
  const isOutbound = message.direction === 'outbound'
  const isBot = message.sender_type === 'bot'
  const isAgent = message.sender_type === 'agent'

  const align = isOutbound ? 'justify-end' : 'justify-start'
  const bubbleClass = isAgent
    ? 'bg-blue-600 text-white rounded-br-sm'
    : isBot
      ? 'bg-sky-100 text-sky-900 border border-sky-200 rounded-bl-sm'
      : 'bg-white text-slate-900 border border-slate-200 rounded-bl-sm'

  return (
    <div className={`flex ${align}`}>
      <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm ${bubbleClass}`}>
        <div className="flex items-center gap-1.5 mb-1">
          {isBot && <Bot className="w-3.5 h-3.5 opacity-70" />}
          <span className="text-[10px] uppercase tracking-wide opacity-70 font-semibold">
            {message.sender_type === 'lead' ? 'Lead' : isBot ? 'Auto-reply' : 'You'}
          </span>
        </div>
        <p className="text-sm whitespace-pre-wrap break-words">{message.body || '(empty)'}</p>
        {message.media_url && (
          <a
            href={message.media_url}
            target="_blank"
            rel="noreferrer"
            className="text-xs underline mt-1 inline-block opacity-80"
          >
            View media
          </a>
        )}
        <p className={`text-[10px] mt-1.5 ${isAgent ? 'text-blue-100' : 'text-slate-400'}`}>
          {format(new Date(message.created_at), 'MMM d, h:mm a')}
        </p>
      </div>
    </div>
  )
}

export default function InboxPage() {
  const { agent, loading: authLoading } = useAuth()
  const [threads, setThreads] = useState<WhatsAppThreadRow[]>([])
  const [agents, setAgents] = useState<AgentPick[]>([])
  const [isManager, setIsManager] = useState(false)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<WhatsAppThreadMessageRow[]>([])
  const [notes, setNotes] = useState<WhatsAppInternalNoteRow[]>([])
  const [selectedThread, setSelectedThread] = useState<WhatsAppThreadRow | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [agentFilter, setAgentFilter] = useState<string>('all')
  const [replyText, setReplyText] = useState('')
  const [noteText, setNoteText] = useState('')
  const [notesOpen, setNotesOpen] = useState(true)
  const [sending, setSending] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const loadAgents = useCallback(async () => {
    const { data } = await supabase.from('agents_directory').select('id, full_name').order('full_name')
    setAgents((data as AgentPick[]) || [])
  }, [])

  const loadManagerFlag = useCallback(async () => {
    if (!agent?.id) return
    const { data } = await supabase
      .from('agents')
      .select('is_manager')
      .eq('id', agent.id)
      .maybeSingle()
    setIsManager(Boolean((data as { is_manager?: boolean } | null)?.is_manager))
  }, [agent?.id])

  const loadThreads = useCallback(async () => {
    if (!agent) return
    try {
      const params: { status?: WhatsAppThreadStatus; assigned_agent_id?: string } = {}
      if (statusFilter !== 'all') params.status = statusFilter as WhatsAppThreadStatus
      if (agentFilter === 'mine') params.assigned_agent_id = agent.id
      else if (agentFilter !== 'all' && agentFilter !== 'unassigned') {
        params.assigned_agent_id = agentFilter
      }
      const rows = await fetchWhatsAppThreads(
        Object.keys(params).length > 0 ? params : undefined
      )
      let filtered = rows
      if (agentFilter === 'unassigned') {
        filtered = rows.filter((t) => !t.assigned_agent_id)
      }
      setThreads(filtered)
    } catch (e) {
      console.error('Inbox threads load failed:', e)
    }
  }, [agent, statusFilter, agentFilter])

  const loadDetail = useCallback(async (threadId: string) => {
    setDetailLoading(true)
    setActionError(null)
    try {
      const data = await fetchWhatsAppThread(threadId)
      setSelectedThread(data.thread)
      setMessages(data.messages)
      setNotes(data.notes)
      setThreads((prev) =>
        prev.map((t) => (t.id === threadId ? { ...t, unread_count: 0 } : t))
      )
    } catch (e) {
      console.error('Thread detail load failed:', e)
      setActionError(e instanceof Error ? e.message : 'Failed to load thread')
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authLoading || !agent) {
      setLoading(false)
      return
    }
    setLoading(true)
    Promise.all([loadAgents(), loadManagerFlag(), loadThreads()]).finally(() => setLoading(false))
  }, [agent, authLoading, loadAgents, loadManagerFlag, loadThreads])

  useEffect(() => {
    if (selectedId) loadDetail(selectedId)
    else {
      setSelectedThread(null)
      setMessages([])
      setNotes([])
    }
  }, [selectedId, loadDetail])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, selectedId])

  useEffect(() => {
    if (!agent?.id) return

    const channel = supabase
      .channel('whatsapp-inbox-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_threads' },
        () => {
          void loadThreads()
          if (selectedId) void loadDetail(selectedId)
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'whatsapp_thread_messages' },
        () => {
          void loadThreads()
          if (selectedId) void loadDetail(selectedId)
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'whatsapp_internal_notes' },
        () => {
          if (selectedId) void loadDetail(selectedId)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [agent?.id, selectedId, loadThreads, loadDetail])

  const selectedFromList = useMemo(
    () => threads.find((t) => t.id === selectedId) ?? selectedThread,
    [threads, selectedId, selectedThread]
  )

  async function handleAssignToMe() {
    if (!agent || !selectedId) return
    setActionError(null)
    try {
      const updated = await assignWhatsAppThread(selectedId, agent.id)
      setSelectedThread(updated)
      await loadThreads()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Assign failed')
    }
  }

  async function handleReassign(targetAgentId: string) {
    if (!agent || !selectedId || !targetAgentId) return
    setActionError(null)
    try {
      const updated = await assignWhatsAppThread(selectedId, targetAgentId, agent.id)
      setSelectedThread(updated)
      await loadThreads()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Reassign failed')
    }
  }

  async function handleSendReply(e: React.FormEvent) {
    e.preventDefault()
    if (!agent || !selectedId || !replyText.trim()) return
    const text = replyText.trim()
    setSending(true)
    setActionError(null)

    const optimistic: WhatsAppThreadMessageRow = {
      id: `opt-${Date.now()}`,
      thread_id: selectedId,
      direction: 'outbound',
      sender_type: 'agent',
      sender_agent_id: agent.id,
      body: text,
      media_url: null,
      twilio_message_sid: null,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])
    setReplyText('')

    try {
      const { thread, message } = await replyWhatsAppThread(selectedId, agent.id, text)
      setSelectedThread(thread)
      setMessages((prev) => [...prev.filter((m) => m.id !== optimistic.id), message])
      await loadThreads()
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
      setReplyText(text)
      setActionError(err instanceof Error ? err.message : 'Send failed')
    } finally {
      setSending(false)
    }
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault()
    if (!agent || !selectedId || !noteText.trim()) return
    setSending(true)
    setActionError(null)
    try {
      const note = await addWhatsAppThreadNote(selectedId, agent.id, noteText.trim())
      setNotes((prev) => [...prev, note])
      setNoteText('')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Note failed')
    } finally {
      setSending(false)
    }
  }

  async function handleClose() {
    if (!selectedId) return
    setActionError(null)
    try {
      const updated = await closeWhatsAppThread(selectedId)
      setSelectedThread(updated)
      await loadThreads()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Close failed')
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-slate-500">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Loading inbox…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <MessageCircle className="w-7 h-7 text-emerald-600" />
            WhatsApp Inbox
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Team conversations — bot handles new threads until you reply
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col lg:flex-row min-h-[calc(100vh-12rem)]">
        {/* Left pane — thread list */}
        <div
          className={`w-full lg:w-96 lg:min-w-[20rem] border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col ${
            selectedId ? 'hidden lg:flex' : 'flex'
          }`}
        >
          <div className="p-4 border-b border-slate-100 space-y-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50"
            >
              <option value="all">All statuses</option>
              {WHATSAPP_THREAD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {WHATSAPP_THREAD_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
            <select
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50"
            >
              <option value="all">All agents</option>
              <option value="mine">Assigned to me</option>
              <option value="unassigned">Unassigned only</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.full_name || a.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 overflow-y-auto">
            {threads.length === 0 ? (
              <p className="p-6 text-sm text-slate-500 text-center">No conversations yet</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {threads.map((thread) => {
                  const isSelected = thread.id === selectedId
                  const isUnassigned = !thread.assigned_agent_id
                  return (
                    <li key={thread.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(thread.id)}
                        className={`w-full text-left p-4 hover:bg-slate-50 transition-colors ${
                          isSelected ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                        } ${isUnassigned && !isSelected ? 'bg-amber-50/50' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-slate-900 truncate">
                              {threadDisplayName(thread)}
                            </p>
                            <p className="text-xs text-slate-500 truncate">{thread.phone_number}</p>
                          </div>
                          {thread.unread_count > 0 && (
                            <span className="shrink-0 bg-blue-600 text-white text-xs font-bold rounded-full min-w-[1.25rem] h-5 px-1.5 flex items-center justify-center">
                              {thread.unread_count > 99 ? '99+' : thread.unread_count}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-600 mt-1 line-clamp-2">
                          {thread.last_message_preview || 'No messages yet'}
                        </p>
                        <div className="flex items-center justify-between mt-2 gap-2">
                          <StatusBadge status={thread.status} />
                          <span className="text-[10px] text-slate-400 shrink-0">
                            {thread.last_message_at
                              ? formatDistanceToNow(new Date(thread.last_message_at), {
                                  addSuffix: true,
                                })
                              : '—'}
                          </span>
                        </div>
                        {thread.agents?.full_name && (
                          <p className="text-[10px] text-slate-400 mt-1">
                            → {thread.agents.full_name}
                          </p>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Right pane — conversation */}
        <div
          className={`flex-1 flex flex-col min-h-[24rem] ${
            selectedId ? 'flex' : 'hidden lg:flex'
          }`}
        >
          {!selectedId ? (
            <div className="flex-1 flex items-center justify-center text-slate-400 p-8">
              <div className="text-center">
                <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>Select a conversation to view messages</p>
              </div>
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div className="p-4 border-b border-slate-200 bg-slate-50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <button
                      type="button"
                      className="lg:hidden text-sm text-blue-600 mb-2"
                      onClick={() => setSelectedId(null)}
                    >
                      ← Back to list
                    </button>
                    <h2 className="font-semibold text-slate-900 truncate">
                      {selectedFromList ? threadDisplayName(selectedFromList) : '…'}
                    </h2>
                    <p className="text-sm text-slate-500">
                      {selectedFromList?.phone_number}
                    </p>
                    {selectedFromList && (
                      <div className="mt-2">
                        <StatusBadge status={selectedFromList.status} />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {selectedFromList?.status !== 'closed' &&
                      (!selectedFromList?.assigned_agent_id ||
                        selectedFromList.assigned_agent_id !== agent?.id) && (
                        <button
                          type="button"
                          onClick={handleAssignToMe}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-white border border-slate-200 rounded-lg hover:bg-slate-100"
                        >
                          <UserCheck className="w-4 h-4" />
                          Assign to me
                        </button>
                      )}
                    {isManager && selectedFromList && (
                      <select
                        value={selectedFromList.assigned_agent_id || ''}
                        onChange={(e) => handleReassign(e.target.value)}
                        className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white"
                      >
                        <option value="">Reassign…</option>
                        {agents.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.full_name || 'Agent'}
                          </option>
                        ))}
                      </select>
                    )}
                    {selectedFromList?.status !== 'closed' && (
                      <button
                        type="button"
                        onClick={handleClose}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100"
                      >
                        <XCircle className="w-4 h-4" />
                        Close
                      </button>
                    )}
                  </div>
                </div>
                {actionError && (
                  <p className="mt-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    {actionError}
                  </p>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-100/80">
                {detailLoading && messages.length === 0 ? (
                  <div className="flex justify-center py-8 text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-center text-sm text-slate-500 py-8">No messages yet</p>
                ) : (
                  messages.map((m) => <MessageBubble key={m.id} message={m} />)
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply */}
              {selectedFromList?.status !== 'closed' && (
                <form
                  onSubmit={handleSendReply}
                  className="p-4 border-t border-slate-200 bg-white"
                >
                  {selectedFromList?.status === 'bot_handling' && (
                    <p className="text-xs text-sky-700 bg-sky-50 border border-sky-100 rounded-lg px-3 py-2 mb-3">
                      Bot is handling this thread. Sending a reply hands off to you and stops
                      auto-replies.
                    </p>
                  )}
                  <div className="flex gap-2">
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Type a message to the lead…"
                      rows={2}
                      className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={sending}
                    />
                    <button
                      type="submit"
                      disabled={sending || !replyText.trim()}
                      className="self-end px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      {sending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                      Send
                    </button>
                  </div>
                </form>
              )}

              {/* Internal notes */}
              <div className="border-t border-slate-200 bg-amber-50/30">
                <button
                  type="button"
                  onClick={() => setNotesOpen((o) => !o)}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-amber-900 hover:bg-amber-50/80"
                >
                  <span className="flex items-center gap-2">
                    <StickyNote className="w-4 h-4" />
                    Internal notes ({notes.length}) — not sent to lead
                  </span>
                  {notesOpen ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
                {notesOpen && (
                  <div className="px-4 pb-4 space-y-3">
                    {notes.length > 0 && (
                      <ul className="space-y-2 max-h-32 overflow-y-auto">
                        {notes.map((n) => (
                          <li
                            key={n.id}
                            className="text-sm bg-amber-50 border border-amber-200 border-dashed rounded-lg px-3 py-2"
                          >
                            <p className="text-amber-950">{n.note_text}</p>
                            <p className="text-[10px] text-amber-700/70 mt-1">
                              {n.agents?.full_name || 'Agent'} ·{' '}
                              {format(new Date(n.created_at), 'MMM d, h:mm a')}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                    <form onSubmit={handleAddNote} className="flex gap-2">
                      <input
                        type="text"
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="Note for your team…"
                        className="flex-1 text-sm border border-amber-200 rounded-lg px-3 py-2 bg-white"
                        disabled={sending}
                      />
                      <button
                        type="submit"
                        disabled={sending || !noteText.trim()}
                        className="px-3 py-2 text-sm font-medium bg-amber-100 text-amber-900 border border-amber-200 rounded-lg hover:bg-amber-200 disabled:opacity-50"
                      >
                        Add
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

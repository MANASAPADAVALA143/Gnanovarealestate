import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { Facebook, FileUp, MessageCircle, Users } from 'lucide-react'

type LeadRow = {
  id: string
  name: string | null
  phone: string | null
  email: string | null
  location: string | null
  source: string | null
  lead_score: number | null
  score_label: string | null
  created_at: string
}

type Band = 'hot' | 'warm' | 'cold' | 'unscored'

function bandOf(row: LeadRow): Band {
  const label = (row.score_label || '').toLowerCase()
  if (label.includes('hot')) return 'hot'
  if (label.includes('warm')) return 'warm'
  if (label.includes('cold')) return 'cold'
  if (row.lead_score == null || Number.isNaN(Number(row.lead_score))) return 'unscored'
  if (row.lead_score >= 75) return 'hot'
  if (row.lead_score >= 40) return 'warm'
  return 'cold'
}

function phoneKey(phone: string | null): string | null {
  const digits = (phone || '').replace(/\D/g, '')
  if (digits.length < 8) return null
  return digits.length > 10 ? digits.slice(-10) : digits
}

function emailKey(email: string | null): string | null {
  const value = (email || '').trim().toLowerCase()
  if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return null
  return value
}

export default function LeadGenerationPage() {
  const { agent, loading: authLoading } = useAuth()
  const [rows, setRows] = useState<LeadRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!agent) {
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const result = await Promise.race([
          supabase
            .from('leads')
            .select('id, name, phone, email, location, source, lead_score, score_label, created_at')
            .order('created_at', { ascending: false })
            .limit(500),
          new Promise<never>((_, reject) => {
            window.setTimeout(() => reject(new Error('timeout')), 8000)
          }),
        ])
        if (cancelled) return
        if (result.error) {
          console.error('Lead generation load failed:', result.error)
          setError('Leads could not be loaded. Refresh the page, or sign in again if your session expired.')
          setRows([])
        } else {
          setRows((result.data || []) as LeadRow[])
          setError(null)
        }
      } catch (err) {
        if (cancelled) return
        console.error('Lead generation load failed:', err)
        setError('Leads could not be loaded. The database did not respond. Check the connection, then refresh.')
        setRows([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [agent, authLoading])

  const report = useMemo(() => {
    const sources = new Map<string, number>()
    const bands: Record<Band, number> = { hot: 0, warm: 0, cold: 0, unscored: 0 }
    const byPhone = new Map<string, LeadRow[]>()
    const byEmail = new Map<string, LeadRow[]>()
    let missingPhone = 0
    let invalidEmail = 0
    let missingSource = 0

    for (const row of rows) {
      const source = row.source?.trim() || 'Unknown'
      sources.set(source, (sources.get(source) || 0) + 1)
      bands[bandOf(row)] += 1
      if (!phoneKey(row.phone)) missingPhone += 1
      if (row.email?.trim() && !emailKey(row.email)) invalidEmail += 1
      if (!row.source?.trim()) missingSource += 1
      const phone = phoneKey(row.phone)
      if (phone) byPhone.set(phone, [...(byPhone.get(phone) || []), row])
      const email = emailKey(row.email)
      if (email) byEmail.set(email, [...(byEmail.get(email) || []), row])
    }

    const duplicates = [
      ...[...byPhone.entries()].filter(([, group]) => group.length > 1).map(([key, group]) => ({
        kind: 'Phone' as const,
        key,
        group,
      })),
      ...[...byEmail.entries()].filter(([, group]) => group.length > 1).map(([key, group]) => ({
        kind: 'Email' as const,
        key,
        group,
      })),
    ]

    const sourceRows = [...sources.entries()].sort((a, b) => b[1] - a[1])
    return { sources: sourceRows, bands, duplicates, missingPhone, invalidEmail, missingSource }
  }, [rows])

  if (authLoading || loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-56 animate-pulse rounded bg-slate-200" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-white border border-slate-200" />
          ))}
        </div>
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="max-w-lg rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950">
        Sign in with an agent account to review lead sources.
      </div>
    )
  }

  const total = rows.length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Lead Generation</h1>
          <p className="mt-1 text-sm text-slate-600">
            Sources, score bands, and duplicate contacts from your lead records. Counts come from the database, not estimates.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/dashboard/data-migration" className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
            <FileUp className="h-4 w-4" />
            Import CSV
          </Link>
          <Link to="/dashboard/leads" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50">
            <Users className="h-4 w-4" />
            Add a lead
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Leads loaded" value={total} hint="Latest 500 records" />
        <Kpi label="Hot" value={report.bands.hot} hint="Score 75–100 or labelled Hot" tone="hot" />
        <Kpi label="Warm" value={report.bands.warm} hint="Score 40–74 or labelled Warm" tone="warm" />
        <Kpi label="Cold / unscored" value={report.bands.cold + report.bands.unscored} hint={`${report.bands.cold} cold · ${report.bands.unscored} not scored`} />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <ChannelLink to="/dashboard/facebook-leads" icon={Facebook} title="Facebook Lead Ads" body="Review leads captured from Meta." />
        <ChannelLink to="/dashboard/inbox" icon={MessageCircle} title="WhatsApp enquiries" body="Open conversations already in the inbox." />
        <ChannelLink to="/dashboard/data-migration" icon={FileUp} title="CSV and Excel import" body="Map columns, preview rows, then import." />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white">
          <header className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">Source performance</h2>
          </header>
          {report.sources.length === 0 ? (
            <p className="px-5 py-8 text-sm text-slate-500">No leads yet. Import a file or add a lead to see sources.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {report.sources.map(([source, count]) => (
                <li key={source} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span className="text-slate-800">{source}</span>
                  <span className="font-semibold text-slate-900">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white">
          <header className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">Records that need attention</h2>
          </header>
          <ul className="divide-y divide-slate-100 text-sm">
            <li className="flex items-center justify-between px-5 py-3">
              <span className="text-slate-700">Missing a usable phone number</span>
              <span className="font-semibold text-slate-900">{report.missingPhone}</span>
            </li>
            <li className="flex items-center justify-between px-5 py-3">
              <span className="text-slate-700">Email present but not a valid address</span>
              <span className="font-semibold text-slate-900">{report.invalidEmail}</span>
            </li>
            <li className="flex items-center justify-between px-5 py-3">
              <span className="text-slate-700">No lead source recorded</span>
              <span className="font-semibold text-slate-900">{report.missingSource}</span>
            </li>
            <li className="flex items-center justify-between px-5 py-3">
              <span className="text-slate-700">Duplicate phone or email groups</span>
              <span className="font-semibold text-slate-900">{report.duplicates.length}</span>
            </li>
          </ul>
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white">
        <header className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Possible duplicates</h2>
          <p className="mt-1 text-xs text-slate-500">Matched on the last 10 digits of a phone number, or on the same email address.</p>
        </header>
        {report.duplicates.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500">No duplicate phones or emails in the loaded leads.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Match</th>
                  <th className="px-5 py-3 font-medium">Names</th>
                  <th className="px-5 py-3 font-medium">Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.duplicates.slice(0, 25).map((dup) => (
                  <tr key={`${dup.kind}-${dup.key}`}>
                    <td className="px-5 py-3 text-slate-700">
                      {dup.kind}: {dup.key}
                    </td>
                    <td className="px-5 py-3 text-slate-900">{dup.group.map((row) => row.name || 'Unnamed').join(', ')}</td>
                    <td className="px-5 py-3 font-semibold text-slate-900">{dup.group.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: number
  hint: string
  tone?: 'hot' | 'warm'
}) {
  const accent = tone === 'hot' ? 'text-amber-700' : tone === 'warm' ? 'text-teal-700' : 'text-slate-900'
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${accent}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  )
}

function ChannelLink({
  to,
  icon: Icon,
  title,
  body,
}: {
  to: string
  icon: typeof Users
  title: string
  body: string
}) {
  return (
    <Link to={to} className="rounded-xl border border-slate-200 bg-white p-4 hover:border-blue-300 hover:shadow-sm">
      <Icon className="h-4 w-4 text-blue-600" />
      <p className="mt-3 text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{body}</p>
    </Link>
  )
}

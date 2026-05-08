import type { ReactNode } from 'react'
import Link from 'next/link'

const nav = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/properties', label: 'Properties' },
  { href: '/dashboard/campaigns', label: 'Campaigns' },
  { href: '/dashboard/speed-to-lead', label: 'Speed-to-Lead ⚡' },
  { href: '/dashboard/leads/scored', label: 'Hot Leads' },
]

export default function DashboardGroupLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 pt-3">
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-950 leading-snug">
            <strong className="font-semibold">Seeing a white screen?</strong> Open{' '}
            <strong>Chrome or Edge</strong> (not Cursor&apos;s Simple Browser) and go to{' '}
            <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] border border-amber-200">
              http://localhost:3002/dashboard
            </code>
            .             Run <code className="font-mono">npm run dashboard</code> (or <code className="font-mono">npm run next:dev</code>) in this project first —{' '}
            <code className="font-mono">npm run dev</code> starts Vite on port 3000, not this Next dashboard.
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-6 py-3 flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-slate-900 mr-2">Gnanova</span>
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
      <div className="p-6 max-w-6xl mx-auto">{children}</div>
    </div>
  )
}

import type { Metadata } from 'next'
import ViseshtaLeadForm from './ViseshtaLeadForm'

export const metadata: Metadata = {
  title: 'Viseshta Avenues — Earn ₹25,000/Month | Gachibowli, Hyderabad',
  description:
    'Invest ₹30 Lakhs in a commercial co-working unit at Viseshta Avenues, Gachibowli. ₹25,000 monthly rental, 5% annual growth, 100% bank guaranteed. Only 69 units.',
  openGraph: {
    title: 'Earn ₹25,000/Month. Hands-Free. — Viseshta Avenues',
    description: 'Commercial co-working units in Gachibowli, Hyderabad. Only 69 units available.',
    type: 'website',
  },
}

const STATS = [
  { value: '₹30 Lakhs', label: 'Investment' },
  { value: '₹25,000', label: 'Per month' },
  { value: '5%', label: 'Annual growth' },
  { value: '100%', label: 'Bank guaranteed' },
]

export default function ViseshtaLandingPage() {
  return (
    <main className="min-h-screen bg-[#0a1430] text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center gap-10 px-5 py-10 lg:flex-row lg:items-center lg:gap-16 lg:px-8">
        <section className="flex-1 space-y-6 text-center lg:text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
            Viseshta Avenues · Commercial Co-working
          </p>
          <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl">
            Earn <span className="text-amber-300">₹25,000/Month.</span>
            <br />
            Hands-Free.
          </h1>
          <p className="text-base text-slate-300 sm:text-lg">
            Viseshta Avenues, Gachibowli — Only 69 Units Available
          </p>

          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="rounded-xl border border-white/10 bg-white/5 px-3 py-4">
                <dt className="sr-only">{s.label}</dt>
                <dd className="whitespace-nowrap text-xl font-bold text-amber-300 sm:text-lg lg:text-xl">{s.value}</dd>
                <dd className="mt-1 text-xs text-slate-300">{s.label}</dd>
              </div>
            ))}
          </dl>

          <p className="text-xs text-slate-400">
            📍 7G Vyshnavi Cynosure, Gachibowli, Hyderabad - 500032
          </p>
        </section>

        <section className="w-full lg:max-w-md">
          <ViseshtaLeadForm />
        </section>
      </div>

      <footer className="px-5 pb-6 text-center text-[11px] text-slate-500">
        Figures as provided by the developer. Please review all project documents before investing.
      </footer>
    </main>
  )
}

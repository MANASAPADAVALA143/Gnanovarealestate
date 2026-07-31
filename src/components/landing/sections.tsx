import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Menu,
  X,
  Zap,
  Phone,
  BarChart3,
  CheckCircle2,
  Shield,
  Globe,
  Star,
  Linkedin,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import LeadCaptureForm from '@/components/LeadCaptureForm'
import { FadeIn } from './FadeIn'

type BookDemoProps = { onBookDemo: () => void }

export function LandingNav({ onBookDemo }: BookDemoProps) {
  const [open, setOpen] = useState(false)
  const { user } = useAuth()

  const links = [
    { href: '#solutions', label: 'Solutions' },
    { href: '#pricing', label: 'Pricing' },
    { href: '#results', label: 'Results' },
    { href: '#faq', label: 'FAQ' },
  ]

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.08] bg-[rgba(13,27,42,0.95)] backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <a href="#" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#7C3AED] to-[#06B6D4]" />
          <span className="text-lg font-bold text-white">Gnanova</span>
        </a>

        <div className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm text-[#94A3B8] transition hover:text-white"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          {user ? (
            <Link
              to="/dashboard"
              className="gn-btn-gradient px-5 py-2.5 text-sm"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link to="/login" className="text-sm font-medium text-white transition hover:text-[#A78BFA]">
                Sign In
              </Link>
              <button type="button" onClick={onBookDemo} className="gn-btn-gradient px-5 py-2.5 text-sm">
                Book Demo
              </button>
            </>
          )}
        </div>

        <button
          type="button"
          className="text-[#94A3B8] md:hidden"
          aria-label="Toggle menu"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      {open && (
        <div className="border-t border-white/[0.08] px-4 py-4 md:hidden">
          <div className="flex flex-col gap-3">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-[#94A3B8]"
                onClick={() => setOpen(false)}
              >
                {l.label}
              </a>
            ))}
            {user ? (
              <Link to="/dashboard" className="gn-btn-gradient px-4 py-2.5 text-center text-sm">
                Dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="text-white" onClick={() => setOpen(false)}>
                  Sign In
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    onBookDemo()
                  }}
                  className="gn-btn-gradient px-4 py-2.5 text-sm"
                >
                  Book Demo
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}

export function LandingHero({ onBookDemo }: BookDemoProps) {
  return (
    <section className="relative overflow-hidden pt-24 pb-16 sm:pt-28 sm:pb-24">
      <div
        className="gn-orb-float pointer-events-none absolute -left-20 top-10 h-[600px] w-[600px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%)',
        }}
      />
      <div
        className="gn-orb-float-reverse pointer-events-none absolute -right-20 bottom-0 h-[600px] w-[600px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(6,182,212,0.10) 0%, transparent 70%)',
        }}
      />

      <div className="relative mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:px-8">
        <div>
          <div className="mb-6 inline-flex items-center rounded-full border border-[rgba(124,58,237,0.3)] bg-[rgba(124,58,237,0.15)] px-3.5 py-1.5 text-[13px] text-[#A78BFA]">
            ⚡ AI Working 24/7 • Live Now
          </div>
          <h1 className="text-[44px] font-extrabold leading-[1.1] text-white sm:text-[64px] lg:text-[72px]">
            Close More Deals.
            <br />
            <span className="gn-gradient-text">Work Less.</span>
          </h1>
          <p className="mt-6 max-w-[480px] text-lg text-[#94A3B8]">
            AI voice agent calls every lead in 60 seconds. Qualifies. Scores. Routes to your best
            broker. You only talk to buyers ready to close.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button type="button" onClick={onBookDemo} className="gn-btn-gradient px-7 py-3.5 text-base">
              Start Free Trial →
            </button>
            <button
              type="button"
              onClick={onBookDemo}
              className="rounded-[10px] border border-white/15 bg-white/5 px-7 py-3.5 text-base font-semibold text-white transition hover:bg-white/10"
            >
              ▶ Watch Demo
            </button>
          </div>
          <p className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[#64748B]">
            <span>🏆 No setup fee</span>
            <span aria-hidden>•</span>
            <span>⚡ Live in 48 hours</span>
            <span aria-hidden>•</span>
            <span>🔒 UAE PDPL Compliant</span>
          </p>
        </div>

        <div className="relative mx-auto w-full max-w-md lg:max-w-none">
          <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#1E293B] shadow-[0_4px_16px_rgba(0,0,0,0.3)]">
            <img
              src="https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=600"
              alt="Dubai Marina"
              className="h-[200px] w-full object-cover"
            />
            <div className="p-4">
              <p className="text-lg font-bold text-white">AED 4.2M</p>
              <p className="text-[13px] text-[#94A3B8]">Dubai Marina</p>
              <p className="mt-3 flex items-center gap-2 text-xs text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                AI Matched • 2 mins ago
              </p>
            </div>
          </div>

          <div className="absolute -right-2 top-6 z-10 max-w-[200px] rounded-xl border border-[rgba(124,58,237,0.3)] bg-[#1E293B] px-4 py-3 shadow-lg sm:-right-6">
            <p className="text-xs font-bold text-[#A78BFA]">🔥 Lead Qualified</p>
            <p className="text-[13px] text-white">Sarah M. • Dubai Marina</p>
            <p className="text-[11px] text-[#06B6D4]">Just now</p>
          </div>

          <div className="absolute -left-2 bottom-24 z-10 hidden w-36 overflow-hidden rounded-xl border border-white/[0.08] bg-[#1E293B] shadow-lg sm:block sm:-left-8">
            <img
              src="https://images.unsplash.com/photo-1580674684081-7617fbf3d745?w=300"
              alt="Palm Jumeirah"
              className="h-20 w-full object-cover"
            />
            <div className="p-2">
              <p className="text-xs font-bold text-white">AED 2.8M</p>
              <p className="text-[10px] text-[#94A3B8]">Palm Jumeirah</p>
            </div>
          </div>

          <div className="absolute -bottom-4 right-0 z-10 w-40 overflow-hidden rounded-xl border border-white/[0.08] bg-[#1E293B] shadow-lg sm:right-4">
            <img
              src="https://images.unsplash.com/photo-1518684079-3c830dcef090?w=300"
              alt="Downtown Dubai"
              className="h-20 w-full object-cover"
            />
            <div className="p-2">
              <p className="text-xs font-bold text-white">AED 6.5M</p>
              <p className="text-[10px] text-[#94A3B8]">Downtown Dubai</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export function LandingStats() {
  const stats = [
    { value: '< 60 sec', label: 'AI Response Time' },
    { value: '24/7', label: 'AI Coverage' },
    { value: 'AED 0', label: 'Setup Fee' },
    { value: '48 hrs', label: 'Go Live Time' },
  ]
  return (
    <section className="border-y border-[rgba(124,58,237,0.2)] bg-[rgba(124,58,237,0.08)] py-8">
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-6 px-4 md:grid-cols-4 md:gap-0">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={`text-center ${i < stats.length - 1 ? 'md:border-r md:border-[rgba(124,58,237,0.2)]' : ''}`}
          >
            <p className="text-3xl font-extrabold text-white sm:text-4xl">{s.value}</p>
            <p className="mt-1 text-[13px] text-[#64748B]">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export function LandingHowItWorks() {
  const steps = [
    {
      icon: <Zap className="h-5 w-5" />,
      color: 'bg-[#7C3AED]',
      title: 'Lead Arrives',
      body: 'A lead submits from Bayut, Property Finder, or your website',
    },
    {
      icon: <Phone className="h-5 w-5" />,
      color: 'bg-[#06B6D4]',
      title: 'AI Calls in 60 Seconds',
      body: 'Priya (your AI agent) calls them immediately, qualifies budget, area, timeline',
    },
    {
      icon: <BarChart3 className="h-5 w-5" />,
      color: 'bg-[#7C3AED]',
      title: 'Smart Routing',
      body: 'Hot leads → your best-ranked broker instantly. Warm leads → automated nurture sequence',
    },
    {
      icon: <CheckCircle2 className="h-5 w-5" />,
      color: 'bg-emerald-500',
      title: 'Deal Closed',
      body: 'Pipeline tracks MOU → SPA → Commission → Payment Run. Everything in one place.',
    },
  ]

  return (
    <section id="how-it-works" className="py-20 sm:py-24">
      <FadeIn>
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            From Lead to Closed Deal.
          </h2>
          <p className="mt-2 text-3xl font-bold gn-gradient-text sm:text-4xl">Automatically.</p>

          <div className="mt-14 grid gap-8 md:grid-cols-4">
            {steps.map((step, i) => (
              <div key={step.title} className="relative text-left md:text-center">
                {i < steps.length - 1 && (
                  <div className="absolute left-1/2 top-6 hidden h-0.5 w-full border-t-2 border-dashed border-[rgba(124,58,237,0.3)] md:block" />
                )}
                <div
                  className={`relative z-10 mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full text-white ${step.color}`}
                >
                  {step.icon}
                </div>
                <h3 className="text-lg font-semibold text-white">{step.title}</h3>
                <p className="mt-2 text-sm text-[#94A3B8]">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </FadeIn>
    </section>
  )
}

export function LandingFeatures() {
  const features = [
    {
      emoji: '🎙️',
      title: 'AI Voice Agent',
      body: 'Priya calls every lead in under 60 seconds. Qualifies them live. You get only hot leads.',
      badge: 'VAPI Powered',
    },
    {
      emoji: '📊',
      title: 'Smart Pipeline',
      body: 'Viewing → MOU → SPA → Closed Won. Drag-and-drop. AED values. RERA fields.',
      badge: '8 Stages',
    },
    {
      emoji: '💬',
      title: 'WhatsApp Inbox',
      body: 'Shared team inbox. Bot handles new threads. Agent takes over when ready.',
      badge: 'Twilio',
    },
    {
      emoji: '🏆',
      title: 'Broker Rankings',
      body: 'Rank brokers by real KPIs. Hot leads go to your highest-ranked available agent.',
      badge: 'Auto-routing',
    },
    {
      emoji: '💰',
      title: 'Commission & Invoices',
      body: 'Pending → Approved → Invoice → Payment Run. AED. UAE compliant.',
      badge: 'Full workflow',
    },
    {
      emoji: '📈',
      title: 'Meta Ads Attribution',
      body: 'See cost per lead by source. Facebook, Instagram, Property Finder, Bayut.',
      badge: 'ROI tracking',
    },
  ]

  return (
    <section id="solutions" className="py-20 sm:py-24">
      <FadeIn>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">
              Everything a UAE Brokerage Needs
            </h2>
            <p className="mt-3 text-[#94A3B8]">
              One platform. No spreadsheets. No missed leads.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="gn-card p-6">
                <div className="mb-4 flex items-start justify-between">
                  <span className="text-3xl">{f.emoji}</span>
                  <span className="rounded-full border border-[rgba(124,58,237,0.3)] bg-[rgba(124,58,237,0.15)] px-2.5 py-0.5 text-[11px] font-semibold text-[#A78BFA]">
                    {f.badge}
                  </span>
                </div>
                <h3 className="text-xl font-semibold text-white">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#94A3B8]">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </FadeIn>
    </section>
  )
}

export function LandingDemo() {
  return (
    <section id="ai-voice-feature" className="py-20 sm:py-24">
      <FadeIn>
        <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8">
          <div>
            <h2 className="text-3xl font-bold text-white sm:text-4xl">
              Experience instant AI calls
            </h2>
            <p className="mt-4 text-[#94A3B8]">
              See exactly what your leads experience when Priya reaches out.
            </p>
            <ul className="mt-8 space-y-3 text-[#94A3B8]">
              <li className="flex gap-2">
                <span className="text-emerald-400">✓</span> Calls you within 60 seconds
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-400">✓</span> Asks the right qualification questions
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-400">✓</span> You&apos;ll see exactly what your leads
                experience
              </li>
            </ul>
          </div>
          <div className="rounded-[20px] border border-white/[0.08] bg-[#1E293B] p-6 sm:p-8 shadow-[0_4px_16px_rgba(0,0,0,0.3)]">
            <h3 className="mb-1 text-2xl font-bold text-white">Try Priya Right Now</h3>
            <p className="mb-6 text-sm text-[#94A3B8]">
              Enter your number. She&apos;ll call you in 60 seconds.
            </p>
            <LeadCaptureForm variant="dark" />
          </div>
        </div>
      </FadeIn>
    </section>
  )
}

export function LandingPricing({ onBookDemo }: BookDemoProps) {
  const plans = [
    {
      name: 'Starter',
      price: 'AED 2,500',
      period: '/month',
      blurb: 'For solo agents & small teams',
      features: [
        'AI Voice Qualification',
        'Up to 100 leads/month',
        'SMS + Email automation',
        'Basic analytics',
      ],
      popular: false,
    },
    {
      name: 'Professional',
      price: 'AED 5,500',
      period: '/month',
      blurb: 'For growing brokerages',
      features: [
        'All core CRM features',
        'Unlimited leads',
        'WhatsApp integration',
        'Priority support',
        'Monthly strategy call',
      ],
      popular: true,
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: '',
      blurb: 'For developer sales teams',
      features: [
        '5–20 agents',
        'Custom integrations',
        'Dedicated account manager',
        'White-label option',
      ],
      popular: false,
    },
  ]

  return (
    <section id="pricing" className="py-20 sm:py-24">
      <FadeIn>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">Choose Your Plan</h2>
            <p className="mt-3 text-[#94A3B8]">AED pricing. No setup fee. Cancel anytime.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl p-8 ${
                  plan.popular
                    ? 'border-2 border-[#7C3AED] bg-gradient-to-br from-[rgba(124,58,237,0.15)] to-[rgba(6,182,212,0.08)]'
                    : 'gn-card'
                }`}
              >
                {plan.popular && (
                  <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[#A78BFA]">
                    Most popular
                  </p>
                )}
                <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                <p className="mt-1 text-sm text-[#94A3B8]">{plan.blurb}</p>
                <div className="mt-4 mb-6">
                  <span className="text-4xl font-extrabold text-white">{plan.price}</span>
                  {plan.period && <span className="text-[#94A3B8]">{plan.period}</span>}
                </div>
                <ul className="mb-8 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex gap-2 text-sm text-[#94A3B8]">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#06B6D4]" />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={onBookDemo}
                  className={`w-full rounded-[10px] px-4 py-3 text-sm font-semibold ${
                    plan.popular
                      ? 'gn-btn-gradient'
                      : 'border border-white/15 bg-white/5 text-white hover:bg-white/10'
                  }`}
                >
                  {plan.price === 'Custom' ? 'Contact Sales' : 'Get Started'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </FadeIn>
    </section>
  )
}

export function LandingTrust() {
  const cards = [
    {
      icon: <Shield className="h-6 w-6 text-emerald-400" />,
      title: 'UAE Compliance',
      body: 'UAE PDPL compliant. RERA/DLD fields built in. AED currency throughout. Freehold zone tracking.',
    },
    {
      icon: <Globe className="h-6 w-6 text-[#06B6D4]" />,
      title: 'Arabic + English',
      body: 'Priya handles English leads today. Arabic language support — Q4 2026.',
    },
    {
      icon: <Star className="h-6 w-6 text-[#F59E0B]" />,
      title: 'Early Access',
      body: 'Join our founding brokerage programme. Lock in AED 2,500/month forever. First 10 brokerages only.',
    },
  ]

  return (
    <section id="results" className="py-20 sm:py-24">
      <FadeIn>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-12 text-center text-3xl font-bold text-white sm:text-4xl">
            Built for the UAE Market
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            {cards.map((c) => (
              <div key={c.title} className="gn-card p-6">
                <div className="mb-4">{c.icon}</div>
                <h3 className="text-lg font-semibold text-white">{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#94A3B8]">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </FadeIn>
    </section>
  )
}

export function LandingFAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)
  const faqs = [
    {
      q: 'Will this work with my existing CRM?',
      a: 'Gnanova is your all-in-one CRM. It connects natively with Property Finder, Bayut, WhatsApp Business, and Meta Ads — no third-party CRM needed.',
    },
    {
      q: 'How long does setup take?',
      a: 'Most brokerages are fully operational within 48 hours. We configure Priya, connect your lead sources, and go live after a short test window.',
    },
    {
      q: 'What if I need help?',
      a: 'Professional and Enterprise include priority support via phone, email, and chat. Starter gets email support within 24 hours.',
    },
    {
      q: 'Is my data secure?',
      a: 'Yes. We follow UAE PDPL principles, encrypt data in transit and at rest, and never sell your lead data.',
    },
    {
      q: 'Can I cancel anytime?',
      a: 'Yes — month-to-month plans with no long-term lock-in. Cancel anytime with 30 days notice.',
    },
    {
      q: 'Do you offer a free trial?',
      a: 'We offer a live demo with Priya and a walkthrough of your pipeline instead of a generic trial. Book a demo to see Gnanova with UAE workflows.',
    },
  ]

  return (
    <section id="faq" className="py-20 sm:py-24">
      <FadeIn>
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-10 text-center text-3xl font-bold text-white sm:text-4xl">
            Frequently Asked Questions
          </h2>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={faq.q} className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#1E293B]">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-5 py-4 text-left"
                  onClick={() => setOpenIndex(openIndex === i ? null : i)}
                >
                  <span className="pr-4 font-semibold text-white">{faq.q}</span>
                  <span className="text-[#A78BFA]">{openIndex === i ? '−' : '+'}</span>
                </button>
                {openIndex === i && (
                  <div className="border-t border-white/[0.06] px-5 pb-4 pt-3 text-sm leading-relaxed text-[#94A3B8]">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </FadeIn>
    </section>
  )
}

export function LandingFinalCta({ onBookDemo }: BookDemoProps) {
  return (
    <section className="px-4 pb-16 sm:px-6 lg:px-10 lg:pb-20">
      <FadeIn>
        <div
          className="mx-auto max-w-5xl rounded-3xl border border-[rgba(124,58,237,0.2)] px-6 py-14 text-center sm:px-12"
          style={{
            background:
              'linear-gradient(135deg, rgba(124,58,237,0.2) 0%, rgba(6,182,212,0.1) 100%)',
          }}
        >
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            Stop Losing Leads While You Sleep.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[#94A3B8]">
            Priya answers in 60 seconds. Every lead. Every night.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={onBookDemo} className="gn-btn-gradient px-7 py-3.5">
              Start Free Trial
            </button>
            <button
              type="button"
              onClick={onBookDemo}
              className="rounded-[10px] border border-white/15 bg-white/5 px-7 py-3.5 font-semibold text-white hover:bg-white/10"
            >
              Book a Demo
            </button>
          </div>
        </div>
      </FadeIn>
    </section>
  )
}

export function LandingFooter() {
  return (
    <footer className="border-t border-white/[0.08] bg-[#0A1520] py-14">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-[#7C3AED] to-[#06B6D4]" />
            <span className="font-bold text-white">Gnanova</span>
          </div>
          <p className="text-sm text-[#94A3B8]">
            AI-powered real estate CRM built for UAE brokerages.
          </p>
          <a
            href="https://www.linkedin.com"
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex text-[#94A3B8] hover:text-white"
            aria-label="LinkedIn"
          >
            <Linkedin size={18} />
          </a>
        </div>
        <div>
          <p className="mb-3 text-sm font-semibold text-white">Product</p>
          <ul className="space-y-2 text-sm text-[#94A3B8]">
            <li>
              <Link to="/dashboard" className="hover:text-white">
                Dashboard
              </Link>
            </li>
            <li>
              <a href="#ai-voice-feature" className="hover:text-white">
                AI Voice Agent
              </a>
            </li>
            <li>
              <a href="#solutions" className="hover:text-white">
                Pipeline
              </a>
            </li>
            <li>
              <a href="#solutions" className="hover:text-white">
                Commissions
              </a>
            </li>
          </ul>
        </div>
        <div>
          <p className="mb-3 text-sm font-semibold text-white">Company</p>
          <ul className="space-y-2 text-sm text-[#94A3B8]">
            <li>
              <a href="#results" className="hover:text-white">
                About Gnanova
              </a>
            </li>
            <li>
              <a href="#faq" className="hover:text-white">
                Privacy Policy
              </a>
            </li>
            <li>
              <a href="mailto:hello@gnanova.pro" className="hover:text-white">
                Contact
              </a>
            </li>
          </ul>
        </div>
        <div>
          <p className="mb-3 text-sm font-semibold text-white">Contact</p>
          <ul className="space-y-2 text-sm text-[#94A3B8]">
            <li>gnanova.pro</li>
            <li>UAE market focus</li>
          </ul>
        </div>
      </div>
      <div className="mx-auto mt-10 max-w-7xl border-t border-white/[0.06] px-4 pt-6 text-center text-xs text-[#64748B] sm:px-6 lg:px-8">
        © 2026 Gnanova AI Private Limited. All rights reserved. | Privacy Policy
      </div>
    </footer>
  )
}

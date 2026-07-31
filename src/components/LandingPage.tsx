import { useState } from 'react'
import DemoModal from '../../components/DemoModal'
import {
  LandingNav,
  LandingHero,
  LandingStats,
  LandingHowItWorks,
  LandingFeatures,
  LandingDemo,
  LandingPricing,
  LandingTrust,
  LandingFAQ,
  LandingFinalCta,
  LandingFooter,
} from './landing/sections'

export default function LandingPage() {
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false)

  const openDemoModal = () => setIsDemoModalOpen(true)
  const closeDemoModal = () => setIsDemoModalOpen(false)

  return (
    <div className="gnanova-landing min-h-screen">
      <LandingNav onBookDemo={openDemoModal} />
      <LandingHero onBookDemo={openDemoModal} />
      <LandingStats />
      <LandingHowItWorks />
      <LandingFeatures />
      <LandingDemo />
      <LandingPricing onBookDemo={openDemoModal} />
      <LandingTrust />
      <LandingFAQ />
      <LandingFinalCta onBookDemo={openDemoModal} />
      <LandingFooter />
      <DemoModal isOpen={isDemoModalOpen} onClose={closeDemoModal} />
    </div>
  )
}
